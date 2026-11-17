// Exoplanet surfaces are authored illustrations. The existing optical renderers
// shade them from the instantaneous directions and relative flux of the host stars.
globalThis.createExoMaterials=function(redraw){
  "use strict";
  const images=new Map(),pending=new Set(),stamps=new Map(),colouredStars=new Map();
  const identity=[1,0,0,0,1,0,0,0,1],tau=2*Math.PI;
  let work,software,closeCanvas,closeDraw;
  function load(id,path){
    if(images.has(id)||pending.has(id))return;
    pending.add(id);const im=new Image();im.decoding="async";
    im.onload=()=>{pending.delete(id);images.set(id,im);redraw();};
    im.onerror=()=>pending.delete(id);im.src=LabMedia.file(path);
  }
  function prepare(sys){
    load('photosphere','assets/space/sun-radiant.webp');
    for(const p of sys.planets)load(sys.id+'-'+p.id,'assets/exoplanets/'+sys.id+'-'+p.id+'.webp');
  }
  function starImage(tint){
    if(colouredStars.has(tint))return colouredStars.get(tint);
    const im=images.get('photosphere');if(!im)return null;
    const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
    const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);
    const src=g.getImageData(0,0,c.width,c.height),d=src.data;
    const rgb=[1,3,5].map(i=>parseInt(tint.slice(i,i+2),16)/255);
    for(let i=0;i<d.length;i+=4){
      const value=(d[i]*.30+d[i+1]*.59+d[i+2]*.11)/255;
      for(let k=0;k<3;k++)d[i+k]=Math.min(255,255*value*rgb[k]*(1.02+.12*value));
    }
    g.putImageData(src,0,0);colouredStars.set(tint,c);return c;
  }
  function glow(ctx,p){
    const r=p.r,halo=ctx.createRadialGradient(p.x,p.y,r*.78,p.x,p.y,r*3.4),t=p.body.tint;
    halo.addColorStop(0,t+'d0');halo.addColorStop(.11,t+'79');halo.addColorStop(.32,t+'2b');halo.addColorStop(.65,t+'0b');halo.addColorStop(1,t+'00');
    ctx.fillStyle=halo;ctx.fillRect(p.x-r*3.4,p.y-r*3.4,r*6.8,r*6.8);
  }
  function star(ctx,p){
    const im=starImage(p.body.tint),r=p.r;
    if(im){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.body.id==='B'?1.91:-.13);ctx.drawImage(im,-r,-r,2*r,2*r);ctx.restore();return;}
    ctx.fillStyle=p.body.tint;ctx.beginPath();ctx.arc(p.x,p.y,r,0,tau);ctx.fill();
  }
  function planet(ctx,p,sys,axes,stars,day,focus,dpr){
    const key=sys.id+'-'+p.body.id,im=images.get(key),r=p.r;
    if(!stars.length){
      ctx.fillStyle='#06080c';ctx.beginPath();ctx.arc(p.x,p.y,r,0,tau);ctx.fill();return;
    }
    const rays=stars.map(star=>{
      const v=star.physical.map((n,i)=>n-p.physical[i]),d=Math.hypot(...v)||1;
      return {dir:axes.map(axis=>OrbitFrames.dot(axis,v)/d),flux:star.body.luminosity/(d*d)};
    });
    const f=rays.reduce((a,b)=>a+b.flux,0),light=rays[0].dir,other=rays[1]?.dir||[0,0,1];
    if(!im){
      const x=p.x+.77*r*light[0],y=p.y-.77*r*light[1];
      const shade=ctx.createRadialGradient(x,y,0,x,y,r*(1.05+.66*light[2]));
      shade.addColorStop(0,'#b9aea0');shade.addColorStop(.60,'#716963');shade.addColorStop(1,'#090b10');
      ctx.fillStyle=shade;ctx.beginPath();ctx.arc(p.x,p.y,r,0,tau);ctx.fill();return;
    }
    // Adapt the camera exposure to the world so both bright and dim hosts remain readable.
    const flux=1.48*rays[0].flux/f,flux2=rays[1]?1.48*rays[1].flux/f:0;
    const size=focus?Math.min(900,Math.max(60,Math.ceil(r*2.1*dpr/2)*2)):Math.min(130,Math.max(12,Math.ceil(r*1.3*dpr)*2));
    const id=p.body.id.charCodeAt(0),rotation=id*.136-(day%p.body.spinDays)/p.body.spinDays;
    const spin=rotation-Math.floor(rotation);
    const signature=[key,size,focus?1:0,Math.round(spin*(focus?200:32)),...light.map(n=>Math.round(n*(focus?115:34))),...other.map(n=>Math.round(n*35)),Math.round(flux*40),...axes.flat().map(n=>Math.round(n*75))].join('/');
    let entry=stamps.get(key);
    if(!entry||entry.signature!==signature){
      if(!work){work=document.createElement('canvas');software=OrbitSoftware.make(work,{cutout:true,maxMapWidth:768});}
      if(focus&&!closeCanvas){
        closeCanvas=document.createElement('canvas');
        try{closeDraw=OrbitOptics.make(closeCanvas,{cutout:true});}catch{}
        closeCanvas.addEventListener('webglcontextlost',e=>{e.preventDefault();closeDraw=null;stamps.clear();redraw();});
      }
      const gpu=focus&&closeDraw,can=gpu?closeCanvas:work,actual=gpu?size:Math.min(focus?276:92,size);
      if(can.width!==actual||can.height!==actual)can.width=can.height=actual;
      const viewToBody=axes.flatMap(v=>[v[0],v[2],-v[1]]);
      const lit={id:key,body:0,dist:18,tanHalfFov:1.055/Math.sqrt(323),focus:[.5,.5],tilt:0,
        air:p.body.radiusEarth>2?.40:.025,airColor:[.17,.23,.29],sun:light,star:other,flux,flux2,
        sunSize:0,starSize:0,skyPower:0,cloudsDrift:0,viewToBody,viewToGal:identity,longitudeShift:spin};
      (gpu||software)(lit,images);
      if(!entry){entry={canvas:document.createElement('canvas')};stamps.set(key,entry);}
      const dest=entry.canvas;if(dest.width!==actual||dest.height!==actual)dest.width=dest.height=actual;
      const g=dest.getContext('2d');g.clearRect(0,0,actual,actual);g.drawImage(can,0,0);entry.signature=signature;
    }
    const reach=r*1.055;ctx.drawImage(entry.canvas,p.x-reach,p.y-reach,2*reach,2*reach);
  }
  return {prepare,glow,star,planet};
};
