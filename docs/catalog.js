globalThis.createOrbitCatalog = function(options) {
  'use strict';
  const {day,pin,invalidate}=options;
  const D=LabCatalog,O=CatalogOrbits,el=id=>document.getElementById(id),dialog=el('object-explorer'),chart=createCatalogChart();
  const fmt=(v,d=1)=>Number(v).toLocaleString('ko-KR',{maximumFractionDigits:d});
  const major=id=>D.majors.find(p=>p.key===id),centers=OrbitMapSpace.radii;
  const periodText=d=>d<1?fmt(d*24,2)+'시간':d>1000?fmt(d/365.25,2)+'년':fmt(d,3)+'일';
  const circle=r=>Array.from({length:145},(_,j)=>[r*Math.cos(j*Math.PI/72),r*Math.sin(j*Math.PI/72),0]);
  const rules={jupiter:[[122400,129100],[129100,270000]],saturn:[[74491,91975],[91975,117570],[122050,136770],[140200,140200]],uranus:[[41838,41838],[44718,44718],[51149,51149],[97700,97700]],neptune:[[42000,42000],[53200,53200],[55200,55200],[57200,57200],[62933,62933]]};
  const ringText={jupiter:'주고리 122,400–129,100 km · 옅은 테베 고리는 약 270,000 km까지',saturn:'C 74,491–91,975 km · B 91,975–117,570 km · A 122,050–136,770 km · F 약 140,200 km',uranus:'6번 고리 41,838 km · 엡실론 51,149 km · 뮤 약 97,700 km',neptune:'갈레 42,000 km · 르베리에 53,200 km · 라셀 55,200 km · 아라고 57,200 km · 애덤스 62,933 km'};
  const topMoons=['moon','phobos','deimos','io','europa','ganymede','callisto','titan','enceladus','titania','triton','charon'];
  const deepFallback={};
  let tab='system',generation=0,selection=0,iterator=null,pendingPage=false,items=[],chosen=null,selectedModel=null,moonData,hosts,spacecraft,spaceMeta,features,manifest,deep={},portraits={},supplement={},marker=null;
  const baseJD=()=>LabInitial.jd+day();
  const natural=D.load('moons.json').then(v=>{moonData=v;hosts=new Map(v.hosts.map(h=>[h.key,h]));return v;});natural.catch(()=>{});
  const sample=D.load('small/featured.json').then(v=>{features=v;invalidate();return v;});sample.catch(()=>{});
  function hostName(key){return D.named(hosts?.get(key)?.name||key);}
  function typeText(item){return {planet:item.sub,region:'천체 분포',ring:'행성 고리',moon:item.raw?.confirmed?'자연위성':'자연위성 후보',small:item.dwarf?'왜행성':(item.row?.[3]||'')[0]==='c'?'혜성':'소행성',craft:D.kinds[item.row?.[3]]||'인공 물체'}[item.kind];}
  async function prepare(group){
    if(group==='system'){await sample;return;}
    if(group==='moon'){await natural;return;}
    if(group==='small'){manifest=await D.load('small/manifest.json');return;}
    if(group==='craft'&&!spacecraft){const [a,b,c,gp]=await Promise.all([D.load('spacecraft.json.gz'),D.load('spacecraft-meta.json'),D.load('deep-missions.json'),D.load('satellite-sky-gp.json.gz')]);for(const r of a)if(!r[16]&&gp[r[0]])r[16]=gp[r[0]];spacecraft=a;spaceMeta=b;deep=c.missions||deepFallback;}
  }
  const filterSets={system:[['all','전체 종류'],['major','태양·행성'],['dwarf','왜행성'],['ring','행성 고리'],['region','천체 분포']],moon:[['all','모든 중심 천체'],['earth','지구'],['mars','화성'],['jupiter','목성'],['saturn','토성'],['uranus','천왕성'],['neptune','해왕성'],['pluto','명왕성'],['dwarf','왜행성 전체'],['minor','소행성·기타'],['candidate','확인 전 후보']],small:[['featured','대표 천체'],['all','전체 목록'],['a','소행성'],['c','혜성']],craft:[['payload','인공위성·탐사선'],['gp','궤도 요소 제공'],['deep','지구 밖 탐사'],['debris','우주 잔해'],['rocket','로켓 몸체'],['other','미분류'],['all','모든 인공 물체']]};
  const hints={system:'이름이나 종류 검색',moon:'예: 유로파, S/2023, 목성',small:'예: 세레스, 99942, 1P',craft:'예: 우리별, ISS, 25544'};
  function moonItem(r){const host=hosts.get(r.host),name=r.name==='미명명 위성'?hostName(r.host)+'의 위성 '+(r.systemIndex||''):D.named(r.name);return {kind:'moon',key:r.id,name,sub:[hostName(r.host),r.designation||r.officialName||r.name,r.confirmed?'':'후보'].filter(Boolean).join(' · '),raw:r,host};}
  function craftItem(r){return {kind:'craft',key:'n'+r[0],name:D.craftKo[r[0]]||r[1],sub:'NORAD '+r[0]+' · '+(D.centers[r[8]]||r[8])+' · '+D.kinds[r[3]],row:r};}
  function systemItems(){return [...D.majors,...Object.entries(features.dwarfs).map(([id,row])=>({...D.smallItem(row,id),dwarf:true})),...D.ringSystems,...D.regions];}
  const matches=(q,...parts)=>!q||parts.some(x=>D.norm(x).includes(q));
  async function* records(group,filter,query,token){
    if(group==='small'){yield* D.lookupSmall(manifest,query,filter,()=>token===generation);return;}
    const q=D.norm(query);
    if(group==='system'){for(const obj of systemItems()){if((filter==='all'||filter==='major'&&obj.kind==='planet'||filter==='dwarf'&&obj.dwarf||filter===obj.kind)&&matches(q,obj.name,obj.key,obj.sub))yield obj;}return;}
    if(group==='moon'){
      const selected=moonData.moons.map(moonItem).filter(o=>{const r=o.raw;return (filter==='all'||filter===r.host||filter==='dwarf'&&o.host.group==='dwarf'||filter==='minor'&&o.host.group==='small'||filter==='candidate'&&!r.confirmed)&&matches(q,o.name,r.name,r.designation,o.sub,o.host.name,o.host.number,...r.aliases);});
      const priority=r=>{const n=topMoons.indexOf(D.simplify(r.raw.name));return n<0?100+(r.raw.confirmed?0:1):n;};selected.sort((a,b)=>priority(a)-priority(b));yield* selected;return;
    }
    const preferred=[25544,20580,22077,22828,25756,53365,50463,48274,37773,35315,10321,10271,2];
    const first=new Map(preferred.map((v,i)=>[v,i]));
    const filtered=spacecraft.filter(r=>{
      const allowed=filter==='all'||filter==='payload'&&r[3]==='PAY'||filter==='gp'&&r[16]||filter==='deep'&&r[3]==='PAY'&&r[8]!=='EA'||filter==='debris'&&r[3]==='DEB'||filter==='rocket'&&r[3]==='R/B'||filter==='other'&&r[3]==='UNK';
      return allowed&&matches(q,r[1],r[0],r[2],r[14],r[5],D.aliases[r[0]],D.centers[r[8]],r[1].includes('STARLINK')?'스타링크':'',r[1].includes('KOMPSAT')?'아리랑':'',r[1].includes('GK-')?'천리안':'');
    });
    filtered.sort((a,b)=>(first.get(a[0])??100)-(first.get(b[0])??100));for(const r of filtered)yield craftItem(r);
  }
  function summary(){return {system:'태양 · 여덟 행성 · 다섯 왜행성 · 고리와 천체 분포',moon:moonData?'확인 '+fmt(moonData.stats.confirmed)+'개 · 후보 '+fmt(moonData.stats.candidates)+'개 · NASA/JPL':'',small:manifest?'소행성 '+fmt(manifest.counts.an+manifest.counts.au)+'개 · 혜성 '+fmt(manifest.counts.cn+manifest.counts.cu)+'개 · NASA/JPL':'',craft:spaceMeta?'탑재체 '+fmt(spaceMeta.payloads)+'개 · 잔해 등 포함 '+fmt(spaceMeta.satcat)+'개 · CelesTrak':''}[tab];}
  function makeButton(item){const b=document.createElement('button');b.type='button';b.dataset.key=item.key;b.setAttribute('aria-pressed',String(item.key===chosen?.key));const title=document.createElement('b'),sub=document.createElement('small');title.textContent=item.name;sub.textContent=item.sub;b.append(title,sub);b.onclick=()=>choose(item,true);return b;}
  function errorUI(err,retry){el('catalog-status').textContent=err.message||'목록을 불러올 수 없습니다.';const b=el('catalog-more');b.hidden=false;b.textContent='다시 시도';b.onclick=retry;}
  async function more(token,initial){
    if(token!==generation||pendingPage||!iterator)return;pendingPage=true;const b=el('catalog-more');b.hidden=true;
    const next=[];try{let done=false;for(let i=0;i<30;i++){const entry=await iterator.next();if(token!==generation)return;if(entry.done){done=true;break;}next.push(entry.value);}
      const list=el('catalog-list');items.push(...next);list.append(...next.map(makeButton));el('catalog-status').textContent=items.length?fmt(items.length)+'개 표시'+(done?'':' · 더 보기 가능'):'일치하는 천체가 없습니다.';b.hidden=done;b.textContent='다음 결과 보기';b.onclick=()=>more(token,false);
      if(initial&&next.length&&!matchMedia('(max-width:600px)').matches)choose(next[0],false);
    }catch(err){if(token===generation)errorUI(err,refresh);}finally{if(token===generation)pendingPage=false;}
  }
  function clearDetail(){chosen=null;selectedModel=null;selection++;chart.set({caption:'천체를 선택하면 궤도와 관측 자료를 볼 수 있습니다.'});el('catalog-name').textContent='천체를 선택하세요';for(const n of ['catalog-kind','catalog-sub','catalog-note','catalog-facts'])el(n).textContent='';el('catalog-family').hidden=el('catalog-source').hidden=el('catalog-show').hidden=true;el('catalog-portrait').hidden=el('catalog-photo-link').hidden=true;}
  async function refresh(){const token=++generation;pendingPage=false;iterator=null;items=[];el('catalog-list').replaceChildren();el('catalog-list').scrollTop=0;el('catalog-more').hidden=true;el('catalog-status').textContent='목록을 불러오는 중…';clearDetail();
    try{await prepare(tab);if(token!==generation)return;el('catalog-count').textContent=summary();iterator=records(tab,el('catalog-filter').value,el('catalog-query').value.trim(),token);await more(token,true);}
    catch(err){if(token===generation)errorUI(err,refresh);}
  }
  function switchTab(value){clearTimeout(timer);tab=value;dialog.dataset.detail='false';el('system-list').parentElement.hidden=!['moon','craft'].includes(value);el('system-list').value='';el('catalog-query').value='';el('catalog-query').placeholder=hints[value];el('catalog-count').textContent=summary();el('catalog-filter').replaceChildren(...filterSets[value].map(([key,name])=>new Option(name,key)));for(const b of el('catalog-tabs').children)b.setAttribute('aria-pressed',String(b.dataset.tab===value));return refresh();}
  function overview(){return {center:'sun',name:'태양',centerRadius:.00465,lines:D.majors.slice(1).map(p=>({points:GravityLab.initialEllipse(p.index),color:'#58777e'})),caption:'태양 중심 · 실제 궤도 거리 비율',note:'행성의 현재 실험 시각은 전체 지도에서 볼 수 있습니다.',source:'https://ssd.jpl.nasa.gov/planets/phys_par.html',facts:[],pin:{host:'sun'}};}
  function orbitModel(o,center,epoch=baseJD()){
    const primary=major(center),centerRadius=primary?centers[primary.index]:center==='moon'?1737.4:center==='sun'?.00465:0;
    const m={center:primary||center==='moon'?center:null,centerRadius,lines:[],facts:[]};if(center==='sun')m.centerRadius=.00465;if(!o)return m;
    const current=O.position(o,epoch),reach=Math.max(o.q*12,current?Math.hypot(...current)*1.1:0);m.lines=[{points:O.curve(o,reach)}];
    if(current&&o.oriented!==false){m.duration=o.period||Math.max(1,Math.min(3650,Math.sqrt(o.q**3)*365));m.point=f=>O.position(o,epoch+f*m.duration);}
    return m;
  }
  function ringModel(item){const p=major(item.host),bands=rules[item.host],m={center:item.host,centerRadius:centers[p.index],lines:[],facts:[['중심 천체',p.name],['표시 단위','중심에서의 반지름 (km)']],caption:'행성 중심 기준 · 고리 반지름 비례',note:ringText[item.host],pin:{host:item.host},source:'https://pds-rings.seti.org/'+item.host+'/'+item.host+'_rings_table.html'};
    for(const [a,b] of bands){const count=b>a?10:1;for(let j=0;j<count;j++)m.lines.push({points:circle(a+(b-a)*j/Math.max(1,count-1)),color:count===1?'#c4ba9d':'rgba(192,181,148,.31)'});}return m;}
  function regionModel(item){const rows=item.key==='belt'?features.belt:item.key==='trojans'?features.trojans:item.key==='kuiper'?features.transNeptunian:[];const dots=rows.map(r=>O.position(O.small(r),baseJD())).filter(Boolean);
    return {center:'sun',centerRadius:0,lines:item.key==='oort'?[]:(item.key==='trojans'?[5.2]:[item.inner,item.outer]).map(r=>({points:circle(r),color:'#547785',dash:[3,4]})),dots,cloud:item.key==='oort',caption:item.key==='oort'?'추정 분포의 모식도':'실제 목록에서 고른 궤도 표본 · 태양 중심',facts:[['범위',item.sub],...(dots.length?[['표시 표본',fmt(dots.length)+'개']]:[])],note:item.key==='oort'?'장주기 혜성의 기원으로 추정하는 구형 영역입니다. 경계와 개별 구성원의 위치에는 큰 불확실성이 있습니다.':'분포의 경계는 점진적입니다. 개별 천체는 소행성·혜성 목록에서 검색할 수 있습니다.',source:item.source,pin:item.key==='oort'?null:{region:item.key}};}
  function smallModel(item){const row=item.row,o=O.small(row),epoch=baseJD(),m=orbitModel(o,'sun',epoch),bodyClass=D.classKo[row[4]]||row[4];m.caption='태양 중심 · J2000 황도 · 두 물체 궤도 근사';m.facts=[['식별 번호',row[1]],['궤도 분류',bodyClass],['근일점 거리',fmt(row[6],5)+' AU'],['이심률',fmt(row[7],6)],['궤도 요소 기준일',O.jdText(row[5])+' TDB'],['그림 시작일',O.jdText(epoch)+' TDB']];
    m.note='위치는 관측 궤도 요소에서 계산합니다. 재생은 이 시각부터의 근사 운동입니다.';m.source='https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr='+encodeURIComponent(row[1]);m.pin=o?{orbit:o}:null;return m;}
  function moonModel(item){const r=item.raw,h=item.host,raw=supplement[r.id]?.orbit||r.orbit,o=O.moon(raw),epoch=raw?.epochJD||baseJD(),m=orbitModel(o,h.key,epoch);
    m.facts=[['중심 천체',hostName(h.key)],['확인 상태',r.confirmed?'확인된 위성':'위성 후보']];if(r.designation)m.facts.push(['임시 명칭',r.designation]);if(r.year)m.facts.push(['발견 연도',String(r.year)]);if(r.radiusKm)m.facts.push(['평균 반지름',fmt(r.radiusKm,3)+' km']);if(raw?.aKm)m.facts.push(['궤도 긴반지름',fmt(raw.aKm)+' km']);if(raw?.periodDays)m.facts.push(['공전 주기',periodText(Math.abs(raw.periodDays))]);if(raw?.epochJD)m.facts.push(['궤도 기준일',O.jdText(raw.epochJD)+' TDB']);
    if(raw?.frame)m.facts.push(['기준면',({Laplace:'라플라스면',equatorial:'적도면',ecliptic:'황도면',EC:'황도면',EQ:'적도면'})[raw.frame]||raw.frame]);
    m.caption=m.point?'기준 시각부터의 근사 궤도':o?'공개된 궤도 크기 · 위상 미상':'공개 궤도 요소 부족';m.note=m.point?'각 위성의 자료에 명시된 기준면에서 본 궤도입니다. 천체 표시는 식별을 위해 확대됩니다.':o?'관측 자료로 알려진 궤도 범위를 표시합니다. 현재 위치를 정할 위상 자료는 제공되지 않습니다.':'관측 목록에 수록된 천체입니다. 위치를 그리기 위한 궤도 요소가 충분히 공개되지 않았습니다.';
    if(supplement[r.id]?.scopeNote)m.note=supplement[r.id].scopeNote;
    m.source=supplement[r.id]?.refUrl||(h.group==='planet'||h.key==='pluto'?'https://ssd.jpl.nasa.gov/sats/elem/':'https://ssd.jpl.nasa.gov/sb/sats.html');m.pin={host:h.key,hostInfo:h,parentOnly:true};return m;}
  function craftModel(item){const r=item.row,deepInfo=deep[r[0]],host=D.idByCenter[r[8]],m=orbitModel(null,host||'none'),sgp=r[8]==='EA'&&O.spacecraft(r);
    m.facts=[['NORAD 번호',String(r[0])],['국제 식별번호',r[2]||'미지정'],['궤도 중심',D.centers[r[8]]||r[8]],['발사일',r[6]||'미상']];if(r[7])m.facts.push(['궤도 이탈·종료일',r[7]]);const status={'+':'운용 중','-':'운용 종료',P:'부분 운용',B:'예비',S:'대기',X:'심우주 임무',D:'재진입',U:'미상'}[r[4]];if(status)m.facts.push(['목록 운용 상태',status]);
    m.source='https://celestrak.org/satcat/table-satcat.php?CATNR='+r[0];m.note='CelesTrak SATCAT 목록의 수록 기록입니다.';m.pin=host?{host,parentOnly:true}:null;
    if(sgp){m.lines=[{points:sgp.points}];m.duration=sgp.period;m.point=f=>sgp.point(f*sgp.period);m.facts.push(['궤도 기준 시각',r[16][0].slice(0,19).replace('T',' ')+' UTC'],['공전 주기',fmt(sgp.period*1440,2)+'분']);m.caption='지구 중심 · SGP4 · 기준 시각부터 한 바퀴';m.note='공개 평균궤도요소를 SGP4로 전파합니다. 재생은 표시된 기준 시각에서 시작합니다.';}
    else if(deepInfo&&Array.isArray(deepInfo.track)&&deepInfo.track.length>1){const {track}=deepInfo;const times=track.map(x=>x[0]);m.center=major(deepInfo.host)||deepInfo.host==='moon'?deepInfo.host:null;m.centerRadius=deepInfo.host==='moon'?1737.4:major(deepInfo.host)?centers[major(deepInfo.host).index]:0;m.lines=[{points:track.map(t=>t.slice(1,4))}];m.duration=times.at(-1)-times[0];m.point=f=>{const jd=times[0]+f*m.duration;let j=1;while(j<times.length-1&&times[j]<jd)j++;const a=track[j-1],b=track[j],u=(jd-a[0])/(b[0]-a[0]);return a.slice(1,4).map((v,i)=>v+(b[i+1]-v)*u);};m.caption='NASA/JPL Horizons · '+(deepInfo.archival?'기록 궤적':'천체력 궤적');m.facts.push(['천체력 구간',O.jdText(times[0])+' ~ '+O.jdText(times.at(-1))+' TDB']);m.note=deepInfo.scopeNote||'공개된 천체력의 위치 표본 사이를 보간합니다.';m.source=deepInfo.sourceUrl||'https://ssd.jpl.nasa.gov/horizons/';}
    else if(r[8]==='EA'&&r[10]!=null&&r[11]!=null&&r[10]>=0&&r[11]>=r[10]){const q=6378.137+r[10],a=6378.137+(r[10]+r[11])/2;m.lines=[{points:O.curve({q,e:1-q/a},0),dash:[4,4]}];m.caption='근지점·원지점 고도 도식 · 위치 미상';m.note='고도 범위로 궤도 모양을 표시합니다. 방향과 시각별 위치는 이 자료로 정할 수 없습니다.';}
    else{m.caption='목록 기록 · 위치 자료 없음';}
    if(r[8]==='EA'&&r[10]!=null&&r[11]!=null)m.facts.push(['근지점 / 원지점 고도',fmt(r[10])+' / '+fmt(r[11])+' km']);return m;
  }
  function modelFor(item){if(item.kind==='moon')return moonModel(item);if(item.kind==='craft')return craftModel(item);if(item.kind==='small')return smallModel(item);if(item.kind==='region')return regionModel(item);if(item.kind==='ring')return ringModel(item);
    const m=overview();if(item.index){m.lines=[{points:GravityLab.initialEllipse(item.index)}];m.point=()=>LabInitial.bodies[item.index].p;m.duration=0;m.facts=[['종류','행성'],['적도 반지름',fmt(centers[item.index])+' km']];m.caption='태양 중심 · 초기 관측 시각의 궤도';m.pin={host:item.key};}else m.facts=[['종류','별'],['반지름',fmt(centers[0])+' km']];return m;}
  async function choose(item,openDetail){const ticket=++selection;chart.stop();el('catalog-show').hidden=true;if(openDetail)dialog.dataset.detail='true';let obj;
    try{obj=await D.resolve(item);if(ticket!==selection)return;const m=modelFor(obj);chosen=obj;selectedModel=m;const isDwarf=obj.dwarf||Object.values(features?.dwarfs||{}).some(r=>r[0]===obj.row?.[0]);el('catalog-kind').textContent=isDwarf?'왜행성':typeText(obj);el('catalog-name').textContent=obj.name;el('catalog-sub').textContent=obj.sub;el('catalog-source').hidden=!m.source;el('catalog-source').href=m.source;el('catalog-note').textContent=m.note||'';el('catalog-facts').replaceChildren(...m.facts.flatMap(([key,v])=>{const k=document.createElement('dt'),d=document.createElement('dd');k.textContent=key;d.textContent=v;return[k,d];}));
      const img=el('catalog-portrait'),portrait=portraits[(obj.kind==='craft'?String(obj.row[0]):D.simplify(obj.raw?.name||obj.id||obj.key))];img.hidden=el('catalog-photo-link').hidden=!portrait;if(portrait){img.src=LabMedia.file('assets/catalog/portraits/'+portrait.file);img.alt=obj.name+' 관측 사진';img.title=portrait.attribution||portrait.credit||'';el('catalog-photo-link').href=portrait.sourceUrl||portrait.source||portrait.url;el('catalog-photo-label').textContent=portrait.imageType==='unresolved'?'점광원 관측 ↗':portrait.imageType==='ground'?'발사 전 사진 ↗':'관측 사진 ↗';}
      chart.set(m);const family=el('catalog-family');family.hidden=obj.kind!=='moon';family.setAttribute('aria-pressed','false');family.textContent='전체 위성계의 거리 보기';el('catalog-show').hidden=!m.pin;el('catalog-show').textContent=m.pin?.parentOnly?'전체 지도에서 중심 천체 보기':'전체 지도에 표시';for(const b of el('catalog-list').children)b.setAttribute('aria-pressed',String(b.dataset.key===item.key));
    }catch(err){if(ticket===selection){el('catalog-note').textContent='자료를 불러오지 못했습니다. 천체 이름을 다시 선택하세요.';el('catalog-name').textContent=item.name;}}}
  async function showOnMap(){if(!selectedModel?.pin||!chosen)return;const ticket=selection,obj=chosen,m={...selectedModel.pin,label:obj.name};try{if(m.host&&!major(m.host)&&m.host!=='moon'&&m.hostInfo){const row=await D.hostRow(m.hostInfo);if(row)m.orbit=O.small(row);else{el('catalog-note').textContent='중심 천체의 태양 기준 위치가 공개 자료에 없습니다.';return;}}if(ticket!==selection)return;
      marker=m;el('catalog-pin').hidden=false;el('catalog-pin').textContent=obj.name+(m.parentOnly?' · 중심 천체':'')+' ×';dialog.close();pin();invalidate();
    }catch{if(ticket===selection)el('catalog-note').textContent='지도 위치를 읽지 못했습니다. 다시 시도해 주세요.';}}
  el('catalog-family').onclick=()=>{
    if(chosen?.kind!=='moon')return;const button=el('catalog-family'),active=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(active));button.textContent=active?'선택한 위성의 궤도 보기':'전체 위성계의 거리 보기';
    if(!active){chart.set(selectedModel);return;}
    const host=chosen.host,all=moonData.moons.filter(r=>r.host===host.key&&r.confirmed),withDistance=all.map(r=>[r,(supplement[r.id]?.orbit||r.orbit)?.aKm]).filter(([,a])=>a>0),logBase=Math.max(1,Math.min(...withDistance.map(pair=>pair[1]))*.35);
    const lines=withDistance.map(([r,a])=>({points:circle(Math.log1p(a/logBase)),color:r.id===chosen.key?'#f0c98c':'rgba(139,188,198,.30)',width:r.id===chosen.key?1.6:.7}));chart.set({center:major(host.key)?host.key:null,lines,caption:'궤도 거리 비교 · 로그 간격 · '+withDistance.length+' / 확인 '+all.length+'개'});
  };
  async function openGroup(key){
    const group=LabFullLayer.group(key);if(!group)return;
    if(!dialog.open)dialog.showModal();
    if(!['moon','craft'].includes(tab)||!iterator)await switchTab(group.totals.artificialPlotted>group.totals.naturalPlotted?'craft':'moon');
    if(!dialog.open)return;clearDetail();dialog.dataset.detail='true';el('system-list').value=key;
    const t=group.totals,natural=t.confirmed+t.candidates,artificial=t.payload+t.debris+t.rocket+t.unknown;
    el('catalog-kind').textContent='위성계 분포';el('catalog-name').textContent=LabFullLayer.name(key)+' 주변';el('catalog-sub').textContent='2026. 11. 16. 00:00 UTC · 중심 천체 기준';
    const core=major(key)?.index,r=core!=null?centers[core]:500,colors={moon:'#e7d4a2',candidate:'#cdbb99',payload:'#a5cce488',rocket:'#b99e8a77',debris:'#939ba866',unknown:'#9197aa77'};
    const dots=group.points.map(([kind,id,x,y,z])=>{const len=Math.hypot(x,y,z),k=len?Math.log1p(len/r)/len:0;return [x*k,y*k,z*k,colors[kind]];});
    chart.set({center:core!=null?key:null,centerRadius:Math.log(2),dots,caption:'거리 로그 눈금 · 금색 자연위성 · 청색 탑재체 · 회색 잔해'});
    el('catalog-facts').replaceChildren(...[['자연위성·후보',fmt(t.naturalPlotted)+' / '+fmt(natural)+'개 위치'],['궤도상 인공 물체',fmt(t.artificialPlotted)+' / '+fmt(artificial)+'개 위치'],['자료 기준 시각','2026. 11. 16.'],['종료된 인공 물체 기록',fmt(t.retired)+'건']].flatMap(([a,b])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=a;dd.textContent=b;return [dt,dd];}));
    el('catalog-note').textContent='관측과 공개 궤도 요소에서 계산한 위치입니다. 위치 자료가 없는 천체도 목록 수에 포함합니다.';
    el('catalog-source').hidden=false;el('catalog-source').href=t.artificialPlotted?'https://celestrak.org/NORAD/elements/':'https://ssd.jpl.nasa.gov/horizons/';
  }
  el('system-list').onchange=e=>{if(e.target.value)openGroup(e.target.value);};
  el('host-moons').onclick=async()=>{const host=LabInitial.bodies[Number(el('map-target').value)]?.id;if(!host)return;dialog.showModal();await switchTab('moon');el('catalog-filter').value=host;refresh();};
  el('catalog-show').onclick=showOnMap;el('catalog-pin').onclick=()=>{marker=null;el('catalog-pin').hidden=true;invalidate();};
  el('catalog-open').onclick=()=>{dialog.showModal();dialog.dataset.detail='false';switchTab(tab);};el('catalog-back').onclick=()=>{dialog.dataset.detail='false';chart.stop();};el('catalog-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{generation++;selection++;chart.stop();});dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();}});
  const imageIndex=D.load('portraits/index.json').then(v=>{portraits=v.portraits||v;});imageIndex.catch(()=>{});D.load('moon-supplement.json').then(v=>{supplement=v.records||{};for(const raw of Object.values(supplement)){const ref=v.sources?.[raw.source];if(ref)raw.refUrl=ref.url||ref.sourceUrl;}}).catch(()=>{});
  for(const b of el('catalog-tabs').children)b.onclick=()=>switchTab(b.dataset.tab);let timer=0;el('catalog-query').oninput=()=>{generation++;selection++;chart.stop();el('catalog-list').replaceChildren();el('catalog-more').hidden=true;el('catalog-status').textContent='검색 중…';clearTimeout(timer);timer=setTimeout(refresh,90);};el('catalog-filter').onchange=refresh;
  const clouds=new Map();
  function smallBodies(key,day){
    if(!features)return [];
    let cloud=clouds.get(key);
    if(!cloud){
      const named=key==='named',ids=named?['ceres','vesta','pallas']:[];
      const rows=named?ids.map(id=>features.dwarfs[id]||features.objects[id]):features[{belt:'belt',trojans:'trojans',kuiper:'transNeptunian'}[key]];
      if(!rows)return [];
      const samples=rows.map((row,i)=>({orbit:O.small(row),id:ids[i],label:ids[i]&&D.ko[ids[i]],position:[0,0,0]}));
      cloud={samples};clouds.set(key,cloud);
    }
    if(cloud.day===day)return cloud.samples;
    // Interpolate the two bounding Kepler positions. This keeps accelerated
    // playback continuous and avoids solving a thousand orbits every frame.
    const start=Math.floor(day),phase=day-start;
    if(cloud.start!==start){
      for(const body of cloud.samples){
        body.from=cloud.start===start-1?body.to:O.position(body.orbit,LabInitial.jd+start);
        body.to=O.position(body.orbit,LabInitial.jd+start+1);
      }
      cloud.start=start;
    }
    for(const body of cloud.samples){
      if(!body.from||!body.to)continue;
      for(let i=0;i<3;i++)body.position[i]=body.from[i]+(body.to[i]-body.from[i])*phase;
    }
    cloud.day=day;return cloud.samples;
  }
  async function openSmall(id){
    if(!dialog.open)dialog.showModal();
    await switchTab('small');
    if(dialog.open&&tab==='small')choose(D.smallItem(features.dwarfs[id]||features.objects[id],id),true);
  }
  return {openGroup,openSmall,smallBodies,get open(){return dialog.open;},get marker(){return marker;}};
};
