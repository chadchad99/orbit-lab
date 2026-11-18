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
  function galacticOffset(v){
    const expanded=radial(v);
    // Enlarge only across the direction of travel. Stretching this component
    // as well can make Mercury appear to reverse through the Galaxy.
    return along(expanded,direction,dot(v,direction)-dot(expanded,direction));
  }
  const compressed=s=>s.scope==="wide"&&!s.linearDistances&&!s.actualSize;
  function world(state,run,index,date){
    const point=samples(run,index,date);
    if(state.scope==="lunar")return subtract(point,samples(run,M.EARTH,date));
    if(state.reference==="galaxy"){
      let body=point;
      if(compressed(state)){
        const sun=samples(run,0,date);body=along(galacticOffset(subtract(point,sun)),sun,1);
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
  const envelopes=new WeakMap(),playbackBounds=new WeakMap();
  const skyBank=p=>.46+.80*clamp((p.h/p.w-1)/.9,0,1);
  const skyFocalLength=p=>Math.min(p.h*.98,p.w*(p.h>p.w?.87:1.02));
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
    // Look from the same side of the track as the flight camera. Establish
    // the roll once, so dragging across the direction of travel cannot flip it.
    const az=2.10,el=-1.05;
    let front=[Math.cos(az)*Math.cos(el),Math.sin(az)*Math.cos(el),Math.sin(el)];
    let right=[-Math.sin(az),Math.cos(az),0],up=norm(cross(front,right));
    // Roll the same sky and trajectories together so a tall viewport can use
    // its vertical field without cropping the outer planets.
    const portrait=clamp((p.h/p.w-1)/.9,0,1),trackAngle=skyBank(p);
    const roll=Math.atan2(dot(direction,up),dot(direction,right))-trackAngle;
    right=comb(right,up,Math.cos(roll),Math.sin(roll));up=norm(cross(front,right));
    [front,right,up]=turnFrame(front,right,up,yaw,pitch);
    const b=trailEnvelope(s,run,right,up);
    if(run.kind==="control"){
      // Keep a full playback block in frame. Move the framing only while
      // overlapping two blocks, so ordinary orbital motion never pumps the zoom.
      const block=M.DAYS,t=Math.floor(s.day/block)*block,u=(s.day-t)/block;
      let memo=playbackBounds.get(run);
      if(!memo){memo=new Map();playbackBounds.set(run,memo);}
      function blockBounds(start){
        const key=["playback",start,s.allFit,compressed(s),...right,...up].join("|");
        let bounds=memo.get(key);
        if(!bounds){
          bounds=[Infinity,-Infinity,Infinity,-Infinity];
          for(let day=Math.max(0,start-block);day<=start+block;day+=block/8){
            const sample=trailEnvelope({...s,day},run,right,up);
            bounds[0]=Math.min(bounds[0],sample[0]);bounds[1]=Math.max(bounds[1],sample[1]);
            bounds[2]=Math.min(bounds[2],sample[2]);bounds[3]=Math.max(bounds[3],sample[3]);
          }
          if(memo.size>=16)memo.delete(memo.keys().next().value);
          memo.set(key,bounds);
        }
        return bounds;
      }
      const a=blockBounds(t),next=blockBounds(t+block),blend=u*u*(3-2*u);
      for(let i=0;i<4;i++){
        const limit=a[i]+(next[i]-a[i])*blend;
        b[i]=i%2?Math.max(b[i],limit):Math.min(b[i],limit);
      }
    }
    const mx=Math.min(p.w*.10,84),top=Math.min(p.h*(.17+.06*portrait),107+56*portrait),bottom=Math.min(p.h*(.12+.08*portrait),83+26*portrait);
    const px=Math.min((p.w-2*mx)/Math.max(1,b[1]-b[0]),(p.h-top-bottom)/Math.max(1,b[3]-b[2]))*zoom;
    const midX=(b[0]+b[1])/2,midY=(b[2]+b[3])/2,center=comb(right,up,midX,midY);
    const ox=p.x+p.w*.5-midX*px,oy=p.y+(p.h+top-bottom)*.5+midY*px;
    const dist=Math.max(6000,px*10),eye=along(center,front,dist);
    function project(v){return {x:ox+dot(v,right)*px,y:oy-dot(v,up)*px,z:dist-dot(v,front),scale:px,inFront:true};}
    const skyFocal=skyFocalLength(p)*zoom;
    return {run,day:s.day,project,projectDisplay:project,orthographic:true,surveySky:true,ox,oy,dist,px,near:.001,eye,front,up,right,center,principal:[.5,.49],focal:px*dist,skyFocal,closeBody:null,pane:p};
  }
  const cruising=s=>s.cruise&&s.scope==="wide"&&s.reference==="galaxy"&&!s.fixedCamera&&!s.allFit;
  // Follow the Sun in its translating frame using the orientation of its track.
  const outward=norm([.92,.34,.24]);
  const broadside=norm(comb(outward,direction,1,-dot(outward,direction)));
  const transverse=cross(direction,broadside);
  function turnFrame(front,right,up,yaw,pitch){
    // Orbit about the screen's up and right axes, including its current roll.
    if(yaw){
      const co=Math.cos(yaw),si=Math.sin(yaw);
      [front,right]=[comb(front,right,co,si),comb(right,front,co,-si)];
    }
    if(pitch){
      const co=Math.cos(pitch),si=Math.sin(pitch);
      [front,up]=[comb(front,up,co,si),comb(up,front,co,-si)];
    }
    return [front,right,up];
  }
  function cruiseCamera(p,s,run,zoom,yaw,pitch,travel){
    const heading=1.13,angle=2.59;
    const side=comb(broadside,transverse,Math.cos(heading),Math.sin(heading));
    let front=comb(direction,side,Math.cos(angle),Math.sin(angle));
    const track=comb(direction,side,Math.sin(angle),-Math.cos(angle));
    const portrait=p.h>p.w;
    const bank=skyBank(p);
    let right=comb(track,cross(front,track),Math.cos(bank),-Math.sin(bank)),up=cross(front,right);
    [front,right,up]=turnFrame(front,right,up,yaw,pitch);
    // Zoom with the lens and shift the aim toward the selected body. Lateral
    // camera travel gives nearby orbits parallax without rotating the sky.
    const sun=world(s,run,0,s.day),focus=clamp(Math.log(Math.max(1,zoom))/Math.log(4),0,1);
    const dist=42-1.8*(1-focus)*Math.sin(travel*.052);
    const center=comb(along(sun,direction,-9.5),world(s,run,s.watch,s.day),1-focus,focus);
    const drift=1-focus;
    for(let i=0;i<3;i++)center[i]+=drift*(right[i]*1.15*Math.sin(travel*.080)+up[i]*.6*Math.sin(travel*.053));
    const eye=along(center,front,dist),near=Math.max(.018,dist*.004);
    const focal=skyFocalLength(p)*zoom,principal=portrait?[.46,.55]:[.48,.60];
    const cx=p.x+p.w*principal[0],cy=p.y+p.h*principal[1];
    function project(v){
      const x=v[0]-eye[0],y=v[1]-eye[1],z=v[2]-eye[2];
      const depth=-(x*front[0]+y*front[1]+z*front[2]),scale=focal/Math.max(near,depth);
      return {x:cx+scale*(x*right[0]+y*right[1]+z*right[2]),y:cy-scale*(x*up[0]+y*up[1]+z*up[2]),z:depth,scale,inFront:depth>near};
    }
    return {cruising:true,surveySky:true,run,day:s.day,pane:p,project,projectDisplay:project,dist,near,eye,front,up,right,center,principal,focal,skyFocal:focal,px:focal/dist,closeBody:null};
  }
  const desktopPane={x:0,y:0,w:1120,h:720};
  function fitOverview(c,p){
    // Preserve the desktop composition. The extra space on a portrait screen
    // looks farther into the sky, while labels and touch controls stay legible.
    const scale=Math.min(p.w/desktopPane.w,p.h/desktopPane.h);
    const left=p.x+(p.w-desktopPane.w*scale)/2,top=p.y+(p.h-desktopPane.h*scale)/2;
    function fit(q){q.x=left+q.x*scale;q.y=top+q.y*scale;q.scale*=scale;return q;}
    const principal=[(left-p.x+c.principal[0]*desktopPane.w*scale)/p.w,
                     (top-p.y+c.principal[1]*desktopPane.h*scale)/p.h];
    const fitted={...c,pane:p,principal,overviewScale:scale,overviewShortSide:desktopPane.h,
      focal:c.focal*scale,skyFocal:c.skyFocal*scale,px:c.px*scale,
      project:v=>fit(c.project(v)),projectDisplay:v=>fit(c.projectDisplay(v))};
    if(c.orthographic){fitted.ox=left+c.ox*scale;fitted.oy=top+c.oy*scale;}
    return fitted;
  }
  function camera(p,s,run,range,zoom,yaw,pitch,travel=0){
    if(cruising(s))return cruiseCamera(p,s,run,zoom,yaw,pitch,travel);
    if(s.scope==="wide"&&s.reference==="galaxy"&&!s.fixedCamera)return wideGalacticCamera(p,s,run,zoom,yaw,pitch);
    if(s.scope==="wide"&&(p.h>p.w||p.w<900)){
      return fitOverview(camera(desktopPane,s,run,range,zoom,yaw,pitch),p);
    }
    const galaxy=s.reference==="galaxy", close=s.scope==="near";
    let focal=Math.min(p.h*.96,p.w*(close?.80:1.36));
    const pole=[0,0,1],az0=Math.atan2(LabInitial.bodies[s.watch].p[1],LabInitial.bodies[s.watch].p[0]);
    let right,up,front,eye,center,principal=[.50,.50],distanceToCenter;
    if(s.flyby){
      ({center,front,right,up,focal,principal,dist:distanceToCenter}=OrbitFlyby.pose(p,s,run));
      eye=along(center,front,distanceToCenter);
    }else if(s.scope==="sun"){
      center=world(s,run,0,s.day);
      front=norm(subtract(world(s,run,M.EARTH,s.day),center));right=norm(cross(pole,front));up=norm(cross(front,right));
      const imageRadius=Math.min(p.w,p.h)*(s.sunBand==="euv"?.376:.43)*zoom;
      distanceToCenter=Math.hypot(1,focal/imageRadius)*radii[0]/M.AU;eye=along(center,front,distanceToCenter);
      principal=[.5+clamp(yaw,-4,4)*.20,.5+clamp(pitch,-3,3)*.20];
    }else if(s.scope==="wide"&&!galaxy){
      // A distant viewpoint limits perspective distortion across Neptune's orbit.
      const major=p.w*.451,minor=p.h*.361;
      const az=-2.24+yaw,el=clamp(-Math.asin(clamp(minor/major,.12,.95))+pitch,-1.44,1.44);
      front=[Math.cos(az)*Math.cos(el),Math.sin(az)*Math.cos(el),Math.sin(el)];
      right=[-Math.sin(az),Math.cos(az),0];up=norm(cross(front,right));
      const roll=-.12;
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
    return {run,day:s.day,flyby:!!s.flyby,surveySky:!!s.flyby||s.scope==="wide"&&galaxy,skyFocal:s.scope==="wide"&&!galaxy?Math.min(p.h*.87,p.w*.95):focal,pane:p,closeBody:s.scope==="sun"?0:close?s.watch:null,project,projectDisplay,focal,eye,front,up,right,center,principal,near,dist:distanceToCenter,px:focal/distanceToCenter};
  }
  return {camera,cruising,world,systemFrame,radii,polarRatio,subtract,distance,clamp,speedInAU,direction,radial,galacticOffset,compressed,scaleRadius};
})();
