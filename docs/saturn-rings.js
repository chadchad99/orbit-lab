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
  const shader=`
float ringContrast(float r,vec2 unitXZ){
  vec4 band=r<1.56?vec4(1,0,0,0):r<1.79?vec4(0,1,0,0):r<2.02?vec4(0,0,1,0):vec4(0,0,0,1);
  float u=(r-dot(band,vec4(1.44,1.68,1.89,2.15)))/.088,weight=max(0.,1.-u*u);
  vec2 dir=vec2(dot(band,ringSin),dot(band,ringCos));
  float forward=dot(unitXZ,dir),side=dot(unitXZ,vec2(dir.y,-dir.x));
  float peak=max(0.,(forward-.78)/.22),wake=max(0.,(-.64*forward+.768*side-.76)/.24);
  return 1.+weight*weight*(1.45*peak*peak-.65*wake*wake);
}`;
  return {frame,contrast,shader,periods};
})();
