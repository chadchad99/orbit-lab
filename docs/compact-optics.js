// Enlarged illustrations of stellar black holes. The background is the current
// sky view. The gas colours and secondary image are illustrative, not an X-ray map.
globalThis.createCompactOptics=function(){
  'use strict';
  const tau=2*Math.PI, clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const patch=document.createElement('canvas'),lens=document.createElement('canvas'),disk=document.createElement('canvas');
  const read=patch.getContext('2d',{willReadFrequently:true}),drawLens=lens.getContext('2d'),drawDisk=disk.getContext('2d');
  let lastLens='',lastSky=null,geometry='',lastFrame=-1,pixels,radial,angles,intensity,flow,grain;
  function bendSky(ctx,p,shadow,sky,repaint,dpr){
    const side=p.r*2,cap=Math.min(720,Math.max(80,Math.round(side*dpr)));
    const key=[cap,shadow,p.x,p.y,p.r,sky.width,sky.height].join('/');
    if(key!==lastLens||repaint!==lastSky){
      if(patch.width!==cap||patch.height!==cap)patch.width=patch.height=lens.width=lens.height=cap;
      read.clearRect(0,0,cap,cap);
      read.drawImage(sky,(p.x-p.r)*dpr,(p.y-p.r)*dpr,side*dpr,side*dpr,0,0,cap,cap);
      const skyData=read.getImageData(0,0,cap,cap).data,frame=drawLens.createImageData(cap,cap);
      const out=frame.data,mid=cap/2,einstein=1.52*shadow;
      for(let y=0,k=0;y<cap;y++)for(let x=0;x<cap;x++,k+=4){
        const dx=(x+.5-mid)/mid,dy=(y+.5-mid)/mid,r2=dx*dx+dy*dy;
        if(r2>=1)continue;
        out[k+3]=255;
        if(r2<shadow*shadow)continue;
        const r=Math.sqrt(r2),t=clamp((1-r)/.38,0,1),bend=1-einstein*einstein*t*t*(3-2*t)/r2;
        const sx=clamp(mid*(1+dx*bend)-.5,0,cap-1.001),sy=clamp(mid*(1+dy*bend)-.5,0,cap-1.001);
        const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy,j=4*(iy*cap+ix),stride=4*cap;
        for(let c=0;c<3;c++)out[k+c]=(1-fy)*((1-fx)*skyData[j+c]+fx*skyData[j+4+c])+fy*((1-fx)*skyData[j+stride+c]+fx*skyData[j+stride+4+c]);
      }
      drawLens.putImageData(frame,0,0);lastLens=key;lastSky=repaint;
    }
    ctx.drawImage(lens,p.x-p.r,p.y-p.r,side,side);
  }
  // The gas is sampled in polar coordinates, so the inner annuli can move
  // faster than the outer ones without making the disk rotate as a single image.
  function gasTexture(){
    const data=new Uint8Array(256*512);
    for(let r=0;r<256;r++)for(let a=0;a<512;a++){
      const u=r/255,v=tau*a/512,twist=11*Math.log(.35+u),phase=v+twist;
      const eddies=Math.sin(3*v+2.3*Math.sin(phase*2+u*13))+Math.sin(7*phase+1.4*Math.cos(4*v-u*9));
      const filaments=Math.sin(u*151+2.5*Math.cos(5*phase)+1.9*eddies)+.56*Math.sin(u*303+9*phase+2*eddies)+.38*Math.sin(u*477+14*phase);
      data[r*512+a]=clamp(173+24*eddies+25*filaments,55,255);
    }
    return data;
  }
  // Null geodesics in a Schwarzschild field, G = c = M = 1. The impact
  // parameter fixes u'(0) at the distant observer; u = 1/r. Cache once, then
  // find disk-plane crossings for any camera inclination from the same rays.
  const rayCount=1024,angleCount=721,step=2*Math.PI/(angleCount-1),shadow=.175;
  const maxImpact=Math.sqrt(27)/shadow;
  let rays;
  function traceRays(){
    rays=new Float32Array(rayCount*angleCount);
    for(let i=1;i<rayCount;i++){
      let u=0,du=(rayCount-1)/(i*maxImpact);
      for(let j=1;j<angleCount;j++){
        const acceleration=3*u*u-u;
        u+=du*step+.5*acceleration*step*step;
        if(u<=0||u>=.5)break;
        du+=.5*(acceleration+3*u*u-u)*step;
        rays[i*angleCount+j]=u;
      }
    }
  }
  function inverseRadius(ray,angle){
    const ri=Math.min(rayCount-2,Math.floor(ray)),ai=Math.min(angleCount-2,Math.floor(angle));
    const i=ri*angleCount+ai,x=ray-ri,y=angle-ai;
    const a=rays[i],b=rays[i+1],c=rays[i+angleCount],d=rays[i+angleCount+1];
    if(!a||!b||!c||!d)return 0; // The ray has escaped or crossed the horizon.
    return (a*(1-y)+b*y)*(1-x)+(c*(1-y)+d*y)*x;
  }
  function projectDisk(n,q){
    if(!grain)grain=gasTexture();if(!rays)traceRays();
    disk.width=disk.height=n;pixels=drawDisk.createImageData(n,n);
    radial=new Uint8Array(n*n);angles=new Uint16Array(n*n);intensity=new Float32Array(n*n);flow=new Uint16Array(n*n);
    const sini=Math.sqrt(1-q*q),inner=6,outer=27;
    for(let y=0,k=0;y<n;y++)for(let x=0;x<n;x++,k++){
      const sx=2*(x+.5)/n-1,sy=2*(y+.5)/n-1,rho=Math.hypot(sx,sy);
      if(rho<.001||rho>=1)continue;
      const ux=sx/rho,uy=sy/rho,ray=rho*(rayCount-1),impact=rho*maxImpact;
      const first=Math.atan2(q,sini*uy);
      for(let crossing=0;crossing<2;crossing++){
        const phi=first+Math.PI*crossing;
        const inv=inverseRadius(ray,phi/step),r=1/inv;
        if(r<=inner||r>=outer)continue;
        const u=(r-inner)/(outer-inner),sinPhi=Math.sin(phi);
        const az=Math.atan2(q*uy*sinPhi+sini*Math.cos(phi),ux*sinPhi);
        radial[k]=Math.floor(u*255);angles[k]=Math.floor((az/tau+1)*512)&511;
        flow[k]=Math.round(57*(8/r)**1.5);
        const shift=Math.sqrt(1-3/r)/(1+impact*sini*ux/r**1.5);
        const flux=(1-Math.sqrt(inner/r))*(inner/r)**3;
        const edge=clamp((1-u)/.26,0,1);
        intensity[k]=(flux/.052)**.53*shift**2.7*edge;
        break;
      }
    }
    lastFrame=-1;
  }
  function accretion(ctx,p,view,day,focus,dpr){
    const normal=p.body.diskNormal,alignment=OrbitFrames.dot(normal,view[2]);
    const q=clamp(Math.abs(alignment),.105,1),tilt=Math.round(q*(focus?150:45))/(focus?150:45);
    const n=Math.min(650,Math.max(58,Math.ceil(p.r*dpr/(focus?4:2))*(focus?8:4)));
    const geom=n+'/'+tilt,frame=Math.floor(day*36);
    if(geometry!==geom){projectDisk(n,tilt);geometry=geom;}
    if(frame!==lastFrame){
      const out=pixels.data,t=(frame/36)%512;
      for(let k=0,i=0;k<intensity.length;k++,i+=4){
        if(!intensity[k])continue;
        const value=grain[radial[k]*512+((angles[k]-Math.floor(t*flow[k]))&511)]/192;
        const light=Math.min(2,intensity[k]*value);
        out[i]=255*Math.min(1,1.29*light**.46);out[i+1]=240*Math.min(1,light**.90);out[i+2]=227*Math.min(1,light**1.58);
        out[i+3]=255*Math.min(1,light*1.55);
      }
      drawDisk.putImageData(pixels,0,0);lastFrame=frame;
    }
    const right=OrbitFrames.dot(normal,view[0]),up=OrbitFrames.dot(normal,view[1]);
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(right,up)+(alignment<0?Math.PI:0));
    ctx.drawImage(disk,-p.r,-p.r,2*p.r,2*p.r);ctx.restore();
  }
  function draw(ctx,p,view,day,focus,sky,skyFrame,dpr){
    const active=p.body.kind==='accreting',shadow=active?.175:.41;
    if(focus)bendSky(ctx,p,shadow,sky,skyFrame,dpr);
    else if(active){ctx.fillStyle='#020204';ctx.beginPath();ctx.arc(p.x,p.y,p.r*shadow,0,tau);ctx.fill();}
    if(active){accretion(ctx,p,view,day,focus,dpr);return;}
    if(!focus){
      // A locator at this map scale. Its dashed outline is not emitted light.
      ctx.save();ctx.strokeStyle='#adccdcc9';ctx.lineWidth=1;ctx.setLineDash([4,5]);ctx.beginPath();ctx.arc(p.x,p.y,p.r*.7,0,tau);ctx.stroke();
      ctx.setLineDash([]);ctx.fillStyle='#c1d9e0';ctx.fillRect(p.x-1,p.y-1,2,2);ctx.restore();
    }
  }
  return {draw};
};
