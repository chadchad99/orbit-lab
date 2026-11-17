(() => {
  "use strict";
  const {bodies,orbitAt,point,periodText,spinText,DAY,MIN,MAX} = OrbitModel;
  const find = id => document.getElementById(id);
  const icon = name => '<svg aria-hidden="true"><use href="#i-'+name+'"/></svg>';
  const picture = (b,alt="") => '<img src="assets/'+b.id+'.webp" alt="'+alt+'" draggable="false">';
  const nowInRange=()=>Math.min(MAX,Math.max(MIN,Date.now()));
  const calendarDay=t=>new Date(t).toISOString().slice(0,10);
  const formatNumber=n=>n.toLocaleString("ko-KR");
  const speeds={real:1/DAY*1000,hour:1/24,day:1,ten:10,month:30,year:365.25};
  const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)");
  let selected=3;
  let time=nowInRange(),running=!reducedMotion.matches,rate=speeds.day;
  let mapVisible=true,latestDate="",lastFrame=null,lastPaint=-Infinity,clockDirty=true;
  let noticeTimer;
  const sky=makeOrbitSky(find("space"),find("stars"),chooseBody,updateCamera);

  function notify(message) {
    const notice=find("notice");
    notice.textContent=message;
    clearTimeout(noticeTimer);
    noticeTimer=setTimeout(()=>{notice.textContent=""},3300);
  }
  function updateCamera({zoom,mode}) {
    find("zoom-value").textContent=(zoom<10?zoom.toFixed(1):Math.round(zoom))+"×";
    find("zoom-out").disabled=zoom<=.650001;
    find("zoom-in").disabled=zoom>=63.9999;
    find("view-3d").setAttribute("aria-pressed",String(mode==="3d"));
    find("view-2d").setAttribute("aria-pressed",String(mode==="2d"));
  }
  function setRunning(next) {
    running=next;
    const button=find("play");
    button.innerHTML=icon(running?"pause":"play");
    button.setAttribute("aria-label",running?"일시 정지":"재생");
    button.title=running?"일시 정지 (Space)":"재생 (Space)";
    lastFrame=null;
  }
  function togglePlay() {
    if(!running&&time>=MAX){notify("마지막 관측 날짜입니다. 이전 날짜를 선택하세요.");return}
    setRunning(!running);
  }
  function setTime(value) {
    time=Math.max(MIN,Math.min(MAX,value));
    clockDirty=true;sky.invalidate();
    updateReadouts();
  }
  function moveDay(delta) {setRunning(false);setTime(time+delta*DAY)}
  function distanceText(body) {
    const orbit=orbitAt(body.id,time);
    const au=Math.hypot(...point(orbit));
    return au.toFixed(3)+" AU";
  }
  function updateReadouts() {
    const date=calendarDay(time);
    if(latestDate!==date) {
      latestDate=date;
      find("date-text").textContent=date.replaceAll("-",".");
      find("date-text").dateTime=date;
      find("prev-day").disabled=date==="1800-01-01";
      find("next-day").disabled=date==="2050-12-31";
    }
    const live=find("live-distance");
    if(live&&selected) {
      const value=distanceText(bodies[selected]);
      if(live.textContent!==value)live.textContent=value;
    }
  }
  function dataRows(body,full=false) {
    if(body.id==="sun") {
      const rows=[["radius","반지름","약 70만 km"],["focus","광구 온도","약 5,500 °C"],["clock","적도 자전 주기","약 25일"],["orbit","나이","약 46억 년"]];
      if(full)rows.push(["layers","분광형","G2 V"]);
      return rows;
    }
    const rows=[["ruler","태양까지 거리",distanceText(body)],["orbit","공전 주기",periodText(body)],["clock","자전 주기",spinText(body)],["radius","평균 반지름",formatNumber(Math.round(body.radius))+" km"]];
    if(full) {
      const o=orbitAt(body.id,time);
      rows.push(["ruler","궤도 긴반지름",o.a.toFixed(3)+" AU"],["orbit","궤도 이심률",o.e.toFixed(4)]);
    }
    return rows;
  }
  function rowMarkup(rows,live=false) {
    return rows.map(([glyph,label,value],i)=>'<div><dt>'+icon(glyph)+label+'</dt><dd'+(live&&i===0?' id="live-distance"':'')+'>'+value+'</dd></div>').join("");
  }
  function chooseBody(index,scrollRail=true) {
    selected=(index+bodies.length)%bodies.length;
    const body=bodies[selected];
    const photo=find("body-photo");
    photo.src="assets/"+body.id+".webp";photo.dataset.id=body.id;
    photo.parentElement.style.setProperty("--planet-color",body.color);
    find("body-type").style.setProperty("--planet-color",body.color);
    find("body-type").textContent=body.type;
    find("body-name").textContent=body.name;find("body-en").textContent=body.en;
    find("body-copy").textContent=body.note;
    find("detail-open").setAttribute("aria-label",body.name+" 자세히 보기");
    find("facts").innerHTML=rowMarkup(dataRows(body),selected!==0);
    const buttons=Array.from(find("planet-rail").children);
    buttons.forEach((button,i)=>button.setAttribute("aria-pressed",String(i===selected)));
    const rail=find("planet-rail"),button=buttons[selected];
    if(button&&scrollRail&&rail.scrollWidth>rail.clientWidth) {
      const rect=button.getBoundingClientRect(),parent=rail.getBoundingClientRect();
      if(rect.left<parent.left||rect.right>parent.right)rail.scrollLeft+=rect.left-parent.left-(parent.width-rect.width)/2;
    }
    sky.select(selected);
  }
  function drawRail() {
    const rail=find("planet-rail");
    bodies.forEach((body,index)=>{
      const button=document.createElement("button");
      button.className="planet-tile";button.dataset.id=body.id;button.setAttribute("aria-label",body.name+" 선택");
      button.innerHTML=picture(body)+"<span>"+body.name+"</span>";
      button.addEventListener("click",()=>chooseBody(index));
      rail.append(button);
    });
  }

  const filters=["전체","항성","지구형 행성","가스 거대 행성","얼음 거대 행성"];
  function showCatalog(filter="전체") {
    const list=find("catalog");list.replaceChildren();
    Array.from(find("filters").children).forEach(b=>b.setAttribute("aria-pressed",String(b.textContent===filter)));
    bodies.forEach((body,index)=>{
      if(filter!=="전체"&&filter!==body.type)return;
      const button=document.createElement("button");
      button.className="catalog-card";button.style.setProperty("--planet-color",body.color);
      button.setAttribute("aria-label",body.name+" 자세히 보기");
      const extra=index===0?"광구 약 5,500 °C":"공전 주기 "+periodText(body);
      button.innerHTML=picture(body)+'<span class="card-kind">'+body.type+'</span><strong>'+body.name+'<span lang="en" class="en">'+body.en+'</span></strong><span class="card-orbit">'+extra+'</span><span class="card-arrow">'+icon("arrow")+'</span>';
      button.addEventListener("click",()=>openDetail(index));list.append(button);
    });
  }
  function makeFilterButtons() {
    filters.forEach(type=>{
      const button=document.createElement("button");
      button.textContent=type;button.addEventListener("click",()=>showCatalog(type));find("filters").append(button);
    });
    showCatalog();
  }
  function navigate() {
    mapVisible=location.hash!=="#catalog";
    find("map-view").hidden=!mapVisible;find("catalog-view").hidden=mapVisible;
    for(const [id,active] of [["map-link",mapVisible],["catalog-link",!mapVisible]]) {
      const a=find(id);a.classList.toggle("active",active);
      if(active)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");
    }
    document.title=mapVisible?"태양계 관측소 · Orbit Atlas":"천체 도감 · Orbit Atlas";
    lastFrame=null;sky.invalidate();
  }
  function openDetail(index) {
    const body=bodies[index];const content=find("detail-content");
    content.innerHTML='<div class="detail-hero">'+picture(body,body.name)+'<div><div class="body-type" style="--planet-color:'+body.color+'">'+body.type+'</div><h3>'+body.name+'<span lang="en">'+body.en+'</span></h3></div></div><p class="detail-copy">'+body.note+'</p><p class="detail-copy">'+body.extra+'</p><dl class="facts">'+rowMarkup(dataRows(body,true))+'</dl><div class="detail-foot"><a href="'+body.url+'" class="source-link" target="_blank" rel="noreferrer">NASA 천체 자료'+icon("ext")+'</a><button class="action-btn" id="observe-body">궤도에서 보기'+icon("arrow")+'</button></div>';
    find("observe-body").addEventListener("click",()=>{
      find("detail-dialog").close();
      location.hash="map";navigate();chooseBody(index);
      find("space").focus({preventScroll:true});window.scrollTo({top:0,behavior:"instant"});
    });
    find("detail-dialog").showModal();
  }

  const imageCredits=[
    ["태양","NASA/GSFC/SDO/AIA · 파장 17.1 nm의 극자외선을 금색으로 표현","https://sdo.gsfc.nasa.gov/assets/img/browse/2026/09/12/20260912_000722_1024_0171.jpg"],
    ["수성","NASA, Johns Hopkins University APL, Carnegie Institution of Washington","https://science.nasa.gov/photojournal/mercury-globe-0n-180e/"],
    ["금성","NASA/JPL-Caltech · 영상 처리 Kevin M. Gill","https://science.nasa.gov/photojournal/venus-from-mariner-10/"],
    ["지구","NASA/GSFC · Reto Stöckli, Robert Simmon · Blue Marble 합성 영상","https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/"],
    ["화성","NASA/JPL/USGS","https://science.nasa.gov/photojournal/global-color-views-of-mars/"],
    ["목성","NASA/JPL/University of Arizona","https://science.nasa.gov/photojournal/pj-high-resolution-globe-of-jupiter/"],
    ["토성","NASA/ESA/E. Karkoschka (University of Arizona)","https://science.nasa.gov/image-detail/hubble-saturn-visible-light/"],
    ["천왕성","NASA/JPL-Caltech","https://science.nasa.gov/photojournal/uranus-as-seen-by-nasas-voyager-2/"],
    ["해왕성","NASA/JPL · 보이저 2호 영상, 색 대비 강조","https://science.nasa.gov/photojournal/neptune-full-disk-view/"]
  ];
  find("image-credits").innerHTML="<ul>"+imageCredits.map(([name,credit,url])=>'<li>'+credit+' · <a href="'+url+'" target="_blank" rel="noreferrer">'+name+' 원본</a></li>').join("")+"</ul>";

  drawRail();makeFilterButtons();chooseBody(selected,false);setRunning(running);updateReadouts();navigate();
  window.addEventListener("hashchange",navigate);
  find("play").addEventListener("click",togglePlay);
  find("prev-day").addEventListener("click",()=>moveDay(-1));find("next-day").addEventListener("click",()=>moveDay(1));
  find("speed").addEventListener("change",e=>{rate=speeds[e.target.value];lastFrame=null});
  find("prev-body").addEventListener("click",()=>chooseBody(selected-1));find("next-body").addEventListener("click",()=>chooseBody(selected+1));
  find("view-3d").addEventListener("click",()=>sky.setMode("3d"));find("view-2d").addEventListener("click",()=>sky.setMode("2d"));
  find("zoom-in").addEventListener("click",()=>sky.zoomBy(1.25));find("zoom-out").addEventListener("click",()=>sky.zoomBy(1/1.25));
  find("camera-reset").addEventListener("click",sky.reset);
  find("settings-open").addEventListener("click",()=>find("settings-dialog").showModal());
  find("detail-open").addEventListener("click",()=>openDetail(selected));
  find("help-open").addEventListener("click",()=>find("help-dialog").showModal());
  find("date-open").addEventListener("click",()=>{find("date-input").value=calendarDay(time);find("date-dialog").showModal()});
  find("date-form").addEventListener("submit",e=>{
    e.preventDefault();const value=find("date-input").valueAsNumber;
    if(!Number.isFinite(value)||value<MIN||value>MAX)return;
    setRunning(false);setTime(value);find("date-dialog").close();
  });
  find("today").addEventListener("click",()=>{setRunning(false);setTime(nowInRange());find("date-dialog").close()});
  for(const [id,key] of [["show-paths","paths"],["show-names","names"],["show-belt","belt"]])
    find(id).addEventListener("change",e=>sky.setSettings({[key]:e.target.checked}));
  document.querySelectorAll('input[name="scale"]').forEach(input=>input.addEventListener("change",e=>{
    sky.setSettings({scale:e.target.value});
    find("scale-label").textContent=(e.target.value==="compact"?"거리 압축":"실제 거리 비율")+" · 크기 확대";
  }));
  const dialogs=Array.from(document.querySelectorAll("dialog"));
  for(const dialog of dialogs) {
    dialog.querySelector(".close").addEventListener("click",()=>dialog.close());
    dialog.addEventListener("click",e=>{
      if(e.target!==dialog)return;
      const r=dialog.getBoundingClientRect();
      if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();
    });
    dialog.addEventListener("close",()=>{lastFrame=null;sky.invalidate()});
  }
  document.addEventListener("keydown",e=>{
    if(!mapVisible||e.repeat||dialogs.some(d=>d.open)||e.code!=="Space")return;
    if(e.target.closest("button,input,select,a,summary,[contenteditable=true]"))return;
    e.preventDefault();togglePlay();
  });
  document.addEventListener("visibilitychange",()=>{lastFrame=null;sky.invalidate()});
  reducedMotion.addEventListener?.("change",e=>{if(e.matches)setRunning(false)});
  document.fonts?.ready.then(()=>sky.invalidate());

  function tick(stamp) {
    const active=mapVisible&&!document.hidden&&!dialogs.some(d=>d.open);
    if(active) {
      if(running&&lastFrame!==null) {
        const next=time+(stamp-lastFrame)/1000*rate*DAY;
        if(next>=MAX) {setTime(MAX);setRunning(false);notify("관측 가능한 마지막 날짜에 도착했습니다.")}
        else {time=next;clockDirty=true}
      }
      if((clockDirty||sky.needsRender())&&(stamp-lastPaint>=1000/40||!running)) {
        sky.render(time);updateReadouts();clockDirty=false;lastPaint=stamp;
      }
    }
    lastFrame=active?stamp:null;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
