// The orbit inspector uses the reference plane and epoch stated below its drawing.
globalThis.createCatalogChart = function() {
  const el=id=>document.getElementById(id),canvas=el('catalog-orbit'),ctx=canvas.getContext('2d'),plot=el('catalog-plot');
  const images=new Map(),tau=Math.PI*2;
  let model=null,yaw=-.28,tilt=.70,zoom=1,phase=0,playing=false,frame=0,previous=0,drag=null;
  function getPhoto(url){if(!url)return null;if(!images.has(url)){const im=new Image();images.set(url,im);im.onload=draw;im.src=LabMedia.file(url);}const im=images.get(url);return im.naturalWidth?im:null;}
  function project(v){const x=v[0]*Math.cos(yaw)-v[1]*Math.sin(yaw),y=v[0]*Math.sin(yaw)+v[1]*Math.cos(yaw);return [x,y*Math.sin(tilt)-v[2]*Math.cos(tilt),y*Math.cos(tilt)+v[2]*Math.sin(tilt)];}
  function draw(){
    if(!model||!el('object-explorer').open)return;
    const w=plot.clientWidth,h=plot.clientHeight;if(w<2||h<2)return;
    const dpr=Math.min(2,window.devicePixelRatio||1),cw=Math.round(w*dpr),ch=Math.round(h*dpr);
    if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const m=model, lines=m.lines||[], paths=lines.map(line=>({...line,pts:line.points.filter(p=>p&&p.every(Number.isFinite)).map(project)}));
    const point=m.point?.(phase), marker=point&&point.every(Number.isFinite)?project(point):null;
    const raw=paths.flatMap(path=>path.pts);if(marker)raw.push(marker);
    const margin=17,bounds=[0,0,0,0],hostRadius=m.centerRadius||0;
    for(const v of raw){bounds[0]=Math.min(bounds[0],v[0]);bounds[1]=Math.max(bounds[1],v[0]);bounds[2]=Math.min(bounds[2],v[1]);bounds[3]=Math.max(bounds[3],v[1]);}
    if(hostRadius){bounds[0]=Math.min(-hostRadius,bounds[0]);bounds[1]=Math.max(hostRadius,bounds[1]);bounds[2]=Math.min(-hostRadius,bounds[2]);bounds[3]=Math.max(hostRadius,bounds[3]);}
    const scale=Math.min((w-2*margin)/Math.max(1e-8,bounds[1]-bounds[0]),(h-2*margin-10)/Math.max(1e-8,bounds[3]-bounds[2]))*.93*zoom;
    const cx=w*.5-(bounds[0]+bounds[1])*.5*scale,cy=h*.48-(bounds[2]+bounds[3])*.5*scale;
    function pathsAt(front){for(const line of paths){ctx.beginPath();ctx.lineWidth=line.width||1;ctx.strokeStyle=line.color||'#9ed2ca';ctx.setLineDash(line.dash||[]);let last=null;
      for(const p of line.pts){if(last&&((last[2]+p[2]>=0)===front)){ctx.moveTo(cx+last[0]*scale,cy+last[1]*scale);ctx.lineTo(cx+p[0]*scale,cy+p[1]*scale);}last=p;}ctx.stroke();}ctx.setLineDash([]);}
    if(m.cloud){const r=Math.min(h*.34,w*.30)*zoom;ctx.strokeStyle='#8ca6b57a';ctx.lineWidth=1;for(const rotation of [0,.8,1.57,2.35]){ctx.beginPath();ctx.ellipse(w*.5,h*.47,r,r*.43,rotation,0,tau);ctx.stroke();}ctx.setLineDash([2,4]);ctx.beginPath();ctx.arc(w*.5,h*.47,r,0,tau);ctx.stroke();ctx.setLineDash([]);}
    pathsAt(false);
    let radius=hostRadius*scale;
    if(!raw.length)radius=Math.min(h*.24,46);else radius=Math.max(m.center==='sun'?5:2.8,radius);
    radius=Math.min(radius,h*.75);
    const photo=m.centerPhoto?getPhoto(m.centerPhoto):m.center?getPhoto(m.center==='sun'?'assets/space/sun-radiant.webp':'assets/'+m.center+'.webp'):null;
    if(m.center==='sun'){
      const glow=ctx.createRadialGradient(cx,cy,radius*.72,cx,cy,radius*3.1);glow.addColorStop(0,'rgba(255,223,153,.8)');glow.addColorStop(.38,'rgba(255,195,100,.17)');glow.addColorStop(1,'rgba(251,161,58,0)');ctx.fillStyle=glow;ctx.fillRect(cx-radius*3.1,cy-radius*3.1,radius*6.2,radius*6.2);
    }
    if(photo){const factor=m.center==='saturn'?1.95:1;ctx.drawImage(photo,cx-radius*factor,cy-radius*factor,2*radius*factor,2*radius*factor);}
    else{ctx.fillStyle=m.center==='sun'?'#fff1c8':'#6e858c';ctx.beginPath();ctx.arc(cx,cy,raw.length?radius:9,0,tau);ctx.fill();}
    pathsAt(true);
    if(m.dots){ctx.fillStyle='#ccd8d7a6';for(const p of m.dots){const q=project(p);ctx.fillRect(cx+q[0]*scale,cy+q[1]*scale,1.2,1.2);}}
    if(marker){const x=cx+marker[0]*scale,y=cy+marker[1]*scale,behind=marker[2]<0&&Math.hypot(x-cx,y-cy)<radius;
      ctx.strokeStyle='#ffe0aa';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,behind?4:5.2,0,tau);ctx.stroke();if(!behind){ctx.fillStyle='#fff3d1';ctx.beginPath();ctx.arc(x,y,2,0,tau);ctx.fill();}}
    if(m.point){const days=phase*(m.duration||0),minutes=days*1440;el('catalog-clock').value=days>=1?'+'+days.toLocaleString('ko-KR',{maximumFractionDigits:1})+'일':'+'+Math.round(minutes).toLocaleString('ko-KR')+'분';}
  }
  function stop(){playing=false;cancelAnimationFrame(frame);previous=0;el('catalog-play').textContent='▶';el('catalog-play').setAttribute('aria-label','궤도 재생');el('catalog-play').setAttribute('aria-pressed','false');}
  function tick(now){if(!playing||!el('object-explorer').open){stop();return;}if(previous)phase=(phase+Math.min(.12,(now-previous)/1000)/18)%1;previous=now;el('catalog-phase').value=Math.round(phase*1000);draw();frame=requestAnimationFrame(tick);}
  el('catalog-play').onclick=()=>{if(playing){stop();return;}playing=true;el('catalog-play').textContent='Ⅱ';el('catalog-play').setAttribute('aria-pressed','true');el('catalog-play').setAttribute('aria-label','궤도 일시 정지');frame=requestAnimationFrame(tick);};
  el('catalog-phase').oninput=e=>{stop();phase=Number(e.target.value)/1000;draw();};
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);drag=[e.clientX,e.clientY];});canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-drag[0])*.009;tilt=Math.max(-1.53,Math.min(1.53,tilt+(e.clientY-drag[1])*.009));drag=[e.clientX,e.clientY];draw();});for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>{drag=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.6,Math.min(3,zoom*Math.exp(-e.deltaY*.001)));draw();},{passive:false});
  canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')yaw-=.12;if(e.key==='ArrowRight')yaw+=.12;if(e.key==='ArrowUp')tilt=Math.min(1.53,tilt+.12);if(e.key==='ArrowDown')tilt=Math.max(-1.53,tilt-.12);if(e.key==='+')zoom=Math.min(3,zoom*1.15);if(e.key==='-')zoom=Math.max(.6,zoom/1.15);draw();});
  new ResizeObserver(draw).observe(plot);
  return {stop,draw,set(value){stop();model=value;phase=0;zoom=1;yaw=-.28;tilt=.7;el('catalog-phase').value=0;el('catalog-time').hidden=!(value.point&&value.duration>0);el('catalog-plot-caption').textContent=value.caption||'';draw();}};
};
