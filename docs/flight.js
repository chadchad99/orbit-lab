// The optical camera is free to travel; the experiment clock belongs to GravityLab.
globalThis.createOrbitFlight=function(canvas,cpuCanvas,onCamera){
"use strict";
const D=Math.PI/180,TAU=2*Math.PI,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),
 dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], norm=a=>{const m=Math.hypot(...a)||1;return a.map(v=>v/m)},
 cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
 comb=(a,b,c,d)=>a.map((v,i)=>v*c+b[i]*d),sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
 mat=(m,v)=>[m[0]*v[0]+m[3]*v[1]+m[6]*v[2],m[1]*v[0]+m[4]*v[1]+m[7]*v[2],m[2]*v[0]+m[5]*v[1]+m[8]*v[2]];
const {specs,frames,panorama}=OrbitFrames;
const assets=new Map(),pending=new Map();let gpu,render,cpu=false,activeCanvas=canvas,needs=true,visible=false,failed=false;
try{gpu=OrbitOptics.make(canvas)}catch(err){console.warn("Optical renderer:",err.message)}
function useCPU(){cpu=true;canvas.hidden=true;cpuCanvas.hidden=false;activeCanvas=cpuCanvas;render=OrbitSoftware.make(cpuCanvas);cpuCanvas.parentElement.dataset.renderer="canvas";needs=true;}
if(!gpu)useCPU();else{render=gpu;canvas.parentElement.dataset.renderer="webgl";}
canvas.addEventListener("webglcontextlost",e=>{e.preventDefault();useCPU()});
const small=matchMedia("(max-width: 720px)").matches;
function ensure(name){if(assets.has(name)||pending.has(name))return;const im=new Image();pending.set(name,im);im.decoding="async";
  im.onload=()=>{assets.set(name,im);pending.delete(name);needs=true;};
  im.onerror=()=>{failed=true;needs=true;};let filename=name==="ring"?"saturn-ring.png":name+".webp";
  if(small&&["sky","earth","earth-night","earth-clouds"].includes(name))filename="lite-"+filename;
  im.src=LabMedia.file("assets/space/"+filename);}
const reduced=matchMedia("(prefers-reduced-motion: reduce)");
let auto=!reduced.matches,lastWall=null,lastPaint=-1e5,elapsed=0,index=3,yaw=specs[3][4]*D,pitch=16*D,zoom=1,near=0,targetNear=0,drift=0,xSpeed=0,ySpeed=0,rise=false,riseTime=0,touching=false,h0=false,lastHeight=-1;
const pointers=new Map();let pinch=0;
const info=()=>({auto,rise,near:targetNear===1,zoom,english:specs[index][0],height:lastHeight,ready:h0,failed});
function changed(){needs=true;onCamera?.(info());}
function setPlanet(i){if(!specs[i]?.length)return;index=i;yaw=specs[i][4]*D;pitch=specs[i][5]*D;zoom=1;near=targetNear=0;rise=false;riseTime=0;xSpeed=ySpeed=0;drift=0;const id=LabInitial.bodies[i].id;
  if(visible)for(const k of ["sky",id,...(i===3?["earth-night","earth-clouds","earth-ocean"]:i===6?["ring"]:[])])ensure(k);
  h0=false;changed();}
function zoomBy(k){zoom=clamp(zoom*k,.72,2.05);changed();}
function setNear(v){rise=false;targetNear=v?1:0;zoom=1;if(reduced.matches)near=targetNear;changed();}
function setRise(){targetNear=near=1;rise=true;riseTime=0;zoom=1;xSpeed=ySpeed=0;changed();}
function toggleAuto(){auto=!auto;changed();}
function setVisible(val){const first=val&&!visible;visible=val;if(first){const id=LabInitial.bodies[index].id;for(const k of ["sky",id,...(index===3?["earth-night","earth-clouds","earth-ocean"]:index===6?["ring"]:[])])ensure(k);}lastWall=null;needs=true;if(!val){xSpeed=ySpeed=0;}}
function metric(m){if(m!==lastHeight){lastHeight=m;onCamera?.(info());}}
function scene(s,w,h){
 const sp=specs[index],id=LabInitial.bodies[index].id,f=OrbitFrames.bodyFrame(index,s.applied?s.test:s.base,s.day);
 let lon=yaw,lat=pitch,roll=.40+near*.12;
 if(rise){
   const meet=s.applied?s.test:s.base,here=GravityLab.read(meet,index,s.day),sunPos=GravityLab.read(meet,0,s.day);
   const world=norm(sub(sunPos,here)),l=[0,1,2].map(j=>dot(world,f.slice(j*3,j*3+3)));
   const east=norm(cross([0,1,0],l)),north=norm(cross(l,east)),edge=comb(east,north,.94,Math.sqrt(1-.94*.94));
   const cameraD=1+((index===6?1.65:1.135)-1)/zoom,ang=Math.asin(1/cameraD)+.006+Math.min(.025,riseTime*.00062);
   const face=comb(l,edge,-Math.cos(ang),Math.sin(ang));lon=Math.atan2(face[0],face[2]);lat=Math.asin(clamp(face[1],-1,1));yaw=lon;pitch=lat;
   const rr=[Math.cos(lon),0,-Math.sin(lon)],uu=cross(face,rr);roll=Math.atan2(-dot(l,rr),dot(l,uu))+.045;
 }
 const front=[Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon)],r0=[Math.cos(lon),0,-Math.sin(lon)],u0=cross(front,r0),right=comb(r0,u0,Math.cos(roll),Math.sin(roll)),up=comb(u0,r0,Math.cos(roll),-Math.sin(roll));
 const vb=[...right,...up,...front],worldCamera=[mat(f,right),mat(f,up),mat(f,front)],vg=worldCamera.flatMap(panorama);
 const run=s.applied?s.test:s.base,p=GravityLab.read(run,index,s.day),sst=GravityLab.read(run,0,s.day),ls=sub(sst,p),r1=Math.max(.012,Math.hypot(...ls)),d0=Math.hypot(...LabInitial.bodies[index].p);
 const camLight=v=>{const n=norm(v);return worldCamera.map(axis=>dot(n,axis))};
 const starOn=s.applied&&s.kind==="binary",hasSun=!(s.applied&&(s.kind==="vanish"||s.kind==="black")),ls2=starOn?sub(GravityLab.read(run,GravityLab.COMPANION,s.day),p):[0,0,1],r2=Math.max(.012,Math.hypot(...ls2));
 // Local camera exposure is calibrated to the target's initial sunlight. Keep that gain in the experiment.
 const flux=hasSun?Math.min(8,(d0/r1)**2):0,flux2=starOn?Math.min(8,(d0/r2)**2):0;
 const aspect=w/h, mobile=aspect<1.03,far=index===6?4.25:2.36,nearD=index===6?1.65:1.135;
 const baseDist=far*(1-near)+nearD*near,dist=1+(baseDist-1)/zoom;
 const centreFar=mobile?.55:.51,centreNear=mobile?.59:.61;
 const focusX=(mobile?.505:.66)*(1-near)+(mobile?.62:.62)*near,focusY=centreFar*(1-near)+centreNear*near;
 metric(Math.round((dist-1)*sp[1]));
 return {id,body:index,dist,tilt:near*Math.asin(1/dist),focus:[focusX,focusY],air:sp[6],airColor:sp[7],sun:camLight(ls),star:camLight(ls2),flux,flux2,sunSize:Math.min(.09,.00465/r1),starSize:Math.min(.09,.00465/r2),skyPower:hasSun?(rise?.27:.40):.78,cloudsDrift:drift*.000018,viewToBody:vb,viewToGal:vg};}
function draw(s,now){
 if(!visible)return;const delta=lastWall===null?0:clamp((now-lastWall)/1000,0,.085);lastWall=now;
 const transition=Math.abs(near-targetNear)>.0008;if(transition){near+=(targetNear-near)*(1-Math.exp(-delta*4.4));needs=true;}else if(near!==targetNear){near=targetNear;needs=true;}
 if(auto&&!touching){if(rise)riseTime+=delta;else yaw+=delta*(.0105+near*.023);drift+=delta;needs=true;}
 if(!touching&&(Math.abs(xSpeed)+Math.abs(ySpeed)>.0001)){yaw+=xSpeed*delta;pitch=clamp(pitch+ySpeed*delta,-1.35,1.35);const k=Math.exp(-delta*6);xSpeed*=k;ySpeed*=k;needs=true;}
 const cadence=cpu?(touching||transition?65:135):1000/32;
 if(now-lastPaint<cadence||!needs&&!s.running)return;
 const rect=activeCanvas.getBoundingClientRect();if(rect.width<2||rect.height<2)return;
 const required=[LabInitial.bodies[index].id,"sky",...(index===3?["earth-night","earth-clouds","earth-ocean"]:index===6?["ring"]:[])];
 if(!required.every(k=>assets.has(k)))return;
 if(!h0){h0=true;failed=false;onCamera?.(info());}
 let ratio=cpu?Math.min(1,860/rect.width,600/rect.height):Math.min(devicePixelRatio||1,1.8,2500/rect.width,1550/rect.height);
 const w=Math.max(2,Math.round(rect.width*ratio)),h=Math.max(2,Math.round(rect.height*ratio));
 if(activeCanvas.width!==w||activeCanvas.height!==h){activeCanvas.width=w;activeCanvas.height=h;}
 try{render(scene(s,w,h),assets);}catch(err){if(!cpu){useCPU();return}throw err;}
 activeCanvas.style.opacity="1";needs=false;lastPaint=now;
}
function focusBody(i){setPlanet(i);lastWall=null;}
function interact(node){
 node.addEventListener("pointerdown",e=>{if(e.button&&e.pointerType!=="touch")return;node.setPointerCapture(e.pointerId);if(rise){rise=false;changed();}pointers.set(e.pointerId,[e.clientX,e.clientY]);touching=true;node.classList.add("drag");xSpeed=ySpeed=0;pinch=pointers.size===2?Math.hypot(...Array.from(pointers.values()).reduce((a,b)=>[a[0]-b[0],a[1]-b[1]])):0;});
 node.addEventListener("pointermove",e=>{const old=pointers.get(e.pointerId);if(!old)return;const x=e.clientX,y=e.clientY;pointers.set(e.pointerId,[x,y]);
 if(pointers.size===2){const a=[...pointers.values()],n=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);if(pinch>0)zoomBy(n/pinch);pinch=n;return;}
 const scale=.0043/Math.sqrt(zoom)*(1.-.40*near);const dx=-(x-old[0])*scale,dy=(y-old[1])*scale;yaw+=dx;pitch=clamp(pitch+dy,-1.35,1.35);xSpeed=reduced.matches?0:clamp(dx*13,-1.4,1.4);ySpeed=reduced.matches?0:clamp(dy*13,-1.4,1.4);needs=true;});
 function end(e){if(!pointers.delete(e.pointerId))return;touching=pointers.size>0;if(!touching)node.classList.remove("drag");pinch=0;}
 for(const t of ["pointerup","pointercancel","lostpointercapture"])node.addEventListener(t,end);
 node.addEventListener("wheel",e=>{e.preventDefault();zoomBy(Math.exp(-clamp(e.deltaY*(e.deltaMode?15:1),-200,200)*.0017));},{passive:false});
 node.addEventListener("keydown",e=>{const keys={ArrowLeft:[-.10,0],ArrowRight:[.10,0],ArrowUp:[0,.08],ArrowDown:[0,-.08]};if(keys[e.key]){e.preventDefault();if(rise){rise=false;changed();}yaw+=keys[e.key][0];pitch=clamp(pitch+keys[e.key][1],-1.35,1.35);needs=true;}else if(["+","=","-"].includes(e.key)){e.preventDefault();zoomBy(e.key==="-"?.85:1.18)}});}
interact(canvas);interact(cpuCanvas);new ResizeObserver(()=>{needs=true}).observe(canvas.parentElement);
reduced.addEventListener?.("change",e=>{if(e.matches){auto=false;xSpeed=ySpeed=0;near=targetNear;changed();}});
setPlanet(3);return {draw,focusBody,zoomBy,setNear,setRise,toggleAuto,setVisible,info,invalidate:()=>{needs=true}};
};
