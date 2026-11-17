// Distances remain in the native catalogue unit (AU for small bodies, km for satellites).
globalThis.CatalogOrbits = (() => {
  'use strict';
  const rad = Math.PI / 180, tau = Math.PI * 2, k = 0.01720209895;
  const finite = Number.isFinite;
  const jdText = jd => finite(jd) ? new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 10) : '';
  function rotate(x, y, orbit) {
    const w = (orbit.w || 0) * rad, node = (orbit.node || 0) * rad, i = (orbit.i || 0) * rad;
    const a = x * Math.cos(w) - y * Math.sin(w), b = x * Math.sin(w) + y * Math.cos(w);
    return [Math.cos(node) * a - Math.sin(node) * b * Math.cos(i), Math.sin(node) * a + Math.cos(node) * b * Math.cos(i), b * Math.sin(i)];
  }
  function small(row) {
    if (!row || ![row[6],row[7],row[8],row[9],row[10]].every(finite) || row[6] <= 0) return null;
    const [q,e,i,node,w,tp] = row.slice(6,12), axis = q / Math.abs(1-e);
    return { q,e,i,node,w,tp,epoch:row[5], period:e<1 ? tau * axis**1.5 / k : null, kepler:true, oriented:true };
  }
  function moon(raw) {
    if (!raw || !(raw.aKm>0)) return null;
    const e = finite(raw.e) ? raw.e : 0, period = Math.abs(raw.periodDays || 0);
    return {q:raw.aKm*(1-e), e, i:raw.iDeg, node:raw.nodeDeg, w:raw.periDeg, epoch:raw.epochJD, mean:raw.meanDeg, period,
      oriented:[raw.iDeg,raw.nodeDeg,raw.periDeg].every(finite), schematic:!finite(raw.e)};
  }
  function orbitalPoint(o, anomaly) {
    const a = o.q / Math.abs(1-o.e);
    if (o.e<1) return rotate(a*(Math.cos(anomaly)-o.e), a*Math.sqrt((1-o.e)*(1+o.e))*Math.sin(anomaly),o);
    if (o.e>1) return rotate(a*(o.e-Math.cosh(anomaly)), a*Math.sqrt((o.e-1)*(o.e+1))*Math.sinh(anomaly),o);
    return rotate(o.q*(1-anomaly*anomaly),2*o.q*anomaly,o);
  }
  function position(o, jd) {
    if (!o || !finite(jd)) return null;
    const e=o.e, a=o.q/Math.abs(1-e);
    if (e===1) {
      if (!finite(o.tp)) return null;
      const b=k*(jd-o.tp)/Math.sqrt(2*o.q**3);
      return orbitalPoint(o,2*Math.sinh(Math.asinh(1.5*b)/3));
    }
    let m;
    if (finite(o.tp)) m=k*(jd-o.tp)/a**1.5;
    else if (finite(o.mean)&&finite(o.epoch)&&o.period>0) m=o.mean*rad+(jd-o.epoch)*tau/o.period;
    else return null;
    if(e>1) {
      let h=Math.asinh(m/e);
      for(let j=0;j<30;j++){const step=(e*Math.sinh(h)-h-m)/(e*Math.cosh(h)-1);h-=Math.max(-1,Math.min(1,step));if(Math.abs(step)<1e-11)break;}
      return orbitalPoint(o,h);
    }
    m=((m+Math.PI)%tau+tau)%tau-Math.PI;
    let lo=-Math.PI,hi=Math.PI,u=e<.8?m:(m<0?-2.4:2.4);
    for(let j=0;j<36;j++){
      const error=u-e*Math.sin(u)-m;if(Math.abs(error)<1e-12)break;
      if(error>0)hi=u;else lo=u;
      const next=u-error/(1-e*Math.cos(u));u=next>lo&&next<hi?next:(lo+hi)/2;
    }
    return orbitalPoint(o,u);
  }
  function curve(o, reach) {
    if(!o || !(o.q>0))return [];
    const e=o.e;
    // A hyperbola or parabola has no return arc; draw the observed object's branch.
    const span=e<1?Math.PI:e===1?Math.sqrt(Math.max(1,reach/o.q-1)):Math.acosh(Math.max(1.01,(1+reach*(e-1)/o.q)/e));
    return Array.from({length:181},(_,j)=>orbitalPoint(o,(2*j/180-1)*span));
  }
  function spacecraft(row) {
    const g=row[16];if(!g)return null;
    const keys=['EPOCH','MEAN_MOTION','ECCENTRICITY','INCLINATION','RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY','BSTAR','MEAN_MOTION_DOT','MEAN_MOTION_DDOT'];
    const message=Object.fromEntries(keys.map((key,i)=>[key,g[i]]));
    message.NORAD_CAT_ID=row[0];
    const record=satellite.json2satrec(message),period=1/g[1];
    const point=days=>{const v=satellite.sgp4(record,days*1440)?.position;return v&&[v.x,v.y,v.z].every(finite)?[v.x,v.y,v.z]:null;};
    if(!point(0))return null;
    return {points:Array.from({length:181},(_,j)=>point(period*j/180)),point,period,epoch:record.jdsatepoch};
  }
  return {small,moon,position,curve,spacecraft,jdText};
})();
