globalThis.createGalaxyViewer=function(onReturn){
  'use strict';
  const el=k=>document.getElementById(k),dialog=el('galaxy-view'),stage=el('galaxy-stage'),select=el('galaxy-select');
  const gpu=el('galaxy-gl'),cpu=el('galaxy-cpu'),photo=el('galaxy-observation'),status=el('galaxy-status');
  const base='assets/catalog/cosmos/structure/',pointers=new Map(),reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  let catalogue,rows=[],selected,loaded=false,imageMode=false,auto=false,active=0,raf=0,timer=0,last=0;
  let yaw=0,tilt=0,zoom=1,offsetX=0,offsetY=0,gesture=null,opener=null,quick=false;
  const volume=createGalaxyVolume(gpu,cpu,redraw);
  function redraw(){if(dialog.open&&!raf)raf=requestAnimationFrame(paint);}
  function paint(now){
    raf=0;if(!dialog.open||document.hidden)return;
    if(!imageMode&&loaded){
      if(auto&&last)yaw+=Math.min(.08,(now-last)/1000)*.13;
      volume.draw(selected,yaw,tilt,zoom,quick||auto);
    }
    if(imageMode)photo.style.transform='translate('+offsetX+'px,'+offsetY+'px) scale('+zoom+')';
    last=now;if(auto&&!imageMode&&loaded)redraw();
  }
  function setBusy(on){
    quick=on;clearTimeout(timer);if(on)timer=setTimeout(()=>{quick=false;redraw();},160);
    redraw();
  }
  function caption(){
    if(!selected)return;
    const distance=selected.distance?' · '+new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1}).format(selected.distance/10000)+'만 광년':'';
    const angle=selected.angle?' · 긴 지름 '+selected.angle.toLocaleString('ko-KR')+'′':'';
    el('galaxy-kind').textContent=selected.kind+distance+angle;
    el('galaxy-caption').textContent=imageMode?selected.band+' 관측 · 확대와 이동 가능':'관측 사진 기반 · 깊이와 뒷면은 추정 · 드래그로 회전';
    el('galaxy-source').hidden=false;el('galaxy-source').textContent=selected.credit+' ↗';el('galaxy-source').href=selected.source;
  }
  function controls(){
    el('galaxy-auto').setAttribute('aria-pressed',String(auto));
    el('galaxy-auto').hidden=imageMode;
    el('galaxy-minus').disabled=zoom<=.65;el('galaxy-plus').disabled=zoom>=4;
    el('galaxy-volume-mode').setAttribute('aria-pressed',String(!imageMode));
    el('galaxy-photo-mode').setAttribute('aria-pressed',String(imageMode));
  }
  function reset(){
    yaw=0;tilt=selected?Math.acos(selected.ratio):0;zoom=1;offsetX=offsetY=0;auto=false;last=0;
    controls();redraw();
  }
  function mode(usePhoto){
    imageMode=usePhoto;photo.hidden=!usePhoto;stage.classList.toggle('show-photo',usePhoto);
    if(usePhoto&&selected){
      photo.alt=selected.name+' '+selected.band+' 관측 사진';photo.src=LabMedia.file(base+selected.observation);
    }
    reset();caption();
  }
  function message(s){status.textContent=s;status.hidden=!s;}
  async function choose(key){
    const revision=++active;
    loaded=false;selected=null;gpu.hidden=cpu.hidden=photo.hidden=true;
    el('galaxy-title').textContent='은하 탐사';el('galaxy-kind').textContent=el('galaxy-caption').textContent='';el('galaxy-source').hidden=true;
    message('은하 관측 자료를 불러오는 중…');cancelAnimationFrame(raf);raf=0;last=0;
    try{
      catalogue??=LabCatalog.load('cosmos/structures.json').catch(e=>{catalogue=null;throw e;});
      const data=await catalogue;if(revision!==active||!dialog.open)return;
      if(!rows.length){rows=data.galaxies;select.replaceChildren(...rows.map(g=>new Option(g.name,g.id)));}
      const model=rows.find(g=>g.id===key);if(!model)throw Error('은하 목록에서 대상을 선택해 주세요.');
      selected=model;select.value=model.id;el('galaxy-title').textContent=model.name;
      mode(false);
      const im=new Image();im.decoding='async';
      await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=()=>reject(Error('입체 자료를 열지 못했습니다. 관측 사진을 확인할 수 있습니다.'));im.src=LabMedia.file(base+model.density);});
      if(revision!==active||!dialog.open)return;
      volume.use(im);loaded=true;message('');redraw();
    }catch(err){
      if(revision!==active||!dialog.open)return;
      if(selected)mode(true);message(err.message||'관측 자료를 다시 열어 주세요.');
    }
  }
  function open(key='m31'){
    if(!dialog.open){opener=document.activeElement;dialog.showModal();stage.focus({preventScroll:true});}
    return choose(key);
  }
  select.onchange=()=>{
    if(location.hash.startsWith('#galaxy/'))history.replaceState(history.state,'','#galaxy/'+select.value);
    choose(select.value);
  };
  el('galaxy-open').onclick=()=>open('m31');
  el('galaxy-close').onclick=()=>dialog.close();
  el('galaxy-volume-mode').onclick=()=>{if(loaded)mode(false);else if(selected)choose(selected.id);};el('galaxy-photo-mode').onclick=()=>mode(true);
  el('galaxy-home').onclick=reset;
  el('galaxy-auto').onclick=()=>{auto=!auto;last=0;controls();redraw();};
  function magnify(factor){zoom=clamp(zoom*factor,.65,4);controls();setBusy(true);}
  el('galaxy-minus').onclick=()=>magnify(1/1.32);el('galaxy-plus').onclick=()=>magnify(1.32);
  stage.addEventListener('wheel',e=>{e.preventDefault();magnify(Math.exp(-clamp(e.deltaY,-400,400)*.0017));},{passive:false});
  const separation=()=>{const [a,b]=pointers.values();return Math.hypot(a.x-b.x,a.y-b.y);};
  function anchor(){
    const [p]=pointers.values();gesture=p?{x:p.x,y:p.y,gap:pointers.size>1?separation():0,zoom}:null;
  }
  stage.onpointerdown=e=>{
    stage.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});auto=false;controls();anchor();
  };
  stage.onpointermove=e=>{
    if(!gesture||!pointers.has(e.pointerId))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size>1){zoom=clamp(gesture.zoom*separation()/Math.max(1,gesture.gap),.65,4);controls();}
    else{
      const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;gesture.x=e.clientX;gesture.y=e.clientY;
      if(imageMode){offsetX+=dx;offsetY+=dy;}
      else{yaw-=dx*.008;tilt=clamp(tilt+dy*.008,-Math.PI+.015,Math.PI-.015);}
    }
    setBusy(true);
  };
  stage.onpointerup=stage.onpointercancel=e=>{pointers.delete(e.pointerId);anchor();if(!gesture)setBusy(false);};
  stage.onkeydown=e=>{
    if(['+','=','-'].includes(e.key)){e.preventDefault();magnify(e.key==='-'?1/1.25:1.25);}
    if(e.key.startsWith('Arrow')){
      e.preventDefault();const x=(e.key==='ArrowRight')-(e.key==='ArrowLeft'),y=(e.key==='ArrowDown')-(e.key==='ArrowUp');
      if(imageMode){offsetX+=x*20;offsetY+=y*20;}else{auto=false;yaw+=x*.14;tilt=clamp(tilt+y*.14,-Math.PI+.015,Math.PI-.015);}
      controls();setBusy(true);
    }
  };
  photo.onerror=()=>{if(dialog.open&&imageMode)message('관측 사진을 불러오지 못했습니다. 다시 선택해 주세요.');};
  dialog.addEventListener('close',()=>{
    active++;cancelAnimationFrame(raf);clearTimeout(timer);raf=0;last=0;auto=false;pointers.clear();gesture=null;
    const direct=location.hash.startsWith('#galaxy/');
    if(opener?.isConnected&&opener!==document.body)opener.focus({preventScroll:true});onReturn(direct);
  });
  reduce.addEventListener('change',()=>{if(reduce.matches){auto=false;controls();redraw();}});
  document.addEventListener('visibilitychange',()=>{last=0;redraw();});new ResizeObserver(redraw).observe(stage);
  return {open};
};
