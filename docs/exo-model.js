// Units: AU, days, BJD. Display scaling is applied only after solving an orbit.
globalThis.ExoOrbits=(()=>{
  "use strict";
  const O=CatalogOrbits;
  const vectorScale=(v,k)=>v.map(n=>n*k);
  function orbit(row){
    const e=row.e||0,w=row.w||0,node=row.node||0;
    // With common, unmeasured sky nodes, the diagram plane is the system's
    // nearly edge-on plane rotated 90 degrees toward a face-on view.
    return {q:row.a*(1-e),e,w,node,i:row.tracked?row.inc:(row.inc??90)-90,skyElements:!!row.tracked,period:row.period,
      epoch:row.epoch??row.transit,mean:row.meanAnomaly??(row.meanLongitude==null?90-w:row.meanLongitude-w-node)};
  }
  function spaceMotion(data){
    const {dot,cross,norm,comb}=OrbitFrames,cam=CosmicSky.camera(data.ra,data.dec,1);
    const basis=[cam.right,cam.front,norm(cross(cam.right,cam.front))],m=data.motion;
    // West and toward the observer have the opposite signs to increasing RA and recession.
    const k=4.74047*data.distancePc/1000;
    const tangent=comb(cam.right,cam.up,-k*m.pmRaCosDec,k*m.pmDec);
    const heliocentric=comb(tangent,cam.front,1,-m.radialKmS);
    const kmS=comb(heliocentric,OrbitMapSpace.direction,1,OrbitMapSpace.speedInAU*GravityLab.AU/GravityLab.SECONDS);
    return {basis,heliocentricLyYr:heliocentric.map(v=>v/299792.458),speed:Math.hypot(...kmS),velocity:basis.map(axis=>dot(kmS,axis)*GravityLab.SECONDS/GravityLab.AU)};
  }
  function system(data,appearances={}){
    const binary=data.binary&&orbit(data.binary);
    const members=data.components??data.stars;
    const mass=members.reduce((sum,b)=>sum+b.massSolar,0);
    const companions=members.map((star,i)=>{
      const tracked=data.binary?.tracked??members[1]?.id;
      const share=binary?(star.id===tracked?1:-1)*members[1-i].massSolar/mass:0;
      const common={...star,share,orbit:binary,axis:data.binary?.a||0,name:star.name??data.name+(members.length===2?' '+star.id:'')};
      if(star.kind){
        const inc=binary.i*Math.PI/180,node=binary.node*Math.PI/180;
        const diskNormal=[Math.cos(node)*Math.sin(inc),-Math.cos(inc),-Math.sin(node)*Math.sin(inc)];
        return {...common,blackHole:true,star:false,luminosity:0,diskNormal};
      }
      const period=star.spinDays??(data.id==='trappist-1'?3.3:data.id==='kepler-16'&&i===0?35.1:i===0?24:18);
      return {...common,star:true,spinDays:period,appearance:{kind:'star',tiltDeg:14+i*12,meridian:.16+i*.37},
        luminosity:star.radiusSolar**2*((star.kelvin??3300)/5772)**4};
    });
    const stars=companions.filter(b=>b.star),blackHole=companions.find(b=>b.blackHole);
    const planets=(data.planets??[]).map(row=>{
      // Spin is illustrative. Compact inner worlds are shown in synchronous rotation.
      const locked=data.id==='trappist-1'||row.period<18;
      const spinDays=locked?row.period:row.radiusEarth>=6?.414:row.radiusEarth>=2?.671:1;
      return {...row,star:false,share:1,axis:row.a,orbit:orbit(row),locked,spinDays,name:data.designation+' '+row.id,
        appearance:appearances[data.id+'-'+row.id]??{kind:row.radiusEarth>2?'gas':'rock',tiltDeg:8,meridian:.24}};
    });
    const bodies=[...companions,...planets],outer=Math.max(data.binary?.a??0,...planets.map(p=>p.axis));
    for(const body of bodies)body.path=body.orbit?O.curve(body.orbit).map(v=>orbitVector(body,v)):[];
    const trailDays=Math.max(1,Math.round(Math.max(binary?.period??0,...planets.map(p=>p.period))*.85));
    return {...data,stars,planets,blackHole,bodies,outer,trailDays,...spaceMotion(data)};
  }
  function orbitVector(body,v){
    // Published visual-binary elements give north, east and receding coordinates.
    // The viewer's right-handed local basis is west, towards Earth, south.
    return vectorScale(body.orbit.skyElements?[-v[1],-v[2],-v[0]]:v,body.share);
  }
  function position(body,day,event){
    const departed=event?.states.get(body.id);
    if(departed&&day>=event.day)return departed.p.map((n,i)=>n+(day-event.day)*departed.v[i]);
    return body.orbit?orbitVector(body,O.position(body.orbit,LabInitial.jd+day)):[0,0,0];
  }
  function removeStars(system,day){
    const states=new Map(),step=.001;
    const removed=new Set(system.blackHole?[system.blackHole]:system.stars);
    for(const body of system.bodies.filter(b=>!removed.has(b))){
      const a=position(body,day-step),b=position(body,day+step);
      states.set(body.id,{p:position(body,day),v:b.map((n,i)=>(n-a[i])/(2*step))});
    }
    return {day,states,removed};
  }
  function displayFactor(body,outer,linear){
    if(!body.axis)return 0;
    return (body.axis/outer)**(linear?1:.66)/body.axis;
  }
  function travelVector(sys,linear){
    const extent=Math.hypot(...sys.velocity)*sys.trailDays/sys.outer;
    const factor=(linear?1:Math.min(1,1.65/extent))/sys.outer;
    return vectorScale(sys.velocity,factor);
  }
  // Fraction of the more distant stellar disk visible from the planet.
  function visibleDisk(r,foreground,gap){
    if(gap>=r+foreground)return 1;
    if(gap<=Math.abs(r-foreground))return foreground>=r?0:1-(foreground/r)**2;
    const clamp=x=>Math.max(-1,Math.min(1,x));
    const a=Math.acos(clamp((gap*gap+r*r-foreground*foreground)/(2*gap*r)));
    const b=Math.acos(clamp((gap*gap+foreground*foreground-r*r)/(2*gap*foreground)));
    return 1-(r*r*a+foreground*foreground*b-gap*r*Math.sin(a))/(Math.PI*r*r);
  }
  function lights(point,stars){
    const rays=stars.map(s=>{
      const delta=s.physical.map((x,i)=>x-point[i]),d=Math.max(1e-10,Math.hypot(...delta));
      return {dir:delta.map(x=>x/d),d,radius:Math.asin(Math.min(1,.00465047*s.body.radiusSolar/d)),
        power:s.body.luminosity/(d*d),tint:s.body.tint,visible:1};
    });
    if(rays.length===2){
      const near=rays[0].d<rays[1].d?0:1,back=rays[1-near],front=rays[near];
      const gap=Math.acos(Math.max(-1,Math.min(1,OrbitFrames.dot(back.dir,front.dir))));
      back.visible=visibleDisk(back.radius,front.radius,gap);
    }
    return rays;
  }
  function pole(body){
    const a=body.appearance,t=a.tiltDeg*Math.PI/180,node=a.meridian*2*Math.PI;
    return [Math.sin(t)*Math.cos(node),Math.sin(t)*Math.sin(node),Math.cos(t)];
  }
  function stellarField(data,motions,sys){
    // Positions are light-years at J2000; both velocities are in the same
    // heliocentric inertial frame. Common Galactic translation cancels.
    const offset=CosmicSky.ecl(CosmicSky.vec(sys.ra,sys.dec)).map(n=>n*sys.distancePc*3.26156);
    const rates=new Map(motions.rows.map(r=>[r[0],r])),stars=[];
    for(const row of data.rows){
      const distance=row[5];if(!(distance>0))continue;
      const direction=CosmicSky.ecl(CosmicSky.vec(row[1],row[2])),rate=rates.get(row[0]);
      const mu=rate?CosmicSky.stellarMotion(row[1],row[2],rate[1],rate[2]):[0,0,0];
      stars.push({p:direction.map((n,i)=>n*distance-offset[i]),v:mu.map((n,i)=>n*distance-sys.heliocentricLyYr[i]),
        magAtLy:row[3]-5*Math.log10(distance),colour:CosmicSky.color(row[4])});
    }
    stars.push({p:offset.map(n=>-n),v:sys.heliocentricLyYr.map(n=>-n),magAtLy:4.83-5*Math.log10(32.6156),colour:'#fff0da'});
    return stars;
  }
  function skyStars(field,sys,day,observer){
    const years=(LabInitial.jd-2451545+day)/365.25;
    const eye=[0,1,2].map(i=>(observer[0]*sys.basis[0][i]+observer[1]*sys.basis[1][i]+observer[2]*sys.basis[2][i])/63241.077);
    const out=[];
    for(const s of field){
      const x=s.p[0]+years*s.v[0]-eye[0],y=s.p[1]+years*s.v[1]-eye[1],z=s.p[2]+years*s.v[2]-eye[2];
      const d=Math.hypot(x,y,z),mag=s.magAtLy+5*Math.log10(d);
      if(d>.01&&mag<=7.5)out.push({v:[x/d,y/d,z/d],mag,color:s.colour});
    }
    return out;
  }
  // Cache regularly spaced samples. Playback advances the window and reuses
  // overlapping points; the endpoints always use the exact current time.
  function trace(body,day,span,event){
    const count=Math.min(1050,Math.max(68,Math.ceil(span/(body.orbit?.period||span)*45)));
    const step=span/count,start=day-span,lo=Math.floor(start/step)+1,hi=Math.ceil(day/step)-1;
    let cache=body.history;
    if(!cache||cache.event!==event||cache.step!==step)cache=body.history={event,step,points:new Map()};
    for(const n of cache.points.keys())if(n<lo||n>hi)cache.points.delete(n);
    const out=[{t:start,p:position(body,start,event)}];
    for(let n=lo;n<=hi;n++){
      let sample=cache.points.get(n);
      if(!sample){sample={t:n*step,p:position(body,n*step,event)};cache.points.set(n,sample);}
      out.push(sample);
    }
    if(event&&start<event.day&&day>event.day){
      const exact={t:event.day,p:position(body,event.day,event)},i=out.findIndex(row=>row.t>=event.day);
      if(i<0)out.push(exact);else if(out[i].t!==event.day)out.splice(i,0,exact);
    }
    out.push({t:day,p:position(body,day,event)});return out;
  }
  return {system,position,removeStars,displayFactor,travelVector,trace,lights,visibleDisk,pole,stellarField,skyStars};
})();
