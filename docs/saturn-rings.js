// Trace four narrow groups of ice particles in Saturn's equatorial plane.
// The Cassini radial profile supplies the ring structure, these are illustrative
// contrasts on specific streamlines, advanced with Saturn's GM in km^3/s^2.
globalThis.SaturnRings=(()=>{
  "use strict";
  const radii=[1.44,1.68,1.89,2.15],offset=[.36,2.54,-1.12,.96],tau=2*Math.PI;
  const periods=radii.map(r=>tau*Math.sqrt((60268*r)**3/37931207.8)/86400);
  function frame(day){
    const angles=periods.map((p,i)=>offset[i]+tau*((day%p)/p));
    return {s:angles.map(Math.sin),c:angles.map(Math.cos)};
  }
  function contrast(r,x,z,phase){
    const i=r<1.56?0:r<1.79?1:r<2.02?2:3;
    const u=(r-radii[i])/.088,weight=Math.max(0,1-u*u);
    if(!weight)return 1;
    const forward=x*phase.s[i]+z*phase.c[i],side=x*phase.c[i]-z*phase.s[i];
    const peak=Math.max(0,(forward-.78)/.22);
    const wake=Math.max(0,(-.64*forward+.768*side-.76)/.24);
    return 1+weight*weight*(1.45*peak*peak-.65*wake*wake);
  }
  // The VIMS profile encodes normal optical depth as alpha = 1 - exp(-tau).
  function transmission(opacity,cosine){
    return Math.pow(1-opacity,1/Math.max(.025,Math.abs(cosine)));
  }
  function scatter(opacity,incidence,view,coverage){
    const mu0=Math.max(.025,Math.abs(incidence)),mu=Math.max(.025,Math.abs(view));
    const toLight=transmission(opacity,mu0),toEye=1-coverage;
    let single;
    if(incidence*view<0){
      single=(1-toLight*toEye)*mu0/(mu0+mu);
      return .14*Math.sqrt(mu0)+1.34*single/Math.max(.0001,coverage);
    }
    // Single scattering through a slab. Use its limit for equal path lengths.
    if(Math.abs(mu-mu0)<.015*Math.max(mu,mu0)){
      const depth=-Math.log(Math.max(1e-8,1-opacity))/((mu+mu0)*.5);
      single=depth*Math.exp(-depth);
    }else single=(toLight-toEye)*mu0/(mu0-mu);
    return .095*Math.sqrt(mu0)+1.12*Math.max(0,single)/Math.max(.0001,coverage);
  }
  // Saturn appears centered on the ring horizon. Integrate its projected
  // half disk and weight the reflected light by its illuminated phase.
  function planetshine(radius,phaseCos){
    const radiusSin=1/radius,halfDisk=Math.asin(radiusSin)-radiusSin*Math.sqrt(1-radiusSin*radiusSin);
    const c=Math.max(-1,Math.min(1,phaseCos)),angle=Math.acos(c);
    return .52*halfDisk*(Math.sin(angle)+(Math.PI-angle)*c)/(Math.PI*Math.PI);
  }
  const shader=`
float planetshine(float radius,float phaseCos){
  float s=1./radius,halfDisk=asin(s)-s*sqrt(1.-s*s);
  float c=clamp(phaseCos,-1.,1.),angle=acos(c);
  return .52*halfDisk*(sin(angle)+(pi-angle)*c)/(pi*pi);
}
float ringTransmission(float opacity,float cosine){
  return pow(1.-opacity,1./max(.025,abs(cosine)));
}
float ringScatter(float opacity,float incidence,float view,float coverage){
  float mu0=max(.025,abs(incidence)),mu=max(.025,abs(view));
  float toLight=ringTransmission(opacity,mu0),toEye=1.-coverage;
  float single;
  if(incidence*view<0.){
    single=(1.-toLight*toEye)*mu0/(mu0+mu);
    return .14*sqrt(mu0)+1.34*single/max(.0001,coverage);
  }
  if(abs(mu-mu0)<.015*max(mu,mu0)){
    float depth=-log(max(1.e-8,1.-opacity))/((mu+mu0)*.5);
    single=depth*exp(-depth);
  }else single=(toLight-toEye)*mu0/(mu0-mu);
  return .095*sqrt(mu0)+1.12*max(0.,single)/max(.0001,coverage);
}
float ringContrast(float r,vec2 unitXZ){
  vec4 band=r<1.56?vec4(1,0,0,0):r<1.79?vec4(0,1,0,0):r<2.02?vec4(0,0,1,0):vec4(0,0,0,1);
  float u=(r-dot(band,vec4(1.44,1.68,1.89,2.15)))/.088,weight=max(0.,1.-u*u);
  vec2 dir=vec2(dot(band,ringSin),dot(band,ringCos));
  float forward=dot(unitXZ,dir),side=dot(unitXZ,vec2(dir.y,-dir.x));
  float peak=max(0.,(forward-.78)/.22),wake=max(0.,(-.64*forward+.768*side-.76)/.24);
  return 1.+weight*weight*(1.45*peak*peak-.65*wake*wake);
}`;
  return {frame,contrast,transmission,scatter,planetshine,shader,periods};
})();
