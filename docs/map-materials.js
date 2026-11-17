// Small planet images are rendered from a sphere for the current camera and lights.
// The same surface, cloud, city-light and ring materials are used in the flight window.
globalThis.createMapMaterials = function createMapMaterials(invalidate) {
  "use strict";
  const {dot,norm,cross,specs,frames}=OrbitFrames;
  const {subtract,distance,radii,clamp}=OrbitMapSpace;
  const assets=new Map(),pending=new Set(),stamps=new Map();
  const work=document.createElement("canvas"),paint=OrbitSoftware.make(work,{cutout:true,maxMapWidth:1024});
  const tau=2*Math.PI, identity=[1,0,0,0,1,0,0,0,1];
  // The close camera draws directly into a viewport-sized buffer, independently of map symbols.
  const opticCanvas=document.createElement("canvas"),fallbackCanvas=document.createElement("canvas");
  let closeDraw,closeCanvas,closeGPU=false,currentBody="",detailEpoch=0;
  const detail=new Map(),requested=new Set();
  function software(){closeGPU=false;closeCanvas=fallbackCanvas;closeDraw=OrbitSoftware.make(closeCanvas,{cutout:true,maxMapWidth:3072});}
  function setup(){
    if(closeDraw)return;
    try{closeDraw=OrbitOptics.make(opticCanvas,{cutout:true});}catch{}
    if(closeDraw){closeGPU=true;closeCanvas=opticCanvas;}else software();
  }
  opticCanvas.addEventListener("webglcontextlost",e=>{e.preventDefault();software();invalidate();});
  function filename(key){
    if(key==="ring")return "saturn-ring-close.png";
    if(key==="moon")return "moon-lite.webp";
    if(key==="jupiter")return "jupiter-preview.webp";
    return (["earth","earth-night","earth-clouds"].includes(key)?"lite-":"")+key+".webp";
  }
  function load(key){
    if(assets.has(key)||pending.has(key))return;
    pending.add(key);
    const image=new Image();image.decoding="async";
    image.onload=()=>{assets.set(key,image);pending.delete(key);stamps.clear();invalidate();};
    image.onerror=()=>pending.delete(key);
    image.src=LabMedia.file("assets/space/"+filename(key));
  }
  function requestDetail(key,file,priority){
    if(requested.has(file))return;
    requested.add(file);
    const epoch=detailEpoch,im=new Image();im.decoding="async";
    im.onload=()=>{
      if(epoch!==detailEpoch)return;
      if((detail.get(key)?.priority??0)<priority){detail.set(key,{im,priority});invalidate();}
    };
    im.onerror=()=>{if(epoch===detailEpoch)requested.delete(file);};
    im.src=LabMedia.file("assets/space/"+file);
  }
  function encounter(ctx,c,q,files,lighting,ratio){
    setup();
    const p=c.pane,id=lighting.id;
    if(currentBody!==id){currentBody=id;detailEpoch++;detail.clear();requested.clear();}
    const large=closeGPU&&p.w>=740;
    if(id==="jupiter"){
      requestDetail(id,"jupiter-lite.webp",1);
      if(large&&detail.has(id))requestDetail(id,"jupiter-close.webp",2);
    }else if(id==="moon"){requestDetail("moon","moon.webp",1);
    }else if(id==="saturn"){load("ring");
    }else if(id==="earth"){
      for(const key of ["earth","earth-clouds","earth-night"])requestDetail(key,key+".webp",1);
      if(large&&detail.size>=3){
        requestDetail("earth","earth-close.webp",2);
        requestDetail("earth-clouds","clouds-close.webp",2);
        if(!lighting.flux||c.dist*GravityLab.AU/radii[3]<2)requestDetail("earth-night","night-close.webp",2);
      }
    }
    const maps=new Map(files.map(key=>[key,detail.get(key)?.im??assets.get(key)]));
    if(!maps.get(id))return false;
    const resolution=closeGPU?Math.min(ratio,2,2560/Math.max(p.w,p.h)):Math.min(1,850/Math.max(p.w,p.h));
    const width=Math.max(2,Math.round(p.w*resolution)),height=Math.max(2,Math.round(p.h*resolution));
    if(closeCanvas.width!==width||closeCanvas.height!==height){closeCanvas.width=width;closeCanvas.height=height;}
    closeDraw({...lighting,dist:c.dist*GravityLab.AU/radii[q.index],tanHalfFov:p.h/(2*c.focal),
      ringProfile:id==="saturn"?1:0,focus:[c.principal[0],1-c.principal[1]],polarRatio:OrbitMapSpace.polarRatio(q.index)},maps);
    ctx.drawImage(closeCanvas,p.x,p.y,p.w,p.h);return true;
  }
  function unresolved(ctx,q,flux){
    if(flux<=.00001)return;
    const radius=clamp(q.radius,.49,1.2);
    ctx.fillStyle="rgba(212,219,226,"+clamp((.36+q.radius*.34)*Math.sqrt(flux),.08,.9)+")";
    ctx.beginPath();ctx.arc(q.x,q.y,radius,0,tau);ctx.fill();
  }
  function planet(ctx,q,camera,lights,ratio){
    const index=q.index,id=LabInitial.bodies[index].id,sp=specs[index],earth=index===3,saturn=index===6;
    const natural=GravityLab.read(camera.run,index,camera.day);
    const toSun=subtract(lights.physicalSun,natural),toSecond=subtract(lights.physicalCompanion,natural);
    const initial=Math.hypot(...LabInitial.bodies[index].p),solarRange=Math.max(.018,Math.hypot(...toSun)),companionRange=Math.max(.018,Math.hypot(...toSecond));
    // Local exposure preserves visible surface detail on distant planets. Sources still obey inverse square falloff.
    const flux=lights.primary?Math.min(6,(initial/solarRange)**2):0,flux2=lights.secondary?Math.min(6,(initial/companionRange)**2):0;
    const observer=norm(subtract(camera.eye,q.position));
    const primary=norm(toSun),secondary=norm(toSecond);
    if(q.radius<.92){unresolved(ctx,q,flux*(1+dot(observer,primary))/2+flux2*(1+dot(observer,secondary))/2);return;}
    const files=[id,...(earth?["earth-clouds","earth-night","earth-ocean"]:saturn?["ring"]:[])];
    files.forEach(load);
    const right=norm(cross(camera.up,observer)),up=norm(cross(observer,right)),axes=[right,up,observer];
    const toView=direction=>axes.map(axis=>dot(axis,direction));
    const sun=toView(primary),second=toView(secondary);
    const basis=OrbitFrames.bodyFrame(index,camera.run,camera.day),viewToBody=axes.flatMap(v=>[0,3,6].map(i=>dot(v,basis.slice(i,i+3))));
    const lighting={id,body:index,tilt:0,air:sp[6],airColor:sp[7],sun,star:second,flux,flux2,viewToBody,viewToGal:identity,
      cloudsDrift:0,skyPower:0,sunSize:0,starSize:0,longitudeShift:OrbitFrames.surfaceShift(index,camera.day),
      polarRatio:OrbitMapSpace.polarRatio(index),ringProfile:saturn?1:0,ringPhase:saturn?SaturnRings.frame(camera.day):null};
    if(camera.closeBody===index&&encounter(ctx,camera,q,files,lighting,ratio))return;
    if(!assets.has(id)){unresolved(ctx,{...q,radius:.9},flux+flux2);return;}
    const physicalDistance=distance(camera.eye,q.position)*GravityLab.AU/radii[index];
    const d=clamp(physicalDistance,2.5,1800),extent=saturn?2.41:1.055;
    const size=Math.max(6,Math.min(640,Math.ceil(2*q.radius*extent*clamp(ratio*1.25,1.45,2.3)/2)*2));
    const rotationBins=Math.min(100,Math.max(6,Math.ceil(q.radius*1.6)));
    const key=[index,size,Math.round(lighting.longitudeShift*rotationBins),...(saturn?lighting.ringPhase.s.concat(lighting.ringPhase.c).map(v=>Math.round(v*40)):[]),Math.round(d*10),...sun.map(v=>Math.round(v*180)),...second.map(v=>Math.round(v*140)),...viewToBody.map(v=>Math.round(v*135)),Math.round(flux*130),Math.round(flux2*130)].join("/");
    let stamp=stamps.get(key);
    if(!stamp){
      work.width=work.height=size;
      paint({...lighting,dist:d,tanHalfFov:extent/Math.sqrt(d*d-1),focus:[.5,.5]},assets);
      stamp=document.createElement("canvas");stamp.width=stamp.height=size;stamp.getContext("2d").drawImage(work,0,0);
      if(stamps.size>=64)stamps.delete(stamps.keys().next().value);
      stamps.set(key,stamp);
    }
    const half=q.radius*extent;ctx.drawImage(stamp,q.x-half,q.y-half,2*half,2*half);
  }
  return {planet};
};
