globalThis.createExoViewer=function(onClose){
  "use strict";
  const el=id=>document.getElementById(id),dialog=el('exo-view'),canvas=el('exo-map'),ctx=canvas.getContext('2d');
  const picker=el('exo-system'),target=el('exo-target'),rateMenu=el('exo-rate');
  const {dot,cross,norm,comb}=OrbitFrames,M=ExoOrbits,tau=2*Math.PI;
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const format=(v,d=2)=>v.toLocaleString('ko-KR',{maximumFractionDigits:d});
  const links=new Set(Array.from(picker.options,o=>o.value)),models=new Map(),pointers=new Map();
  const material=createExoMaterials(schedule),ink=['#dcc3a5','#96b6be','#c3b29c','#91bec1','#b9a5ae','#b4c4ac','#99b8cb','#c2b9aa'];
  let sky,system,task=0,selected='',days=0,rate=.25,manualRate=false,playing=true,linear=false,paths=true,event=null;
  let frame=0,last=null,lastDay='',yaw=.58,elevation=.57,roll=-.22,zoom=1,starsBasis,spots=[],gesture,galactic=true;
  for(const r of [.25,.5,1,2,3,5,10,15,30,45,90])rateMenu.add(new Option(r+'×',r));
  function button(id,pressed){el(id).setAttribute('aria-pressed',String(pressed));}
  function sync(){
    if(!system)return;
    const body=system.bodies.find(b=>b.id===selected);
    target.value=selected;el('exo-home').hidden=!body;
    dialog.dataset.reference=galactic?'galaxy':'host';
    button('exo-galaxy',galactic);button('exo-host',!galactic);
    el('exo-summary').textContent=system.className+' · '+format(system.distancePc*3.26156,1)+'광년 · 행성 '+system.planets.length+'개'+(galactic&&!body?' · 지난 '+system.trailDays+'일':'');
    el('exo-readout').textContent=!body?'':body.star?
      '질량 '+format(body.massSolar,3)+' 태양질량'+(body.kelvin?' · 표면 '+format(body.kelvin,0)+' K':''):
      '공전 '+format(body.period,3)+'일 · '+format(body.axis,4)+' AU · 반지름 지구의 '+format(body.radiusEarth,2)+'배 · '+(body.locked?'동주기 자전 가정':'자전 '+format(body.spinDays*24,1)+'시간 가정');
    el('exo-play').textContent=playing?'Ⅱ 일시정지':'▶ 재생';button('exo-play',playing);
    el('exo-event').textContent=event?'원래 궤도로':system.binary?'두 별 없애기':'중심별 없애기';
    button('exo-event',!!event);button('exo-paths',paths);button('exo-linear',linear);
    el('exo-paths').disabled=el('exo-linear').disabled=!!body;
    el('exo-minus').disabled=zoom<=.56;el('exo-plus').disabled=zoom>=5;
    for(const o of target.options)if(o.value==='A'||o.value==='B')o.disabled=!!event;
    rateMenu.value=String(rate);
  }
  function chooseBody(id){
    selected=system?.bodies.some(b=>b.id===id&&(!event||!b.star))?id:'';
    zoom=1;sync();schedule();
  }
  function terminal(text){el('exo-status').textContent=text;}
  function details(sys){
    el('exo-description').textContent=sys.binary?
      '두 별은 질량중심을 약 41일마다 돌고, 행성은 두 별을 함께 약 229일마다 돕니다. 관측 논문의 초기 궤도 요소에서 두 케플러 궤도를 독립적으로 계산했습니다.':
      '행성마다 관측된 공전 주기와 궤도 크기를 적용했습니다. 통과 시각을 기준으로 원궤도를 근사하며, 행성 사이의 중력 섭동은 생략했습니다.';
    const links=el('exo-links');links.replaceChildren();
    el('exo-motion').textContent='은하 중심 기준 속도 약 '+format(sys.speed,0)+' km/s. 고유운동과 시선속도에 태양의 은하 공전 속도(230 km/s)를 더해 짧은 구간을 직선으로 근사했습니다. 궤도면의 하늘 방향은 일부 가정했습니다. 기본 화면은 행성 간격과 항성 이동 거리를 각각 압축합니다. ‘거리 비례’에서 같은 축척으로 봅니다.';
    for(const [name,url] of [['NASA 외계행성 자료',sys.source],['쌍성 궤도 연구',sys.orbitSource],['별의 공간운동',sys.motion.source!==sys.source?sys.motion.source:null]]){
      if(!url)continue;const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noreferrer';a.textContent=name+' ↗';
      if(links.childNodes.length)links.append(' · ');links.append(a);
    }
  }
  async function activate(id){
    const ticket=++task;picker.value=id;system=null;selected='';event=null;spots=[];
    last=null;lastDay='';days=0;zoom=1;yaw=.58;elevation=.57;terminal('궤도 자료를 여는 중…');
    target.replaceChildren(new Option('항성계 전체',''));el('exo-summary').textContent='';el('exo-readout').textContent='';
    ctx.clearRect(0,0,canvas.width,canvas.height);
    try{
      if(!models.size){const d=await LabCatalog.load('exoplanets.json');for(const s of d.systems)models.set(s.id,M.system(s));}
      if(ticket!==task||!dialog.open)return;
      system=models.get(id);material.prepare(system);
      starsBasis=system.basis;galactic=true;resetOrientation();
      for(const b of system.bodies)target.add(new Option(b.name+(b.star?' · 항성':''),b.id));
      if(!manualRate)rate=id==='trappist-1'?.25:id==='kepler-90'?1:3;
      details(system);terminal('');sync();schedule();
    }catch{
      if(ticket===task&&dialog.open)terminal('궤도 자료를 열지 못했습니다. 항성계를 다시 선택해 주세요.');
    }
  }
  function schedule(){if(dialog.open&&!document.hidden&&!frame)frame=requestAnimationFrame(tick);}
  function advance(now){
    if(last!=null&&playing&&system)days+=Math.max(0,now-last)*rate/1000;
    last=now;
  }
  function tick(now){
    frame=0;if(!dialog.open||document.hidden||!system)return;
    advance(now);draw();
    const clock=format(Math.floor(days*10)/10,1)+'일';if(clock!==lastDay){el('exo-day').textContent=clock;lastDay=clock;}
    if(playing)schedule();
  }
  function resetOrientation(){
    yaw=.58;elevation=.57;roll=-.22;zoom=1;
    if(galactic){
      const g=norm(system.velocity);
      yaw=Math.atan2(g[1],g[0])+1.10;elevation=g[2]>.60?-.48:.48;
      const [right,up]=axes();
      roll+=Math.atan2(dot(g,up),dot(g,right))-.40;
    }
  }
  function reference(value){
    if(!system)return;galactic=value;selected='';resetOrientation();sync();schedule();
  }
  el('exo-galaxy').onclick=()=>reference(true);el('exo-host').onclick=()=>reference(false);
  function axes(){
    const ce=Math.cos(elevation),se=Math.sin(elevation),cy=Math.cos(yaw),sy=Math.sin(yaw);
    const front=[cy*ce,sy*ce,se],x=[-sy,cy,0],y=cross(front,x);
    const right=comb(x,y,Math.cos(roll),Math.sin(roll));return [right,cross(front,right),front];
  }
  function draw(){
    const w=dialog.clientWidth,h=dialog.clientHeight;if(!w||!h)return;
    const dpr=Math.min(2,devicePixelRatio||1);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){
      canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const view=axes(),[right,up,front]=view,world=v=>[0,1,2].map(k=>v.reduce((sum,n,j)=>sum+n*starsBasis[j][k],0));
    sky??=createMapSky(el('exo-sky'),schedule,false);
    sky(w,h,dpr,[{pane:{x:0,y:0,w,h},camera:{right:world(right),up:world(up),front:world(front),principal:[.5,.5],focal:Math.min(w,h)*.76},exposure:selected?.33:event?.76:.53}]);
    const mobile=w<650,land=h<455&&w>=500;
    const top=Math.min(h*.40,Math.max(el('exo-target').getBoundingClientRect().bottom+14,land?77:mobile?152:145));
    const bottom=land?49:mobile?120:84,cx=w*.5,cy=(h+top-bottom)/2;
    const bodies=(event?system.planets:system.bodies).map(body=>{
      const physical=M.position(body,days,event),factor=M.displayFactor(body,system.outer,linear);
      return {body,physical,factor};
    });
    const focus=bodies.find(p=>p.body.id===selected),stars=bodies.filter(p=>p.body.star);
    const drift=galactic?M.travelVector(system,linear):[0,0,0],span=system.trailDays;
    const trailLength=Math.hypot(...drift)*span;
    const reach=bodies.reduce((max,p)=>Math.max(max,Math.hypot(...p.physical)*p.factor),1);
    const cameraDistance=5.5*Math.max(1,trailLength*.61,reach);
    const vx=dot(drift,right),vy=dot(drift,up),vz=dot(drift,front);
    function projected(v,f,t){
      const z=dot(v,front)*f+vz*t,k=cameraDistance/Math.max(.1,cameraDistance-z);
      return {x:(dot(v,right)*f+vx*t)*k,y:(dot(v,up)*f+vy*t)*k,z,k};
    }
    // The eye follows the middle of the visible history. All bodies and all
    // trail samples share the same camera, projection, and depth ordering.
    const centerTime=galactic?.5*span:0,bounds=[Infinity,-Infinity,Infinity,-Infinity];
    function include(q){
      bounds[0]=Math.min(bounds[0],q.x);bounds[1]=Math.max(bounds[1],q.x);
      bounds[2]=Math.min(bounds[2],q.y);bounds[3]=Math.max(bounds[3],q.y);
      return q;
    }
    for(const p of bodies){
      p.projected=include(projected(p.physical,p.factor,centerTime));p.z=p.projected.z;
      if(focus)continue;
      if(!galactic&&!event){
        p.ellipse=p.body.path.map(v=>include(projected(v,p.factor,0)));
      }
      const duration=galactic?span:event?Math.min(span,Math.max(0,days-event.day)):(p.body.orbit?.period||0)*.19;
      if(duration>0&&(galactic||p.body.orbit)){
        p.trace=M.trace(p.body,days,duration,event).map(row=>include(projected(row.p,p.factor,row.t-days+centerTime)));
      }
    }
    const pad=Math.min(w*.13,mobile?46:85),halfH=Math.max(25,(h-top-bottom)/2);
    const scale=Math.min((w-2*pad)/Math.max(.15,bounds[1]-bounds[0]),2*Math.max(20,halfH-Math.min(halfH*.24,35))/Math.max(.15,bounds[3]-bounds[2]))*zoom;
    const ox=cx-(bounds[0]+bounds[1])*.5*scale,oy=cy+(bounds[2]+bounds[3])*.5*scale;
    const base=clamp(Math.min(w/930,h/650),.53,1.32)*zoom**.32;
    for(const p of bodies){
      p.x=ox+p.projected.x*scale;p.y=oy-p.projected.y*scale;
      p.r=base*p.projected.k*(p.body.star?(p.body.id==='B'?15:18+9*Math.sqrt(p.body.radiusSolar)):(5.8+4.4*Math.sqrt(p.body.radiusEarth)));
    }
    if(focus){focus.x=cx;focus.y=cy;focus.r=Math.min(w*.40,Math.max(38,(h-top-bottom)*.435))*zoom;
    }else if(paths){
      ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
      const stroke=(path,start,end)=>{
        ctx.beginPath();const first=path[start];ctx.moveTo(ox+first.x*scale,oy-first.y*scale);
        for(let j=start+1;j<=end;j++){const q=path[j];ctx.lineTo(ox+q.x*scale,oy-q.y*scale);}
        ctx.stroke();
      };
      for(const p of bodies){
        const b=p.body,colour=b.star?(b.id==='B'?'#eca27f':'#f0cb88'):ink[system.planets.indexOf(b)%ink.length];
        if(p.ellipse?.length){ctx.strokeStyle=colour;ctx.globalAlpha=.30;ctx.lineWidth=.8;stroke(p.ellipse,0,p.ellipse.length-1);}
        if(!p.trace)continue;
        ctx.strokeStyle=colour;
        const n=p.trace.length-1;
        for(let band=0;band<8;band++){
          const age=(band+1)/8;ctx.globalAlpha=.16+.67*age**1.25;
          ctx.lineWidth=(b.star?1.14:.79)+.76*age;
          stroke(p.trace,Math.floor(n*band/8),Math.floor(n*(band+1)/8));
        }
      }
      ctx.restore();
    }
    const visible=focus?[focus]:bodies.sort((a,b)=>a.z-b.z).filter(p=>p.x+p.r>=0&&p.x-p.r<=w&&p.y+p.r>=0&&p.y-p.r<=h);
    for(const p of visible)if(p.body.star)material.glow(ctx,p);
    for(const p of visible){
      if(p.body.star)material.star(ctx,p);
      else material.planet(ctx,p,system,view,stars,days,!!focus,dpr);
    }
    spots=[];
    if(!focus)labelBodies(visible,w,h,mobile);
  }
  function labelBodies(all,w,h,mobile){
    ctx.font=(mobile?'11':'12')+'px "Lab Korean", sans-serif';ctx.textBaseline='middle';
    const occupied=all.map(p=>({x:p.x-p.r-2,y:p.y-p.r-2,w:p.r*2+4,h:p.r*2+4}));
    const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
    for(const p of all){
      spots.push({x:p.x,y:p.y,r:p.r,id:p.body.id,z:p.z});
      const name=p.body.star?(system.binary?'항성 '+p.body.id:system.designation):'행성 '+p.body.id;
      const width=ctx.measureText(name).width+5;
      let box;
      for(const extra of [0,12,25,45]){
        for(const [dx,dy] of [[1,-.42],[-1,.55],[1,.7],[-1,-.58],[0,-1],[0,1]]){
          const r=p.r+5+extra,x=p.x+dx*r-(1-dx)*width/2,y=p.y+dy*r-7;
          const b={x,y,w:width,h:14};
          if(x>=3&&x+width<w-3&&y>=3&&y+14<h-5&&!occupied.some(a=>overlaps(a,b))){box=b;break;}
        }
        if(box)break;
      }
      if(!box)continue;
      const tx=clamp(p.x,box.x,box.x+box.w),ty=clamp(p.y,box.y,box.y+box.h),dist=Math.hypot(tx-p.x,ty-p.y);
      if(dist>p.r+7){ctx.strokeStyle='#a2b6bc7a';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(p.x+(tx-p.x)*p.r/dist,p.y+(ty-p.y)*p.r/dist);ctx.lineTo(tx,ty);ctx.stroke();}
      ctx.shadowColor='#030509';ctx.shadowBlur=4;ctx.fillStyle=p.body.star?'#f2ddbb':'#cadae0';ctx.fillText(name,box.x+2,box.y+7);ctx.shadowBlur=0;
      occupied.push(box);spots.push({box,id:p.body.id});
    }
  }
  function point(e){const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];}
  function pick(x,y){
    const hit=spots.filter(p=>p.r&&Math.hypot(p.x-x,p.y-y)<=Math.max(9,p.r+2)).sort((a,b)=>b.z-a.z)[0];
    if(hit)return hit.id;
    return spots.find(p=>p.box&&x>=p.box.x&&x<=p.box.x+p.box.w&&y>=p.box.y&&y<=p.box.y+p.box.h)?.id;
  }
  function changeZoom(k){zoom=clamp(zoom*k,.56,5);sync();schedule();}
  function toggle(){if(!system)return;advance(performance.now());playing=!playing;sync();schedule();}
  el('exo-play').onclick=toggle;rateMenu.onchange=()=>{advance(performance.now());rate=Number(rateMenu.value);manualRate=true;schedule();};
  el('exo-event').onclick=()=>{
    if(!system)return;advance(performance.now());
    if(event){event=null;terminal('');}
    else{event=M.removeStars(system,days);if(system.stars.some(s=>s.id===selected))selected='';playing=true;terminal('중심별 제거 · 행성은 관성으로 이동합니다');}
    sync();schedule();
  };
  el('exo-paths').onclick=()=>{paths=!paths;sync();schedule();};
  el('exo-linear').onclick=()=>{linear=!linear;sync();schedule();};
  el('exo-plus').onclick=()=>changeZoom(1.24);el('exo-minus').onclick=()=>changeZoom(1/1.24);
  target.onchange=()=>chooseBody(target.value);el('exo-home').onclick=()=>chooseBody('');
  const gap=()=>{const [a,b]=pointers.values();return Math.hypot(a[0]-b[0],a[1]-b[1]);};
  canvas.onpointerdown=e=>{
    if(e.button!==0)return;canvas.setPointerCapture(e.pointerId);const xy=point(e);pointers.set(e.pointerId,xy);
    if(pointers.size===1)gesture={start:xy,last:xy,moved:false};
    if(pointers.size===2){gesture.pinch=true;gesture.distance=gap();gesture.zoom=zoom;}
  };
  canvas.onpointermove=e=>{
    const xy=point(e);if(!pointers.has(e.pointerId)){canvas.style.cursor=pick(...xy)?'pointer':'grab';return;}
    pointers.set(e.pointerId,xy);if(pointers.size===2&&gesture.pinch){zoom=clamp(gesture.zoom*gap()/Math.max(1,gesture.distance),.56,5);sync();schedule();return;}
    if(!gesture||gesture.pinch)return;const [x,y]=xy,[px,py]=gesture.last;
    if(Math.hypot(x-gesture.start[0],y-gesture.start[1])>4)gesture.moved=true;
    if(gesture.moved){yaw-=(x-px)*.007;elevation=clamp(elevation+(y-py)*.006,-1.49,1.49);schedule();}
    gesture.last=xy;
  };
  function finish(e,clicked){
    if(!pointers.has(e.pointerId))return;
    if(clicked&&gesture&&!gesture.moved&&!gesture.pinch){const id=pick(...point(e));if(id)chooseBody(id);}
    pointers.delete(e.pointerId);if(!pointers.size)gesture=null;
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  }
  canvas.onpointerup=e=>finish(e,true);canvas.onpointercancel=e=>finish(e,false);canvas.onlostpointercapture=e=>finish(e,false);
  canvas.addEventListener('wheel',e=>{e.preventDefault();changeZoom(Math.exp(-clamp(e.deltaY*(e.deltaMode===1?16:1),-280,280)*.0018));},{passive:false});
  canvas.onkeydown=e=>{
    if(e.code==='Space'){e.preventDefault();e.stopPropagation();toggle();return;}
    if(['+','=','-'].includes(e.key)){e.preventDefault();changeZoom(e.key==='-'?.82:1.22);return;}
    if(e.key.startsWith('Arrow')){e.preventDefault();yaw+=((e.key==='ArrowRight')-(e.key==='ArrowLeft'))*.11;elevation=clamp(elevation+((e.key==='ArrowUp')-(e.key==='ArrowDown'))*.1,-1.49,1.49);schedule();}
  };
  function route(){
    const match=/^#system\/([a-z0-9-]+)$/.exec(location.hash);
    if(!match||!links.has(match[1])){if(dialog.open)dialog.close();return;}
    if(!dialog.open){dialog.showModal();playing=true;last=null;}
    if(!system||system.id!==match[1])activate(match[1]);
  }
  el('exo-open').onclick=()=>{history.pushState({exoFromMap:true},'','#system/'+picker.value);route();};
  picker.onchange=()=>{history.replaceState(history.state,'','#system/'+picker.value);route();};
  el('exo-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{
    task++;cancelAnimationFrame(frame);frame=0;last=null;pointers.clear();gesture=null;system=null;target.value='';
    if(/^#system\//.test(location.hash)){
      if(history.state?.exoFromMap)history.back();
      else history.replaceState(null,'',location.pathname+location.search);
    }
    onClose();
  });
  new ResizeObserver(schedule).observe(dialog);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){last=null;schedule();}});
  window.addEventListener('hashchange',route);window.addEventListener('popstate',route);
  return {route};
};
