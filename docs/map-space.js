// Perspective orbit camera and translations between the two reference frames.
globalThis.OrbitMapSpace = (() => {
  "use strict";
  const {dot,norm,cross,comb,eclGal,specs}=OrbitFrames;
  const M=GravityLab, clamp=(x,a,b)=>Math.max(a,Math.min(x,b));
  const subtract=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const along=(p,v,k)=>[p[0]+v[0]*k,p[1]+v[1]*k,p[2]+v[2]*k];
  const direction=norm(eclGal[1]); // Galactic +Y, the local circular-rotation direction.
  const speedInAU=230*M.SECONDS/M.AU;
  // Equatorial and polar radii in km. The dynamics continue to use point masses.
  const radii=[695700,2439.7,6051.8,6378.137,3396.2,71492,60268,25559,24764,1737.4,695700];
  const polarRadii=[695700,2439.7,6051.8,6356.752,3376.2,66854,54364,24973,24341,1737.4,695700];
  const polarRatio=i=>polarRadii[i]/radii[i];
  let history;
  function samples(run,id,t){if(t<0){history??=M.solve("control",1,365,16,-1);return M.read(history,id,t);}return M.read(run,id,t);}
  const logSpan=Math.log1p(30/.26);
  function scaleRadius(r){return 30*Math.log1p(r/.26)/logSpan;}
  function radial(point,inverse=false){
    const r=Math.hypot(point[0],point[1],point[2]);if(!r)return [0,0,0];
    const k=(inverse?.26*Math.expm1(r*logSpan/30):scaleRadius(r))/r;
    return [point[0]*k,point[1]*k,point[2]*k];
  }
  const compressed=s=>s.scope==="wide"&&!s.linearDistances&&!s.actualSize;
  function world(state,run,index,date){
    const point=samples(run,index,date);
    if(state.scope==="lunar")return subtract(point,samples(run,M.EARTH,date));
    if(state.reference==="galaxy"){
      let body=point;
      if(compressed(state)){
        const sun=samples(run,0,date);body=along(radial(subtract(point,sun)),sun,1);
      }
      return along(body,direction,(date-(state.fixedCamera?0:state.day))*speedInAU);
    }
    // A departed Sun leaves the origin in the original inertial frame.
    return subtract(point,samples(run,0,date));
  }
  function distance(a,b){return Math.hypot(...subtract(a,b));}
  function systemFrame(s){
    if(s.scope==="lunar"||s.scope==="sun")return {center:[0,0,0],span:s.scope==="lunar"?.00273:.00465,watch:[0,0,0]};
    if(s.reference==="galaxy"&&s.fixedCamera&&s.scope!=="near"){
      const center=direction.map(v=>v*speedInAU*M.DAYS*.45);
      const margin=s.scope==="wide"?26:Math.max(1.6,Math.hypot(...LabInitial.bodies[s.watch].p)*.65);
      return {center,span:speedInAU*M.DAYS*.41+margin,watch:center};
    }
    const current=s.applied?s.test:s.base;
    const watch=world(s,current,s.watch,s.day);
    if(s.scope==="wide")return {center:[0,0,0],span:32.2,watch};
    const all=[[0,0,0],watch,world(s,s.base,s.watch,s.day)];
    const future=s.day+90;
    // Fit future relative-system positions; the galaxy camera follows the current epoch.
    for(const run of [s.base,...(s.applied?[s.test]:[])]){
      const body=samples(run,s.watch,future),sun=samples(run,0,future);
      all.push(subtract(body,sun));
    }
    if(s.applied&&s.kind==="binary")all.push(world(s,s.test,M.COMPANION,s.day));
    const far=all.reduce((a,b)=>Math.hypot(...a)>Math.hypot(...b)?a:b);
    const center=far.map(v=>v*.22);
    const span=Math.max(1.42,...all.map(v=>distance(v,center)),.83*Math.hypot(...far));
    return {center,span,watch};
  }
  const envelopes=new WeakMap();
  // Fit the bodies and their actual one-year paths for this orientation, including a
  // rolling margin at both ends. Smoothly interpolate adjacent fits during playback.
  function trailEnvelope(s,run,right,up){
    const interval=20,t0=Math.floor(s.day/interval)*interval;
    let memo=envelopes.get(run);if(!memo){memo=new Map();envelopes.set(run,memo);}
    const orient=[...right,...up].map(x=>x.toFixed(5)).join('/');
    function bounds(epoch){
      const k=[epoch,orient,s.allFit,compressed(s)].join('|');if(memo.has(k))return memo.get(k);
      const b=[Infinity,-Infinity,Infinity,-Infinity],view={...s,day:epoch};
      const include=(x,y)=>{b[0]=Math.min(b[0],x);b[1]=Math.max(b[1],x);b[2]=Math.min(b[2],y);b[3]=Math.max(b[3],y);};
      for(const id of run.active){
        const n=id===1?96:48;
        for(let j=0;j<=n;j++){
          const date=epoch-365+365*j/n;if(id===M.COMPANION&&date<0)continue;
          const v=world(view,run,id,date);include(dot(v,right),dot(v,up));
        }
      }
      if(s.allFit){const r=compressed(s)?53:950;include(-r,-r);include(r,r);}
      const pad=compressed(s)?1.8:1.15;
      const out=[b[0]-pad,b[1]+pad,b[2]-pad,b[3]+pad];if(memo.size>=12)memo.delete(memo.keys().next().value);memo.set(k,out);return out;
    }
    const a=bounds(t0),b=bounds(t0+interval),u=(s.day-t0)/interval;return a.map((v,i)=>v+(b[i]-v)*u);
  }
  function wideGalacticCamera(p,s,run,zoom,yaw,pitch){
    const tall=p.h>p.w*1.16,az=-2.46+yaw,el=clamp(-1.07+pitch,-1.43,1.43);
    const front=[Math.cos(az)*Math.cos(el),Math.sin(az)*Math.cos(el),Math.sin(el)];
    let right=[-Math.sin(az),Math.cos(az),0],up=norm(cross(front,right));
    const roll=Math.atan2(dot(direction,up),dot(direction,right))-(tall?Math.PI/2-.10:.46);
    right=comb(right,up,Math.cos(roll),Math.sin(roll));up=norm(cross(front,right));
    const b=trailEnvelope(s,run,right,up);
    const mx=Math.min(p.w*.115,tall?45:84),top=Math.min(p.h*.23,tall?142:107),bottom=Math.min(p.h*.20,tall?100:83);
    const px=Math.min((p.w-2*mx)/Math.max(1,b[1]-b[0]),(p.h-top-bottom)/Math.max(1,b[3]-b[2]))*zoom;
    const midX=(b[0]+b[1])/2,midY=(b[2]+b[3])/2,center=comb(right,up,midX,midY);
    const ox=p.x+p.w*.5-midX*px,oy=p.y+(p.h+top-bottom)*.5+midY*px;
    const dist=Math.max(6000,px*10),eye=along(center,front,dist);
    function project(v){return {x:ox+dot(v,right)*px,y:oy-dot(v,up)*px,z:dist-dot(v,front),scale:px,inFront:true};}
    return {run,day:s.day,project,projectDisplay:project,orthographic:true,ox,oy,dist,px,near:.001,eye,front,up,right,center,principal:[.5,.49],focal:px*dist,skyFocal:Math.min(p.h*.85,p.w*.91),closeBody:null,pane:p};
  }
  function camera(p,s,run,range,zoom,yaw,pitch){
    const galaxy=s.reference==="galaxy", close=s.scope==="near";
    if(s.scope==="wide"&&galaxy&&!s.fixedCamera)return wideGalacticCamera(p,s,run,zoom,yaw,pitch);
    let focal=Math.min(p.h*.96,p.w*(close?.80:1.36));
    const pole=[0,0,1],az0=Math.atan2(LabInitial.bodies[s.watch].p[1],LabInitial.bodies[s.watch].p[0]);
    let right,up,front,eye,center,principal=[.50,.50],distanceToCenter;
    if(s.scope==="sun"){
      center=world(s,run,0,s.day);
      front=norm(subtract(world(s,run,M.EARTH,s.day),center));right=norm(cross(pole,front));up=norm(cross(front,right));
      const imageRadius=Math.min(p.w,p.h)*(s.sunBand==="euv"?.376:.43)*zoom;
      distanceToCenter=Math.hypot(1,focal/imageRadius)*radii[0]/M.AU;eye=along(center,front,distanceToCenter);
      principal=[.5+clamp(yaw,-4,4)*.20,.5+clamp(pitch,-3,3)*.20];
    }else if(s.scope==="wide"&&!galaxy){
      // Frame the ecliptic along the long dimension of the actual viewport.
      // A distant viewpoint limits perspective distortion across Neptune's orbit.
      const tall=p.h>p.w;
      const major=tall?p.h*.394:p.w*.451,minor=tall?p.w*.425:p.h*.361;
      const az=-2.24+yaw,el=clamp(-Math.asin(clamp(minor/major,.12,.95))+pitch,-1.44,1.44);
      front=[Math.cos(az)*Math.cos(el),Math.sin(az)*Math.cos(el),Math.sin(el)];
      right=[-Math.sin(az),Math.cos(az),0];up=norm(cross(front,right));
      const roll=tall?1.48:-.12;
      right=comb(right,up,Math.cos(roll),Math.sin(roll));up=norm(cross(front,right));
      center=[0,0,0];principal=[.50,.49];focal=major*9;
      distanceToCenter=(s.allFit?(compressed(s)?57:980):30.5)*9/zoom;eye=along(center,front,distanceToCenter);
    }else if(s.scope==="lunar"){
      const moon=LabInitial.bodies[M.MOON],earth=LabInitial.bodies[M.EARTH];
      const radial=norm(subtract(moon.p,earth.p)),normal=norm(cross(radial,subtract(moon.v,earth.v)));
      const transverse=norm(cross(normal,radial)),turn=comb(transverse,radial,Math.cos(yaw),Math.sin(yaw));
      const angle=clamp(.64+pitch,.05,3.09);
      front=norm(comb(normal,turn,Math.cos(angle),Math.sin(angle)));right=norm(cross(front,normal));up=norm(cross(front,right));
      center=[0,0,0];principal=[.50,.50];
      distanceToCenter=range.span*focal/(Math.min(p.w,p.h)*.36*zoom)+range.span*.22;
      eye=along(center,front,distanceToCenter);
    }else if(close){
      const tracked=world(s,run,s.watch,s.day),sun=world(s,run,0,s.day);
      const axis=OrbitFrames.frames[s.watch].slice(3,6),light=norm(subtract(sun,tracked));
      const noon=norm(comb(light,axis,1,-dot(light,axis))),east=norm(cross(axis,noon));
      const phase=.80+yaw,latitude=clamp((s.watch===6?.37:s.watch===5?-.16:.16)+pitch,-1.43,1.43);
      const horizon=comb(noon,east,Math.cos(phase),Math.sin(phase));
      front=norm(comb(horizon,axis,Math.cos(latitude),Math.sin(latitude)));
      right=norm(cross(axis,front));up=norm(cross(front,right));
      const roll=s.watch===6?-.24:.17;
      right=comb(right,up,Math.cos(roll),Math.sin(roll));up=norm(cross(front,right));
      // The tangent to the limb sets the apparent size even on a tall, narrow phone.
      const projectedRadius=Math.min(p.w,p.h)*.47*zoom/(s.watch===6?2.56:1);
      const radiiAway=Math.max(s.watch===6?2.45:1.055,Math.hypot(1,focal/projectedRadius));
      distanceToCenter=radiiAway*radii[s.watch]/M.AU;
      center=tracked;eye=along(tracked,front,distanceToCenter);
      principal=[p.w>p.h*1.3?.54:.50,.50];
    }else{
      if(galaxy){
        const crossPlane=norm(cross(pole,direction));
        const other=norm(cross(direction,crossPlane));
        const side=comb(crossPlane,other,Math.cos(yaw+.22),Math.sin(yaw+.22));
        const angle=clamp((s.fixedCamera?1.21:.52)+pitch,.065,2.98);
        front=norm(comb(direction,side,Math.cos(angle),Math.sin(angle)));
        up=norm(comb(direction,front,1,-dot(direction,front)));right=norm(cross(up,front));
        const roll=s.fixedCamera?(p.w>p.h?1.12:.28):.21;
        const rolledRight=comb(right,up,Math.cos(roll),Math.sin(roll));up=norm(cross(front,rolledRight));right=norm(rolledRight);
        principal=s.fixedCamera?[.50,.50]:[.49,.38];
      }else{
        const az=az0+1.08+yaw,el=clamp(.43+pitch,-1.43,1.43);
        front=[Math.cos(az)*Math.cos(el),Math.sin(az)*Math.cos(el),Math.sin(el)];
        right=[-Math.sin(az),Math.cos(az),0];up=norm(cross(front,right));
      }
      const focus=clamp(Math.log(Math.max(zoom,1))/Math.log(4),0,1);
      center=comb(range.center,range.watch,1-focus,focus);
      const screenRadius=Math.min(p.w*.40,p.h*(galaxy?.53:.67));
      distanceToCenter=range.span*focal/(screenRadius*zoom)+range.span*.53/zoom;
      eye=along(center,front,distanceToCenter);
    }
    const near=Math.max(1e-10,distanceToCenter*.012),cx=p.x+p.w*principal[0],cy=p.y+p.h*principal[1];
    function project(point){return projectDisplay(s.scope==="wide"&&!galaxy&&compressed(s)?radial(point):point);}
    function projectDisplay(displayed){
      const v=subtract(displayed,eye),z=-dot(v,front);
      const scale=focal/Math.max(near,z);
      return {x:cx+dot(v,right)*scale,y:cy-dot(v,up)*scale,z,scale,inFront:z>near};
    }
    return {run,day:s.day,skyFocal:s.scope==="wide"&&!galaxy?Math.min(p.h*.87,p.w*.95):focal,pane:p,closeBody:s.scope==="sun"?0:close?s.watch:null,project,projectDisplay,focal,eye,front,up,right,center,principal,near,dist:distanceToCenter,px:focal/distanceToCenter};
  }
  return {camera,world,systemFrame,radii,polarRatio,subtract,distance,clamp,speedInAU,direction,radial,compressed,scaleRadius};
})();
