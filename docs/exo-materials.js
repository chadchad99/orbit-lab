// The same optical passes as the Solar System, with individually authored maps,
// two possible light sources, and an emissive photosphere for each host.
globalThis.createExoMaterials=function(redraw){
  "use strict";
  const images=new Map(),pending=new Set(),stamps=new Map(),frames=new Map(),colours=new Map();
  const {dot,norm,cross}=OrbitFrames,tau=Math.PI*2,identity=[1,0,0,0,1,0,0,0,1],black=[0,0,0];
  const folder='assets/exoplanets/',closeFolder=folder+'detail/';
  const work=document.createElement('canvas'),paint=OrbitSoftware.make(work,{cutout:true,maxMapWidth:768});
  let high,highPaint,gpu=false,detailTarget='',detailSession=0,active='',generation=0;
  const detail=new Map();
  const keyFor=(sys,b)=>sys.id+'-'+(b.star?'star-'+b.id.toLowerCase():b.id);
  function rgb(hex){
    if(!colours.has(hex))colours.set(hex,[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255));
    return colours.get(hex);
  }
  function load(key,path,highRes=false){
    const bank=highRes?detail:images,token=highRes?detailSession:generation,tag=key+'|'+token+'|'+highRes;
    if(bank.has(key)||pending.has(tag))return;
    pending.add(tag);const im=new Image();im.decoding='async';
    im.onload=()=>{pending.delete(tag);if(token!==(highRes?detailSession:generation))return;bank.set(key,im);stamps.delete(key.split(':')[0]);redraw();};
    im.onerror=()=>pending.delete(tag);
    const resolved=LabMedia.file(path);im.src=resolved===path&&path.startsWith(folder)?path+'?v=surface2':resolved;
  }
  function selectDetail(key){
    if(key===detailTarget)return;detailSession++;detailTarget=key;detail.clear();
  }
  function prepare(sys){
    if(active!==sys.id){
      generation++;active=sys.id;selectDetail('');stamps.clear();frames.clear();
      for(const key of images.keys())if(key!=='corona')images.delete(key);
    }
    load('corona','assets/space/corona-optical.webp');
    for(const b of sys.bodies){
      const key=keyFor(sys,b);load(key,folder+key+'.webp');
      if(b.appearance.kind==='coast')load(key+':cloud',folder+key+'-weather.webp');
    }
  }
  function setupHigh(){
    if(highPaint)return;
    high=document.createElement('canvas');
    try{highPaint=OrbitOptics.make(high,{cutout:true});}catch{}
    if(highPaint){
      gpu=true;high.addEventListener('webglcontextlost',e=>{e.preventDefault();high=null;highPaint=null;useCPU();stamps.clear();redraw();});
    }else useCPU();
  }
  function useCPU(){gpu=false;high=document.createElement('canvas');highPaint=OrbitSoftware.make(high,{cutout:true,maxMapWidth:2048});}
  function glow(ctx,p,day){
    const {r,x,y,body}=p,t=body.tint;
    const halo=ctx.createRadialGradient(x,y,r*.83,x,y,r*3.3);
    for(const [v,alpha] of [[0,'d4'],[.12,'85'],[.29,'37'],[.59,'0c'],[1,'00']])halo.addColorStop(v,t+alpha);
    ctx.save();ctx.fillStyle=halo;ctx.fillRect(x-r*3.3,y-r*3.3,r*6.6,r*6.6);
    const source=images.get('corona');
    if(source){
      ctx.translate(x,y);ctx.rotate(body.appearance.meridian*tau+(body.id==='B'?1.2:0));
      ctx.globalCompositeOperation='screen';const reach=r/.30;
      const time=(day*7+body.appearance.meridian*24)%24,start=Math.floor(time),mix=time-start;
      for(const [f,weight] of [[start,1-mix],[(start+1)%24,mix]]){
        const id=t+f;
        if(!frames.has(id)){
          const tile=document.createElement('canvas');tile.width=tile.height=320;
          const g=tile.getContext('2d');g.drawImage(source,(f%6)*320,Math.floor(f/6)*320,320,320,0,0,320,320);
          g.globalCompositeOperation='source-atop';g.globalAlpha=.67;g.fillStyle=t;g.fillRect(0,0,320,320);
          frames.set(id,tile);
        }
        ctx.globalAlpha=.90*weight;ctx.drawImage(frames.get(id),-reach/2,-reach/2,reach,reach);
      }
    }
    ctx.restore();
  }
  function fallback(ctx,p,lights){
    const r=p.r,t=p.body.tint??'#bcaa98',l=lights?.[0]?.dir??[0,.2,.8];
    const x=p.x+r*l[0]*.62,y=p.y-r*l[1]*.62;
    const g=ctx.createRadialGradient(x,y,0,x,y,r*(1.1+.48*l[2]));
    g.addColorStop(0,p.body.star?'#fff3da':t);g.addColorStop(.64,p.body.star?t:'#756d66');g.addColorStop(1,p.body.star?t:'#08090b');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,r,0,tau);ctx.fill();
  }
  function body(ctx,p,sys,axes,stars,day,focus,dpr){
    const b=p.body,key=keyFor(sys,b),a=b.appearance,gas=['gas','mist'].includes(a.kind),water=a.kind==='coast',ice=a.kind==='ice';
    if(focus){
      setupHigh();selectDetail(key);load(key,closeFolder+key+'.webp',true);
      if(!b.star)load(key+':relief',closeFolder+key+'-material.webp',true);
      if(water)load(key+':cloud',closeFolder+key+'-weather.webp',true);
    }
    const albedo=(focus&&detail.get(key))||images.get(key);
    const source=b.star?[]:ExoOrbits.lights(p.physical,stars);
    const rays=source.map(s=>({...s,dir:axes.map(v=>dot(v,s.dir))}));
    if(!b.star&&!rays.length){
      ctx.fillStyle='#050609';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,tau);ctx.fill();return;
    }
    if(!albedo){fallback(ctx,p,rays);return;}
    const maps=new Map([[key,albedo]]);
    const relief=key+':relief',weather=key+':cloud';
    if(focus&&detail.has(relief))maps.set(relief,detail.get(relief));
    if(water&&(detail.get(weather)||images.get(weather)))maps.set(weather,detail.get(weather)??images.get(weather));
    const total=rays.reduce((sum,s)=>sum+s.power,0)||1;
    const power=i=>rays[i]?1.70*rays[i].power*rays[i].visible/total:0;
    const tint=i=>rays[i]?rgb(rays[i].tint).map(n=>.10+.90*n**1.38):black;
    const phase=((day%b.spinDays)/b.spinDays+1)%1,spin=a.meridian-phase;
    const pole=ExoOrbits.pole(b);
    const east=norm(cross(pole,[0,-1,0])),prime=cross(east,pole);
    const viewToBody=axes.flatMap(v=>[dot(v,east),dot(v,pole),dot(v,prime)]);
    const light=rays[0]?.dir??[0,0,1],second=rays[1]?.dir??[0,0,1];
    const limit=focus?(gpu?1800:640):180,actual=Math.max(16,Math.min(limit,Math.ceil(p.r*(focus?1.08:1.20)*dpr)*2));
    const fp=focus?220:46;
    const signature=[focus,actual,maps.size,focus&&detail.has(key),Math.round(spin*fp),...viewToBody.map(n=>Math.round(n*fp)),
      ...light.map(n=>Math.round(n*fp)),...second.map(n=>Math.round(n*fp)),Math.round(power(0)*fp),Math.round(power(1)*fp)].join('/');
    let stamp=stamps.get(key);
    if(stamp?.signature!==signature){
      const can=focus?high:work,draw=focus?highPaint:paint;if(can.width!==actual||can.height!==actual)can.width=can.height=actual;
      draw({id:key,body:0,dist:15,focus:[.5,.5],tanHalfFov:1.045/Math.sqrt(224),tilt:0,emissive:b.star,
        air:b.star?0:gas?.64:water?.56:ice?.09:.035,airColor:gas?(a.kind==='mist'?[.19,.47,.8]:[.62,.43,.24]):water?[.07,.31,.69]:[.31,.36,.42],
        sun:light,star:second,flux:power(0),flux2:power(1),sunTint:b.star?rgb(b.tint):tint(0),secondTint:tint(1),
        viewToBody,viewToGal:identity,longitudeShift:spin,polarRatio:gas?.951:1,
        materialKey:maps.has(relief)?relief:null,cloudKey:maps.has(weather)?weather:null,
        surfaceParams:[maps.has(relief)?(gas?.29:.94):0,water?.95:ice?.62:0,maps.has(weather)?.85:0,gas?.009*Math.sin(day*.64):0],
        cloudsDrift:(day%49)/49,sunSize:0,starSize:0,skyPower:0},maps);
      if(!stamp){stamp={canvas:document.createElement('canvas')};stamps.set(key,stamp);}
      const out=stamp.canvas;if(out.width!==actual||out.height!==actual)out.width=out.height=actual;
      const g=out.getContext('2d');g.clearRect(0,0,actual,actual);g.drawImage(can,0,0);stamp.signature=signature;
    }
    const reach=p.r*1.045;ctx.drawImage(stamp.canvas,p.x-reach,p.y-reach,2*reach,2*reach);
  }
  return {prepare,glow,body,leaveFocus:()=>selectDetail('')};
};
