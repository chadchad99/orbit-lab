// Orientation of the body maps in the J2000 ecliptic frame.
globalThis.OrbitFrames = (() => {
  "use strict";
  const D = Math.PI / 180;
  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const norm = a => { const length = Math.hypot(...a) || 1; return a.map(x => x / length); };
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const comb = (a,b,ka,kb) => a.map((v,i) => v*ka+b[i]*kb);
// Mean radii in km; the gravity integrator uses point masses.
// id, radius km, pole (RA, Dec), approximate camera longitude & latitude, optical atmosphere.
const specs=[
 [],["MERCURY",2439.7,281.01,61.42,12,13,0,[0,0,0]],["VENUS",6051.8,272.76,67.16,54,15,.73,[1,.655,.32]],
 ["EARTH",6371,0,90,54,16,1,[.063,.312,1]],["MARS",3389.5,317.68,52.89,273,15,.34,[.81,.35,.18]],
 ["JUPITER",69911,268.06,64.5,72,12,.53,[.62,.69,.74]],["SATURN",58232,40.59,83.54,28,25,.48,[.78,.65,.42]],
 ["URANUS",25362,257.31,-15.18,32,18,.67,[.24,.74,.8]],["NEPTUNE",24622,299.36,43.46,38,15,.68,[.19,.52,.95]],["MOON",1737.4,269.995,66.539,12,5,0,[0,0,0]]];
const eclGal=[[-.05487556041622,-.99382137906165,-.09647662612783],[.49410942787558,-.11099073341744,.86228587509011],[-.867666149019,-.00035158990483,.49714719171596]];
function eclPole(ra,dec){const d=dec*D,a=ra*D,e=23.439291*D,x=Math.cos(d)*Math.cos(a),y=Math.cos(d)*Math.sin(a),z=Math.sin(d);return norm([x,Math.cos(e)*y+Math.sin(e)*z,-Math.sin(e)*y+Math.cos(e)*z]);}
const frames=specs.map((sp,i)=>{if(!i)return null;const pole=eclPole(sp[2],sp[3]),at=LabInitial.bodies[i].p,sun=norm(at.map(x=>-x)),eq=norm(comb(sun,pole,1,-dot(sun,pole))),east=cross(pole,eq),lon=(sp[4]-60)*D,prime=comb(eq,east,Math.cos(lon),-Math.sin(lon));return [...cross(pole,prime),...pole,...prime];});
  const galactic = direction => eclGal.map(row => dot(row, direction));
  // The ESO photographic mosaic has its own pole and central meridian. These
  // rows register its image axes to Hipparcos without rotating the catalogue.
  const photoAxes=[[.9980242,.0554925,-.0294673],[-.0549656,.9983187,.0184006],[.0304388,-.0167445,.9993964]];
  function panorama(direction){
    const v=galactic(direction);
    return photoAxes.map(row=>dot(row,v));
  }
  function bodyFrame(i,run,day){
    if(i!==GravityLab.MOON)return frames[i];
    const e=GravityLab.read(run,GravityLab.EARTH,day),m=GravityLab.read(run,i,day);
    const face=norm([e[0]-m[0],e[1]-m[1],e[2]-m[2]]),pole=frames[i].slice(3,6);
    const prime=norm(comb(face,pole,1,-dot(face,pole)));
    return [...cross(pole,prime),...pole,...prime];
  }
  return {specs, frames,bodyFrame, eclGal, galactic, panorama, dot, norm, cross, comb};
})();
