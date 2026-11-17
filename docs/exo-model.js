// Units: AU, days, BJD. Display scaling is applied only after solving an orbit.
globalThis.ExoOrbits=(()=>{
  "use strict";
  const O=CatalogOrbits;
  const vectorScale=(v,k)=>v.map(n=>n*k);
  function orbit(row){
    const e=row.e||0,w=row.w||0,node=row.node||0;
    // With common, unmeasured sky nodes, the diagram plane is the system's
    // nearly edge-on plane rotated 90 degrees toward a face-on view.
    return {q:row.a*(1-e),e,w,node,i:(row.inc??90)-90,period:row.period,
      epoch:row.epoch??row.transit,mean:row.meanLongitude==null?90-w:row.meanLongitude-w-node};
  }
  function spaceMotion(data){
    const {dot,cross,norm,comb}=OrbitFrames,cam=CosmicSky.camera(data.ra,data.dec,1);
    const basis=[cam.right,cam.front,norm(cross(cam.right,cam.front))],m=data.motion;
    // West and toward the observer have the opposite signs to increasing RA and recession.
    const k=4.74047*data.distancePc/1000;
    const tangent=comb(cam.right,cam.up,-k*m.pmRaCosDec,k*m.pmDec);
    const heliocentric=comb(tangent,cam.front,1,-m.radialKmS);
    const kmS=comb(heliocentric,OrbitMapSpace.direction,1,OrbitMapSpace.speedInAU*GravityLab.AU/GravityLab.SECONDS);
    return {basis,speed:Math.hypot(...kmS),velocity:basis.map(axis=>dot(kmS,axis)*GravityLab.SECONDS/GravityLab.AU)};
  }
  function system(data){
    const binary=data.binary&&orbit(data.binary);
    const mass=data.stars.reduce((sum,star)=>sum+star.massSolar,0);
    const stars=data.stars.map((star,i)=>{
      const share=binary?(i===0?-data.stars[1].massSolar/mass:data.stars[0].massSolar/mass):0;
      return {...star,star:true,share,orbit:binary,axis:data.binary?.a||0,
        name:data.name+(data.stars.length===2?' '+star.id:''),luminosity:star.radiusSolar**2*((star.kelvin??3300)/5772)**4};
    });
    const planets=data.planets.map(row=>{
      // Spin is illustrative. Compact inner worlds are shown in synchronous rotation.
      const locked=data.id==='trappist-1'||row.period<18;
      const spinDays=locked?row.period:row.radiusEarth>=6?.414:row.radiusEarth>=2?.671:1;
      return {...row,star:false,share:1,axis:row.a,orbit:orbit(row),locked,spinDays,name:data.designation+' '+row.id};
    });
    const bodies=[...stars,...planets],outer=Math.max(...planets.map(p=>p.axis));
    for(const body of bodies)body.path=body.orbit?O.curve(body.orbit).map(v=>vectorScale(v,body.share)):[];
    const trailDays=Math.max(1,Math.round(Math.max(...planets.map(p=>p.period))*.85));
    return {...data,stars,planets,bodies,outer,trailDays,...spaceMotion(data)};
  }
  function position(body,day,event){
    const departed=event?.states.get(body.id);
    if(departed&&day>=event.day)return departed.p.map((n,i)=>n+(day-event.day)*departed.v[i]);
    return body.orbit?vectorScale(O.position(body.orbit,LabInitial.jd+day),body.share):[0,0,0];
  }
  function removeStars(system,day){
    const states=new Map(),step=.001;
    for(const body of system.planets){
      const a=position(body,day-step),b=position(body,day+step);
      states.set(body.id,{p:position(body,day),v:b.map((n,i)=>(n-a[i])/(2*step))});
    }
    return {day,states};
  }
  function displayFactor(body,outer,linear){
    if(!body.axis)return 0;
    return (body.axis/outer)**(linear?1:.66)/body.axis;
  }
  function travelVector(sys,linear){
    const extent=Math.hypot(...sys.velocity)*sys.trailDays/sys.outer;
    const factor=(linear?1:Math.min(1,2.38/extent))/sys.outer;
    return vectorScale(sys.velocity,factor);
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
  return {system,position,removeStars,displayFactor,travelVector,trace};
})();
