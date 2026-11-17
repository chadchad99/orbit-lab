// Only the light overview sample is needed on the default map. Full catalogues are paged on demand.
globalThis.LabCatalog = (() => {
  'use strict';
  const root='assets/catalog/', publicRoot='https://chadchad99.github.io/orbit-lab/', cache=new Map();
  const large=path=>path.startsWith('small/search/')||path.startsWith('small/bodies/');
  async function decode(bytes) {
    if(bytes[0]===31&&bytes[1]===139){
      const plain=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      return new Response(plain).json();
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  function load(path) {
    if(cache.has(path))return cache.get(path);
    const promise=(async()=>{
      const packed=document.getElementById('catalog-data-'+path)?.textContent;
      if(packed)return decode(Uint8Array.from(atob(packed),c=>c.charCodeAt(0)));
      const external=location.protocol==='file:' || (globalThis.LabCatalogRemoteShards && large(path));
      const url=(external?publicRoot:'')+root+path+(path==='cosmos/galaxies.json'?'?v=ac53ab20a2':'');
      const response=await fetch(url);if(!response.ok)throw new Error('목록을 불러올 수 없습니다 ('+response.status+')');
      return decode(new Uint8Array(await response.arrayBuffer()));
    })();
    cache.set(path,promise);
    const blocks=[...cache.keys()].filter(large);if(blocks.length>14)cache.delete(blocks[0]);
    promise.catch(()=>{if(cache.get(path)===promise)cache.delete(path);});return promise;
  }
  const ko={sun:'태양',mercury:'수성',venus:'금성',earth:'지구',mars:'화성',jupiter:'목성',saturn:'토성',uranus:'천왕성',neptune:'해왕성',moon:'달',pluto:'명왕성',ceres:'세레스',haumea:'하우메아',eris:'에리스',makemake:'마케마케',io:'이오',europa:'유로파',ganymede:'가니메데',callisto:'칼리스토',amalthea:'아말테아',himalia:'히말리아',phobos:'포보스',deimos:'데이모스',titan:'타이탄',enceladus:'엔셀라두스',mimas:'미마스',tethys:'테티스',dione:'디오네',rhea:'레아',iapetus:'이아페투스',hyperion:'히페리온',janus:'야누스',epimetheus:'에피메테우스',phoebe:'포에베',pan:'판',titania:'티타니아',oberon:'오베론',miranda:'미란다',ariel:'아리엘',umbriel:'움브리엘',triton:'트리톤',nereid:'네레이드',proteus:'프로테우스',charon:'카론',styx:'스틱스',nix:'닉스',hydra:'히드라',kerberos:'케르베로스',dysnomia:'디스노미아',namaka:'나마카',hiiaka:'히이아카',hiaka:'히이아카',dimorphos:'디모르포스',didymos:'디디모스',dactyl:'닥틸',selam:'셀람',halley:'핼리 혜성',vesta:'베스타',pallas:'팔라스',hygiea:'히기에이아',eros:'에로스',bennu:'베누',apophis:'아포피스',ryugu:'류구',quaoar:'콰오아',sedna:'세드나',gonggong:'공공',orcus:'오르쿠스',oumuamua:'오우무아무아',borisov:'보리소프',neowise:'니오와이즈',encke:'엥케 혜성'};
  const simplify=v=>String(v??'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const norm=v=>String(v??'').normalize('NFC').toLowerCase().replace(/[^가-힣a-z0-9]/g,'');
  const named=name=>ko[simplify(name)]||name;
  const smallAlias={...Object.fromEntries(Object.entries(ko).map(([en,kr])=>[norm(kr),en])),핼리:'halley',할리:'halley',할리혜성:'halley',지구접근소행성:'apophis',헤일밥:'halebopp',아틀라스:'3iatlas',오우무아무아:'oumuamua',디디모스:'didymos','67p':'67p'};
  const aliases={2:'스푸트니크 1호 Sputnik 1',25544:'국제우주정거장 ISS International Space Station Zarya',20580:'허블 우주망원경 Hubble Space Telescope',48274:'톈궁 천궁 중국 우주정거장 톈허 Tianhe Tiangong',50463:'제임스 웹 우주망원경 JWST James Webb Space Telescope',22077:'우리별 1호 KITSAT 1',22828:'우리별 2호 KITSAT 2',25756:'우리별 3호 KITSAT 3',53365:'다누리 한국 달 궤도선 Danuri KPLO',37773:'주노 목성 탐사선 Juno',35315:'달 정찰 궤도선 LRO Lunar Reconnaissance Orbiter',10321:'보이저 1호 Voyager 1',10271:'보이저 2호 Voyager 2'};
  const craftKo={2:'스푸트니크 1호',25544:'국제우주정거장 (ISS)',20580:'허블 우주망원경',48274:'톈궁 우주정거장 · 톈허',50463:'제임스 웹 우주망원경',22077:'우리별 1호',22828:'우리별 2호',25756:'우리별 3호',53365:'다누리',37773:'주노',35315:'달 정찰 궤도선',10321:'보이저 1호',10271:'보이저 2호'};
  const kinds={PAY:'탑재체',DEB:'우주 잔해','R/B':'로켓 몸체',UNK:'미분류 물체'};
  const centers={EA:'지구',SU:'태양',MO:'달',MA:'화성',VE:'금성',JU:'목성',SA:'토성',ME:'수성',EM:'지구·달 계',EL1:'태양·지구 L1',EL2:'태양·지구 L2',SS:'태양계 탈출 경로',AS:'소행성',25544:'국제우주정거장',48274:'톈궁 우주정거장'};
  const idByCenter={EA:'earth',SU:'sun',MO:'moon',MA:'mars',VE:'venus',JU:'jupiter',SA:'saturn',ME:'mercury',EM:'earth',EL1:'earth',EL2:'earth',25544:'earth',48274:'earth'};
  const classKo={MBA:'주 소행성대',IMB:'안쪽 소행성대',OMB:'바깥 소행성대',TJN:'목성 트로이군',TNO:'해왕성 바깥 천체',CEN:'켄타우루스군',APO:'아폴로군',AMO:'아모르군',ATE:'아텐군',IEO:'아티라군',MCA:'화성 횡단 소행성',HYA:'쌍곡선 궤도 소행성',ETc:'엔케형 혜성',JFc:'목성족 혜성',HTC:'핼리형 혜성',PAR:'포물선 혜성',HYP:'쌍곡선 혜성',COM:'혜성'};
  const majors=LabInitial.bodies.slice(0,9).map((b,index)=>({kind:'planet',key:b.id,name:b.name,sub:index?'행성':'중심별',index}));
  const regions=[['belt','주 소행성대','약 2.2–3.2 AU',2.2,3.2,'https://science.nasa.gov/mission/dawn/faq/'],['trojans','목성 트로이군','목성 궤도의 L4·L5 부근',4.9,5.5,'https://science.nasa.gov/mission/lucy/'],['kuiper','카이퍼대','주요 영역 약 30–50 AU',30,50,'https://science.nasa.gov/solar-system/kuiper-belt/facts/'],['oort','오르트 구름','추정 안쪽 2,000–5,000 AU · 바깥 10,000–100,000 AU',2000,100000,'https://science.nasa.gov/solar-system/oort-cloud/facts/']].map(([key,name,sub,inner,outer,source])=>({kind:'region',key,name,sub,inner,outer,source}));
  const ringSystems=['jupiter','saturn','uranus','neptune'].map(host=>({kind:'ring',key:'rings-'+host,host,name:named(host)+'의 고리',sub:'행성 고리',source:'https://science.nasa.gov/'+host+'/facts/'}));
  function smallItem(row,id) {const full=String(row[2]).trim();return {kind:'small',key:'s'+row[0],name:id&&ko[id]?ko[id]:full,sub:full,row,id};}
  async function smallRow(n,m) {const block=await load('small/'+m.bodyFiles[Math.floor(n/m.blockSize)]);return block[n%m.blockSize];}
  async function* lookupSmall(m,query,filter,alive) {
    const compatible=k=>!['a','c'].includes(filter)||k.startsWith(filter);
    if(!query){
      if(filter==='featured'){const f=await load('small/featured.json');for(const [id,row] of Object.entries({...f.dwarfs,...f.objects}))yield smallItem(row,id);return;}
      const comets=m.counts.cn+m.counts.cu,first=filter==='a'?comets:0,last=filter==='c'?comets:m.count;
      for(let n=first;n<last&&alive();n++){const row=await smallRow(n,m);yield smallItem(row);}
      return;
    }
    const key=simplify(smallAlias[norm(query)]||query);if(!key)return;
    const seen=new Set();const num=Number(key);
    if(/^\d+$/.test(key)&&num>=1&&num<=m.counts.an&&filter!=='c'){
      const ordinal=m.counts.cn+m.counts.cu+num-1,row=await smallRow(ordinal,m);if(row[1]===String(num)){seen.add(ordinal);yield smallItem(row);}
    }
    for(const range of m.searchRanges){
      if(!alive())return;if(range.hi<key||range.lo>key+'\uffff')continue;
      const entries=await load('small/'+range.file);
      for(const [alias,ordinal,name,k] of entries){if(!alias.startsWith(key)||seen.has(ordinal)||!compatible(k))continue;
        seen.add(ordinal);yield {kind:'small',key:'ordinal'+ordinal,name,sub:k.startsWith('c')?'혜성':'소행성',ordinal};}
    }
  }
  async function resolve(item){if(item.ordinal==null)return item;const m=await load('small/manifest.json');return smallItem(await smallRow(item.ordinal,m));}
  async function hostRow(host){const f=await load('small/featured.json');if(f.dwarfs[host.key])return f.dwarfs[host.key];const m=await load('small/manifest.json');let query=String(host.number||host.designation||host.name);for await(const i of lookupSmall(m,query,'all',()=>true)){return (await resolve(i)).row;}return null;}
  return {load,named,norm,simplify,ko,aliases,craftKo,kinds,centers,idByCenter,classKo,majors,regions,ringSystems,smallItem,lookupSmall,resolve,hostRow,publicRoot};
})();
