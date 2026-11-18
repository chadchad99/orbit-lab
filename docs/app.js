(() => {
  "use strict";
  const M=GravityLab, definitions=M.scenarios, planets=LabInitial.bodies;
  const el=id=>document.getElementById(id);
  const icon=id=>'<svg aria-hidden="true"><use href="#'+id+'"/></svg>';
  const number=(n,d=2)=>n.toLocaleString("ko-KR",{minimumFractionDigits:d,maximumFractionDigits:d});
  const clamp=(x,lo,hi)=>Math.max(lo,Math.min(x,hi));
  const cache=new Map(), values=Object.fromEntries(Object.entries(definitions).map(([id,d])=>[id,d.initial??1]));
  const base=M.solve();
  const motionPreference=matchMedia("(prefers-reduced-motion: reduce)");
  const state={base,test:null,kind:"vanish",watch:M.EARTH,scope:"wide",reference:"galaxy",allFit:false,showSatellites:true,sunBand:"radiant",linearDistances:false,displayScale:1.8,fixedCamera:false,showPaths:true,showNames:true,coronaPlaying:!motionPreference.matches,glide:!motionPreference.matches,actualSize:false,observing:false,split:false,mode:"map",day:0,applied:false,running:false,
    cruise:true,cruiseSettings:false,cruiseSatellites:false,starExposure:false,cleanView:false};
  const guides={near:{showPaths:false,showNames:false},far:{showPaths:true,showNames:true}};
  function setScope(scope){
    const group=v=>v==="near"||v==="sun"?"near":"far";
    const old=group(state.scope),next=group(scope);
    guides[old]={showPaths:state.showPaths,showNames:state.showNames};
    Object.assign(state,guides[next]);state.scope=scope;
    if(["near","sun","lunar"].includes(scope))state.fixedCamera=false;
  }
  let conditionPending=false,conditionFrame=0,previous=null,pendingDays=0,lastReadout=-Infinity,dirty=true;
  const mapRate=el("map-rate"),labRate=el("rate");
  let runningRate=location.hash.startsWith("#map")?15:3,rateChosen=false,priorSaturnRate=null;
  for(const rate of [.03,.1,.25,.5,1,2,3,5,10,15,30,45,90]){
    mapRate.add(new Option(rate===.03?"0.03× · 자전 관찰":rate+"×",String(rate)));
    labRate.add(new Option(rate+"일 / 초",String(rate)));
  }
  function setPlaybackRate(rate){
    if(state.running&&previous!==null&&rate!==runningRate){
      // Time before the selection still belongs to the previous speed.
      const now=performance.now();
      pendingDays+=Math.max(0,now-previous)*runningRate/1000;
      previous=now;
    }
    runningRate=rate;
    mapRate.value=labRate.value=String(rate);
  }
  const linkRate=Number(new URLSearchParams(location.search).get("rate"));
  if(linkRate>0&&Array.from(mapRate.options).some(option=>Number(option.value)===linkRate)){
    runningRate=linkRate;rateChosen=true;
  }
  setPlaybackRate(runningRate);
  const map=createLabMap(el("sky"),el("star-field"),i=>{
    if(i?.domain==="sky"){cosmos.openSky(i.id);return;}
    if(i?.domain==="small"){state.catalog.openSmall(i.id);return;}
    if(typeof i==="string"){state.catalog.openGroup(i);return;}
    setScope(i===0?"sun":"near");selectPlanet(i);
  },zoom=>{
    el("plus").disabled=zoom>=11.999;el("minus").disabled=zoom<=.45001;
  });
  const flight=createOrbitFlight(el("flight-gl"),el("flight-cpu"),cameraControls);
  function cameraControls(c){
    el("destination").style.setProperty("--place-chars",planets[state.watch].name.length);el("world-en").textContent=c.english;el("world-no").textContent=state.watch===M.MOON?"지구의 위성":String(state.watch).padStart(2,"0")+" / 08";
    if(c.height>=0)el("altitude").textContent=c.height.toLocaleString("ko-KR");
    el("rise-lens").setAttribute("aria-pressed",String(c.rise));el("near-lens").setAttribute("aria-pressed",String(c.near&&!c.rise));el("far-lens").setAttribute("aria-pressed",String(!c.near));
    el("auto-flight").setAttribute("aria-pressed",String(c.auto));
    const label=c.auto?"자동 비행 멈추기":"자동 비행 시작";if(el("auto-flight").title!==label){el("auto-flight").title=label;el("auto-flight").setAttribute("aria-label",label);el("auto-flight").innerHTML=icon(c.auto?"i-pause":"i-play");}
    el("flight-minus").disabled=c.zoom<=.721;el("flight-plus").disabled=c.zoom>=2.049;
    el("flight-tip").textContent=c.failed?"장면 자료를 열 수 없습니다. 궤도 지도를 이용하거나 다시 열어 주세요.":!c.ready?"관측 창을 여는 중…":matchMedia("(pointer: coarse)").matches?"손가락으로 회전 · 두 손가락으로 확대":"드래그로 둘러보기 · 휠로 거리 조절";
  }
  let series=null,peak=0,chartKey="",chartW=0,chartH=0,chartDpr=1;
  function mark(){lastReadout=-Infinity;dirty=true;map.invalidate();flight.invalidate()}
  function announce(text){el("announcement").textContent=text}
  function trajectory(kind,value){
    if(kind==="black"||((kind==="boost"||kind==="mass")&&value===1))return base;
    const key=kind+"|"+value;
    if(!cache.has(key)){
      if(cache.size>=8)cache.delete(cache.keys().next().value);
      cache.set(key,M.solve(kind,value));
    }
    return cache.get(key);
  }
  function seriesForWatch(){
    const key=state.kind+"|"+values[state.kind]+"|"+state.watch;
    if(key===chartKey)return;
    chartKey=key;series=new Float64Array(M.DAYS+1);peak=0;
    const p=new Float64Array(6),q=new Float64Array(6);
    for(let d=0;d<=M.DAYS;d++){
      series[d]=M.distance(M.read(base,state.watch,d,p),M.read(state.test,state.watch,d,q));
      peak=Math.max(peak,series[d]);
    }
    el("peek-caption").textContent=planets[state.watch].name+" · 90일 후 예상 위치 차이";
    el("peek-value").textContent=number(series[90],3)+" AU";
    el("graph-max").textContent="최대 "+number(peak,peak>10?1:3)+" AU";
    el("chart-summary").textContent=planets[state.watch].name+"의 730일 동안 두 위치의 최대 차이 "+number(peak,4)+" AU";
  }
  function plotChart(day){
    const node=el("chart"),rect=node.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);
    if(rect.width<12||rect.height<5)return;
    if(rect.width!==chartW||rect.height!==chartH||ratio!==chartDpr){
      chartW=rect.width;chartH=rect.height;chartDpr=ratio;node.width=Math.round(chartW*ratio);node.height=Math.round(chartH*ratio);
    }
    const ctx=node.getContext("2d");ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,chartW,chartH);
    const x0=3,x1=chartW-3,y0=chartH-11,y1=4;
    const sx=t=>x0+(x1-x0)*t/M.DAYS;
    const sy=v=>y0-(y0-y1)*(v/(peak||1));
    ctx.lineWidth=.65;ctx.strokeStyle="#405059";ctx.setLineDash([2,4]);ctx.beginPath();
    for(let i=0;i<3;i++){const y=y0+(y1-y0)*i/2;ctx.moveTo(x0,y);ctx.lineTo(x1,y)}ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();for(let d=0;d<=M.DAYS;d+=2){if(d===0)ctx.moveTo(sx(d),sy(series[d]));else ctx.lineTo(sx(d),sy(series[d]))}
    ctx.strokeStyle="#f2a389";ctx.lineWidth=1.45;ctx.stroke();
    ctx.lineTo(x1,y0);ctx.lineTo(x0,y0);ctx.closePath();const fill=ctx.createLinearGradient(0,y1,0,y0);fill.addColorStop(0,"#f29c6e3b");fill.addColorStop(1,"#f29c6e04");ctx.fillStyle=fill;ctx.fill();
    const int=Math.floor(day),val=series[int]+(series[Math.min(M.DAYS,int+1)]-series[int])*(day-int);
    const x=sx(day),y=sy(val);ctx.strokeStyle="#beeae1aa";ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x,y1);ctx.lineTo(x,y0+2);ctx.stroke();
    ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fillStyle="#b6f4e5";ctx.fill();
    ctx.font='9px "IBM Plex Mono","Lab Korean",sans-serif';ctx.fillStyle="#99aeb7";ctx.textBaseline="bottom";ctx.textAlign="left";ctx.fillText("0일",x0,chartH+1);ctx.textAlign="right";ctx.fillText("730일",x1,chartH+1);ctx.textAlign="left";
  }
  function updateControls(){
    if(!rateChosen&&state.scope==="near"&&state.watch===6){
      if(priorSaturnRate===null)priorSaturnRate=runningRate;
      setPlaybackRate(.03);
    }else if(priorSaturnRate!==null){
      if(!rateChosen&&runningRate===.03)setPlaybackRate(priorSaturnRate);
      priorSaturnRate=null;
    }
    const active=state.applied;
    const status=state.running?"running":active||state.observing?"paused":"ready";
    el("status").dataset.state=status;
    el("map-play").setAttribute("aria-label",state.running?"관측 시간 멈추기":"관측 시간 재생");el("map-play").querySelector("use").setAttribute("href",state.running?"#i-pause":"#i-play");
    el("status-text").textContent={ready:"실행 전",running:active?"실험 진행 중":"원래 태양계 관측 중",paused:"일시 정지"}[status];
    el("launch").querySelector("span").textContent=active?"처음부터 다시 실험":definitions[state.kind].action;
    el("play").innerHTML=icon(state.running?"i-pause":"i-play");
    el("play").setAttribute("aria-label",state.running?"일시 정지":active?"재생":state.mode==="map"?"원래 태양계 재생":"실험 재생");
    el("overlay").setAttribute("aria-pressed",String(!state.split));el("split").setAttribute("aria-pressed",String(state.split));
    el("map-box").classList.toggle("split",state.split);
    el("map-box").dataset.reference=state.reference;el("galactic-trails").setAttribute("aria-pressed",String(state.reference==="galaxy"));el("all-fit").setAttribute("aria-pressed",String(state.allFit));
    const fly=state.mode==="flight",box=el("map-box");
    box.dataset.mode=state.mode;el("flight-mode").setAttribute("aria-pressed",String(fly));el("map-mode").setAttribute("aria-pressed",String(!fly));
    el("flight-layer").hidden=!fly;el("flight-foot").hidden=!fly;el("map-legend").hidden=fly||!active||!state.showPaths;el("map-compare").hidden=fly;
    el("map-settings").hidden=el("map-caption").hidden=fly;
    const galaxy=state.reference==="galaxy",near=state.scope==="near",sun=state.scope==="sun",lunar=state.scope==="lunar",wide=state.scope==="wide";
    const galacticWide=!fly&&wide&&galaxy;
    const cruise=!fly&&OrbitMapSpace.cruising(state);
    el("satellite-layer").setAttribute("aria-pressed",String(cruise?state.cruiseSatellites:state.showSatellites));
    if(!galacticWide)state.cleanView=false;
    if(!cruise)state.cruiseSettings=false;
    box.classList.toggle("cruising",cruise);
    box.classList.toggle("clean-view",state.cleanView);
    el("galactic-views").hidden=!galacticWide;
    el("camera-cruise").setAttribute("aria-pressed",String(cruise));
    el("camera-overview").setAttribute("aria-pressed",String(!cruise));
    el("clean-view").hidden=el("star-exposure").hidden=!galacticWide;
    el("cruise-settings").hidden=el("cruise-paths").hidden=el("cruise-scale").hidden=!cruise;
    el("cruise-settings").setAttribute("aria-expanded",String(state.cruiseSettings));
    el("overview-options").hidden=cruise&&!state.cruiseSettings;
    el("star-exposure").setAttribute("aria-pressed",String(state.starExposure));
    el("cruise-paths").setAttribute("aria-pressed",String(state.showPaths));
    el("cruise-scale").setAttribute("aria-pressed",String(state.actualSize));
    el("clean-view").setAttribute("aria-pressed",String(state.cleanView));
    el("clean-view").textContent=state.cleanView?"조작 표시":"화면만 보기";
    const wideOption=el("map-target").querySelector('option[value="wide"]');
    wideOption.textContent=cruise?"은하 궤적":"태양계 전체";
    for(const [id,pressed] of [["galactic-frame",galaxy],["solar-frame",!galaxy],["paths-toggle",state.showPaths],["names-toggle",state.showNames],["size-toggle",state.actualSize||near],["view-near",near]])el(id).setAttribute("aria-pressed",String(pressed));
    el("target-label").textContent=cruise?"태양계 · 지난 365일":wide&&galaxy?"은하 궤적 · 지난 365일":"관측 천체";
    const quickMoons=el("host-moons");quickMoons.hidden=fly||!near||state.watch<3||state.watch>8;quickMoons.textContent=planets[state.watch].name+" 위성 보기";
    const solarObservation=(wide&&!state.actualSize||sun&&state.sunBand==="radiant")&&(!active||state.split||(state.kind!=="black"&&state.kind!=="vanish"));
    const coronaButton=el("corona-play");
    coronaButton.hidden=fly||!solarObservation;
    coronaButton.title=state.coronaPlaying?"코로나 영상 일시 정지":"코로나 영상 재생";
    coronaButton.setAttribute("aria-label",coronaButton.title);
    coronaButton.setAttribute("aria-pressed",String(state.coronaPlaying));
    coronaButton.querySelector("use").setAttribute("href",state.coronaPlaying?"#i-pause":"#i-play");
    box.dataset.scope=state.scope;
    el("map-target").value=sun?"0":wide?"wide":lunar?"pair":String(state.watch);
    el("view-sun").setAttribute("aria-pressed",String(sun));el("view-lunar").setAttribute("aria-pressed",String(lunar));
    el("distance-toggle").hidden=!wide;el("distance-toggle").setAttribute("aria-pressed",String(state.linearDistances||state.actualSize));el("distance-toggle").disabled=state.actualSize;
    el("solar-controls").hidden=!sun;el("sun-spot").hidden=state.sunBand!=="visible";
    for(const band of ["radiant","visible","euv","granules"])el("sun-"+band).setAttribute("aria-pressed",String(state.sunBand===band));
    const note=el("scene-note");
    if(sun&&active&&(state.kind==="vanish"||state.kind==="black"))note.textContent=state.kind==="black"?"같은 질량의 블랙홀 · 태양광 없음":"태양 소멸 · 태양광 없음";
    else if(sun&&state.sunBand==="granules")note.innerHTML='450.4 nm · 2022.07.08 · 시야 폭 30,720 km · <a href="https://nso.edu/press-release/new-images-released-by-nsfs-inouye-solar-telescope/" target="_blank" rel="noreferrer">NSF/AURA/NSO</a>';
    else if(sun&&state.sunBand==="radiant")note.textContent="HMI 광구 · AIA 코로나 · 카메라 노출 합성";
    else if(sun)note.textContent=state.sunBand==="euv"?"2024.05.10 · SDO/AIA · 극자외선 17.1 nm":"2024.05.10 · SDO/HMI · 가시광 617.3 nm";
    else if(wide){
      const scale=galaxy?(state.linearDistances||state.actualSize?"은하 궤적 · 거리 비례":"은하 궤적 · 궤도 간격 압축"):state.actualSize?"실제 크기와 거리":state.linearDistances||galaxy?"거리 비례 · 천체 확대":"궤도 간격 압축 · 천체 확대";
      const sizes=state.actualSize?"실제 크기":"천체 확대";
      note.textContent=cruise?"은하 공전 230 km/s · "+(OrbitMapSpace.compressed(state)?"궤도 간격 압축":"거리 비례")+" · "+sizes:solarObservation?scale+(state.showSatellites?" · 위성 분포 2026.11.16":""):scale;
      if(galaxy){
        const credit=document.createElement("a");
        credit.href="https://svs.gsfc.nasa.gov/4851/";credit.target="_blank";credit.rel="noreferrer";
        credit.textContent="NASA/SVS · ESA/Gaia/DPAC";note.append(" · ",credit);
      }
    }
    else if(!lunar)note.textContent="";
    note.hidden=!sun&&!lunar&&!wide;
    el("view-near").textContent=state.watch===M.MOON?"달 근접":"행성 곁";
    el("glide").hidden=!near&&!cruise;el("glide").setAttribute("aria-pressed",String(state.glide));
    el("glide").title=state.glide?"자동 선회 멈추기":"자동 선회 시작";el("glide").setAttribute("aria-label",el("glide").title);
    el("glide").querySelector("use").setAttribute("href",state.glide?"#i-pause":"#i-play");
    el("view-fit").textContent="은하 궤적";el("galactic-trails").textContent=galaxy?"태양 기준 보기":"은하 궤적 보기";
    el("map-light").textContent=active?"실험 전으로":definitions[state.kind].action;
    el("size-toggle").disabled=near||sun;el("camera-anchor").hidden=!galaxy||near||sun||lunar;el("camera-anchor").setAttribute("aria-pressed",String(state.fixedCamera));el("map-travel").hidden=!galaxy||sun||lunar;
    el("map-description").textContent=lunar?"지구 중심 · 달의 지난 27.3일 궤적":sun?"태양 근접 관측":(galaxy?"은하 회전 방향 · 약 230 km/s"+(state.showPaths?" · 지난 365일의 자취":""):"태양을 기준으로 본 위치") + "  ·  " + (state.actualSize||near?"천체 실제 크기":"천체 확대 표시");
    const skyCredit=el("map-caption").querySelector("a");
    skyCredit.href=wide&&galaxy?"https://svs.gsfc.nasa.gov/4851/":"https://www.eso.org/public/images/eso0932a/";
    skyCredit.textContent=wide&&galaxy?"별 지도 NASA/SVS · ESA/Gaia/DPAC":"하늘 사진 ESO/S. Brunier";
    el("sky").tabIndex=fly?-1:0;el("flight-gl").tabIndex=el("flight-cpu").tabIndex=fly?0:-1;
    const moon=state.watch===3,notes=["","햇빛이 비스듬히 스치는 충돌구","두꺼운 구름이 감싼 행성","구름 아래로 낮과 밤이 지나갑니다","붉은 먼지가 덮인 지표","구름 띠 사이로 흐르는 소용돌이","안쪽 고리가 더 빠릅니다 · 입자 무늬 강조","옅은 청록빛 구름층","푸른빛에 잠긴 먼 대기","충돌구와 바다가 이어지는 달 표면"];
    el("flight-note").textContent=!active?notes[state.watch]:state.kind==="vanish"?(moon?"햇빛이 사라지고 도시의 불빛만 남았습니다":"햇빛이 사라진 행성의 밤"):state.kind==="black"?"빛을 내지 않는 블랙홀 주위를 비행 중":state.kind==="binary"?"두 별의 빛이 서로 다른 방향에서 닿습니다":notes[state.watch];
    el("quick-experiment").querySelector("span:nth-child(2)").textContent=active?"실험 전으로":definitions[state.kind].action;
    el("rise-lens").disabled=active&&(state.kind==="vanish"||state.kind==="black");
    el("quick-experiment").classList.toggle("applied",active);
    el("view-fit").setAttribute("aria-pressed",String(galaxy&&(wide||state.scope==="fit")));el("view-all").setAttribute("aria-pressed",String(wide&&!galaxy));
  }
  function readouts(){
    const d=state.day;
    if(state.scope==="lunar"){const run=state.applied?state.test:state.base;el("scene-note").textContent="지구–달 거리 "+Math.round(M.distance(M.read(run,M.EARTH,d),M.read(run,M.MOON,d))*M.AU).toLocaleString("ko-KR")+" km";}
    const offset=Math.floor(d/M.DAYS)*M.DAYS,bar=el("time");
    if(Number(bar.min)!==offset){bar.min=offset;bar.max=offset+M.DAYS;for(const tick of document.querySelectorAll('[data-day]')){const rel=Number(tick.dataset.relative??tick.dataset.day);tick.dataset.relative=rel;tick.dataset.day=offset+rel;tick.textContent=(offset+rel)+"일";}}
    const integer=Math.floor(d+1e-8),p=M.read(base,state.watch,d),q=state.applied?M.read(state.test,state.watch,d):p,dist=state.applied?M.distance(p,q):0;
    el("day").textContent=integer;el("map-day").textContent=runningRate<.25?(d<1?number(d*24,1)+"시간":number(d,2)+"일"):integer+"일";el("time").value=integer;el("time").setAttribute("aria-valuetext",integer+"일");
    el("time").style.setProperty("--fill",((d-offset)/M.DAYS*100)+"%");
    if(state.mode==="map"&&state.reference==="galaxy"){
      const travel="출발 후 "+number(d*OrbitMapSpace.speedInAU,1)+" AU 이동";
      if(el("map-travel").textContent!==travel)el("map-travel").textContent=travel;
    }
    const horizon="90일 앞까지 표시";
    if(el("horizon-text").textContent!==horizon)el("horizon-text").textContent=horizon;
    const v1=M.speed(p),v2=M.speed(state.applied?q:p);
    el("separation").firstChild.nodeValue=number(dist,3)+" ";
    el("separation-km").textContent=number(Math.round(dist*M.AU),0)+" km";
    el("speed").firstChild.nodeValue=number(v2,2)+" ";
    el("control-speed").textContent="원래 속력 "+number(v1,2)+" km/s";
    if(!el("map-box").classList.contains("cinemascope"))plotChart(Math.min(d,M.DAYS));
  }
  function syncCondition(){
    conditionPending=false;
    state.test=trajectory(state.kind,values[state.kind]);seriesForWatch();mark();
  }
  function scheduleCondition(){
    conditionPending=true;
    cancelAnimationFrame(conditionFrame);
    conditionFrame=requestAnimationFrame(syncCondition);
  }
  function flushCondition(){if(conditionPending){cancelAnimationFrame(conditionFrame);syncCondition()}}
  function stage(){
    state.day=0;state.applied=false;state.observing=false;state.running=false;previous=null;
    updateControls();mark();
  }
  function launch(){
    flushCondition();state.day=0;state.applied=true;state.observing=false;state.running=true;previous=null;
    updateControls();mark();announce(definitions[state.kind].name+" 실험을 시작했습니다.");
  }
  function jump(day,experiment=false){
    flushCondition();
    const target=Math.max(0,day);
    if(experiment){state.applied=true;state.observing=false;}
    else if(!state.applied&&target>0){if(state.mode==="map"||state.observing)state.observing=true;else state.applied=true;}
    state.running=false;state.day=target;previous=null;updateControls();mark();
  }
  function togglePlay(){
    if(!state.applied&&(state.mode==="map"||state.observing)){
      state.observing=true;state.running=!state.running;previous=null;updateControls();mark();return;
    }
    if(!state.applied){launch();return}
    state.running=!state.running;previous=null;updateControls();mark();
  }
  function selectPlanet(i){
    if(i===0){setScope("sun");map.reset();updateControls();mark();return;}
    if(!planets[i])return;
    state.watch=i;el("map-target").value=el("watch").value=el("destination").value=String(i);flight.focusBody(i);
    el("watch-image").src=LabMedia.image(planets[i].id);
    if(state.test)seriesForWatch();map.reset();updateControls();mark();
  }
  function thumb(key){
    const pic=id=>'<img src="'+LabMedia.image(id)+'" alt="" draggable="false">';
    const content=key==="black"?pic("black-hole"):key==="boost"?pic("earth"):key==="binary"?pic("sun")+pic("sun"):pic("sun");
    return '<span class="case-thumb thumb-'+key+'" aria-hidden="true">'+content+'</span>';
  }
  function setParameterText(){
    const def=definitions[state.kind],value=values[state.kind];
    if(!def.slider)return;
    el("parameter-value").textContent="×"+value.toFixed(2);
    el("parameter").setAttribute("aria-valuetext",def.unit+"의 "+value+"배");
    el("parameter").style.setProperty("--fill",((value-def.min)/(def.max-def.min)*100)+"%");
  }
  function choose(kind,initial=false){
    if(!initial&&kind===state.kind)return;
    state.kind=kind;
    for(const btn of el("scenarios").children)btn.setAttribute("aria-pressed",String(btn.dataset.kind===kind));
    const def=definitions[kind];el("scenario-note").textContent=def.note;
    el("parameter-panel").hidden=!def.slider;
    if(def.slider){
      const input=el("parameter");input.min=def.min;input.max=def.max;input.step=def.step;input.value=values[kind];
      el("parameter-title").textContent=def.slider;
      el("low").textContent=def.min+"배";el("high").textContent=def.max+"배";setParameterText();
    }
    cancelAnimationFrame(conditionFrame);syncCondition();stage();map.reset();
  }
  for(const [id,def] of Object.entries(definitions)){
    const button=document.createElement("button");button.className="choice";button.dataset.kind=id;
    button.setAttribute("aria-label",def.name+" 실험 선택");
    button.innerHTML=thumb(id)+'<span><strong>'+def.name+'</strong><small>'+def.tag+'</small></span><i class="pick-dot" aria-hidden="true"></i>';
    button.addEventListener("click",()=>choose(id));el("scenarios").append(button);
  }
  el("map-target").add(new Option("태양계 전체","wide"));el("map-target").add(new Option("지구·달","pair"));el("map-target").add(new Option("태양","0"));
  el("destination").replaceChildren();
  planets.slice(1).forEach((b,i)=>{
    const option=new Option(b.name,String(i+1));el("watch").add(option);el("map-target").add(new Option(b.name,String(i+1)));el("destination").add(new Option(b.name,String(i+1)));
  });
  el("watch").value=el("destination").value=String(state.watch);
  el("map-play").addEventListener("click",togglePlay);
  el("galactic-trails").onclick=()=>{state.reference=state.reference==="galaxy"?"solar":"galaxy";state.fixedCamera=false;map.reset();updateControls();mark();};
  function selectGalacticCamera(cruise){
    state.cruise=cruise;state.allFit=state.fixedCamera=false;
    map.reset();updateControls();mark();
  }
  el("camera-cruise").onclick=()=>selectGalacticCamera(true);
  el("camera-overview").onclick=()=>selectGalacticCamera(false);
  el("cruise-settings").onclick=()=>{state.cruiseSettings=!state.cruiseSettings;updateControls();};
  el("star-exposure").onclick=()=>{state.starExposure=!state.starExposure;updateControls();mark();};
  el("cruise-paths").onclick=()=>{state.showPaths=!state.showPaths;updateControls();mark();};
  el("cruise-scale").onclick=()=>{state.actualSize=!state.actualSize;updateControls();mark();};
  function toggleCleanView(){
    state.cleanView=!state.cleanView;state.cruiseSettings=false;updateControls();mark();
  }
  el("clean-view").onclick=toggleCleanView;
  el("all-fit").onclick=()=>{state.allFit=!state.allFit;state.fixedCamera=false;map.reset();updateControls();mark();};
  el("satellite-layer").onclick=()=>{
    const key=OrbitMapSpace.cruising(state)?"cruiseSatellites":"showSatellites";
    state[key]=!state[key];updateControls();mark();
  };
  el("corona-play").addEventListener("click",()=>{state.coronaPlaying=!state.coronaPlaying;updateControls();mark();});
  el("map-target").addEventListener("change",e=>{
    const value=e.target.value;
    if(value==="wide"||value==="pair"){showView(value==="wide"?"wide":"lunar");return;}
    setScope(value==="0"?"sun":"near");selectPlanet(Number(value));
  });
  el("destination").addEventListener("change",e=>selectPlanet(Number(e.target.value)));
  el("watch").addEventListener("change",e=>selectPlanet(Number(e.target.value)));
  el("parameter").addEventListener("input",e=>{
    values[state.kind]=Number(e.target.value);setParameterText();stage();scheduleCondition();
  });
  el("launch").addEventListener("click",launch);el("play").addEventListener("click",togglePlay);
  el("start-day").addEventListener("click",()=>jump(0));el("add-month").addEventListener("click",()=>jump(Math.floor(state.day)+30));
  el("peek").addEventListener("click",()=>{jump(90,true);announce("90일 후 두 위치를 표시합니다.")});
  el("time").addEventListener("input",e=>jump(Number(e.target.value)));
  document.querySelectorAll("[data-day]").forEach(b=>b.addEventListener("click",()=>jump(Number(b.dataset.day))));
  for(const select of [mapRate,labRate])select.addEventListener("change",()=>{
    rateChosen=true;
    setPlaybackRate(Number(select.value));
  });
  el("reset").addEventListener("click",()=>{
    flushCondition();stage();announce("태양과 여덟 행성을 실험 전 상태로 복원했습니다.");
  });
  for(const id of ["overlay","split"])el(id).addEventListener("click",()=>{
    state.split=id==="split";updateControls();mark();
  });
  function showView(scope){
    setScope(scope);
    if(scope==="fit"){state.reference="galaxy";if(!rateChosen)setPlaybackRate(15);}
    if(scope==="lunar"&&!rateChosen)setPlaybackRate(1);

    if(scope==="lunar"&&state.watch!==M.EARTH&&state.watch!==M.MOON)selectPlanet(M.MOON);
    if((scope==="fit"||scope==="lunar")&&!state.applied&&!state.observing&&!motionPreference.matches){
      state.observing=true;state.running=true;previous=null;
    }
    map.reset();updateControls();mark();
  }
  for(const [id,scope] of [["view-fit","fit"],["view-all","wide"],["view-near","near"],["view-sun","sun"],["view-lunar","lunar"]])
    el(id).addEventListener("click",()=>{if(id==="view-fit"||id==="view-all"){state.reference=id==="view-fit"?"galaxy":"solar";if(id==="view-fit")state.cruise=false;state.fixedCamera=state.allFit=false;showView("wide");}else showView(scope);});
  for(const band of ["radiant","visible","euv","granules"])el("sun-"+band).addEventListener("click",()=>{state.sunBand=band;map.reset();updateControls();mark();});
  el("sun-spot").addEventListener("click",()=>{map.focusSunspot([.69267,.60973]);mark();});
  el("distance-toggle").addEventListener("click",()=>{state.linearDistances=!state.linearDistances;updateControls();mark();});
  for(const [id,reference] of [["solar-frame","solar"],["galactic-frame","galaxy"]])el(id).addEventListener("click",()=>{
    if(state.reference===reference)return;
    state.reference=reference;map.reset();updateControls();mark();
  });
  el("glide").addEventListener("click",()=>{state.glide=!state.glide;updateControls();mark();});
  motionPreference.addEventListener("change",e=>{if(e.matches){state.coronaPlaying=false;state.glide=false;updateControls();mark();}});
  el("map-light").addEventListener("click",()=>{if(state.applied)stage();else launch();});
  el("camera-anchor").addEventListener("click",()=>{state.fixedCamera=!state.fixedCamera;map.reset();updateControls();mark();});
  for(const [id,key] of [["paths-toggle","showPaths"],["names-toggle","showNames"],["size-toggle","actualSize"]])el(id).addEventListener("click",()=>{
    state[key]=!state[key];updateControls();mark();
  });
  el("minus").addEventListener("click",()=>map.zoomBy(.8));el("plus").addEventListener("click",()=>map.zoomBy(1.25));
  const box=el("map-box"),immersive=el("immersive");let idleTimer=null,screen=false;
  function wake(){box.classList.remove("quiet");clearTimeout(idleTimer);if(screen&&state.mode==="flight")idleTimer=setTimeout(()=>{if(!box.matches(":focus-within")||document.activeElement===immersive||document.activeElement===el("map-full")||document.activeElement?.tagName==="CANVAS")box.classList.add("quiet");},3400);}
  function fullFlag(v){screen=!!v;box.classList.toggle("cinemascope",screen);document.documentElement.classList.toggle("watching",screen);for(const button of [immersive,el("map-full")]){button.setAttribute("aria-pressed",String(screen));button.setAttribute("aria-label",screen?"전체 화면 닫기":"전체 화면 열기");button.querySelector("span").textContent=screen?"돌아가기":button===immersive?"몰입 화면":"전체 화면";if(button===el("map-full")&&screen)button.querySelector("span").textContent="실험실";}wake();mark();}
  function closeScreen(){if(document.fullscreenElement){document.exitFullscreen().catch(()=>fullFlag(false));}else if(document.webkitFullscreenElement&&document.webkitExitFullscreen){document.webkitExitFullscreen();}else fullFlag(false);}
  for(const button of [immersive,el("map-full")])button.addEventListener("click",()=>{if(screen){closeScreen();return;}fullFlag(true);if(box.requestFullscreen){try{const req=box.requestFullscreen();if(req?.catch)req.catch(()=>{});}catch{} }else if(box.webkitRequestFullscreen){try{box.webkitRequestFullscreen();}catch{}}});
  for(const evt of ["fullscreenchange","webkitfullscreenchange"])document.addEventListener(evt,()=>fullFlag(!!(document.fullscreenElement||document.webkitFullscreenElement)));
  for(const evt of ["pointermove","pointerdown","keydown","focusin"])box.addEventListener(evt,wake);
  document.addEventListener("keydown",e=>{
    if(e.key!=="Escape"||el("object-explorer").open||el("cosmos-view").open||el("exo-view").open||el("guide").open)return;
    if(state.cleanView){toggleCleanView();el("clean-view").focus();}
    else if(state.cruiseSettings){state.cruiseSettings=false;updateControls();el("cruise-settings").focus();}
    else if(screen)closeScreen();
  });
  for(const [id,mode] of [["flight-mode","flight"],["map-mode","map"]])el(id).addEventListener("click",()=>{state.mode=mode;flight.setVisible(mode==="flight");updateControls();mark();});
  el("far-lens").addEventListener("click",()=>flight.setNear(false));el("near-lens").addEventListener("click",()=>flight.setNear(true));
  el("rise-lens").addEventListener("click",()=>flight.setRise());
  el("flight-plus").addEventListener("click",()=>flight.zoomBy(1.18));el("flight-minus").addEventListener("click",()=>flight.zoomBy(1/1.18));el("auto-flight").addEventListener("click",()=>flight.toggleAuto());
  el("quick-experiment").addEventListener("click",()=>{if(state.applied){stage();announce("실험 전의 빛과 궤도로 복원했습니다.");}else launch();});
  const guide=el("guide");
  el("help").addEventListener("click",()=>guide.showModal());
  el("close-guide").addEventListener("click",()=>guide.close());guide.addEventListener("close",()=>mark());
  guide.addEventListener("click",e=>{if(e.target===guide){const r=guide.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)guide.close()}});
  document.addEventListener("keydown",e=>{
    if(guide.open||el("object-explorer").open||el("cosmos-view").open||el("exo-view").open||e.repeat||e.code!=="Space"||e.target.closest("button,input,select,a,summary"))return;
    e.preventDefault();togglePlay();
  });
  document.addEventListener("visibilitychange",()=>mark());
  new ResizeObserver(mark).observe(el("chart"));
  document.fonts?.ready.then(mark);
  el("credits").innerHTML="<ul>"+LabMedia.credits.map(([name,credit,url])=>'<li>'+credit+' · <a href="'+url+'" target="_blank" rel="noreferrer">'+name+' 원본</a></li>').join("")+"</ul>";

  const exoplanets=createExoViewer(mark);
  const cosmos=createCosmosViewer();el("cosmos-view").addEventListener("close",()=>mark());
  state.catalog=createOrbitCatalog({day:()=>state.day,invalidate:mark,pin:()=>{
    if(state.applied)state.split=true;
    state.mode="map";flight.setVisible(false);showView("wide");
  }});
  el("object-explorer").addEventListener("close",()=>mark());
  flight.setVisible(false);choose("vanish",true);selectPlanet(state.watch);
  function openMapLink(){
    const match=location.hash.match(/^#map(?:\/(solar|galaxy))?(?:\/([a-z]+))?(?:\/(near|trails|wide|cruise|lunar|sun|euv))?(\/play)?$/);
    if(!match)return;
    state.mode="map";state.reference=match[1]||"galaxy";flight.setVisible(false);
    state.cruise=match[3]==="cruise";state.cleanView=state.cruiseSettings=false;
    if(state.cruise){state.reference="galaxy";state.fixedCamera=state.allFit=false;if(!rateChosen)setPlaybackRate(3);}
    setScope(match[3]==="trails"?"fit":match[3]==="lunar"?"lunar":match[2]==="sun"?"sun":state.cruise||match[3]==="wide"||!match[2]?"wide":"near");
    if(match[2]==="sun")state.sunBand=match[3]==="euv"?"euv":"radiant";
    const target=planets.findIndex(body=>body.id===match[2]);if(target>0)selectPlanet(target);
    if(state.scope==="lunar"&&!rateChosen)setPlaybackRate(1);
    if(match[4]&&!motionPreference.matches){
      state.applied=false;state.observing=true;state.running=true;previous=null;
    }
    map.reset();updateControls();mark();
  }
  openMapLink();
  if(!location.hash||location.hash.startsWith("#system/")){state.observing=true;state.running=!motionPreference.matches;updateControls();}
  fullFlag(true);exoplanets.route();window.addEventListener("hashchange",openMapLink);
  function animate(now){
    const visible=!document.hidden&&!guide.open&&!el("object-explorer").open&&!el("cosmos-view").open&&!el("exo-view").open;
    if(previous===null)pendingDays=0;
    const elapsed=previous===null?0:Math.max(0,(now-previous)/1000);
    if(state.running){
      pendingDays+=elapsed*runningRate;
      if(!document.hidden){
        // Bound integration work after a suspended tab. Stored elapsed time is
        // carried across frames, so opening an inspector never resets the clock.
        const increment=Math.min(64,pendingDays);
        if(increment>0){state.day+=increment;pendingDays-=increment;dirty=true;
          if(!visible&&state.day>M.DAYS){M.read(base,0,state.day);if(state.applied)M.read(state.test,state.watch,state.day);}
        }
      }
    }else pendingDays=0;
    if(visible&&!conditionPending){
      if(state.mode==="flight")flight.draw(state,now);
      else{
        map.advanceCamera(state,now);
        if(map.advanceSun(state,elapsed))map.invalidate();
      }
      if(dirty||(state.mode==="map"&&map.needsRender())){
        if(state.mode==="map")map.draw(state);
        if(dirty&&(!state.running||now-lastReadout>=100)){readouts();lastReadout=now;}
        dirty=false;
      }
    }
    previous=Math.max(previous??now,now);requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
})();
