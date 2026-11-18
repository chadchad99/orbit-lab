// An archival solar rotation, sampled on a sphere in the ecliptic camera frame.
globalThis.createSolarEmission=function(request){
  "use strict";
  const {dot,cross,norm}=OrbitFrames;
  const turn=2*Math.PI,rad=Math.PI/180,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const ecliptic=v=>[v[0],v[1]*Math.cos(23.439291*rad)+v[2]*Math.sin(23.439291*rad),
    -v[1]*Math.sin(23.439291*rad)+v[2]*Math.cos(23.439291*rad)];
  const ra=286.13*rad,dec=63.87*rad;
  const pole=ecliptic([Math.cos(dec)*Math.cos(ra),Math.cos(dec)*Math.sin(ra),Math.sin(dec)]);
  const node=ecliptic([-Math.sin(ra),Math.cos(ra),0]),east=cross(pole,node);
  const extent=1.14,diameters=[56,80,112,160,224,320,448],geometry=new Map();
  const colorStops=[
    [0,53,28,19],[.16,102,53,28],[.34,176,104,49],[.51,234,159,78],
    [.65,255,196,110],[.78,255,218,145],[.90,255,238,194],
    [1.02,255,249,224],[1.15,255,253,241],[1.34,255,255,248]
  ];
  const palette=new Uint8ClampedArray(1024*3);
  for(let i=0,j=0;i<1024;i++){
    const x=i*1.34/1023;
    while(j<colorStops.length-2&&x>colorStops[j+1][0])j++;
    const a=colorStops[j],b=colorStops[j+1],t=(x-a[0])/(b[0]-a[0]);
    for(let k=0;k<3;k++)palette[i*3+k]=a[k+1]+(b[k+1]-a[k+1])*t;
  }
  const levels=new Map();
  let halo,film;
  const surface=document.createElement("canvas"),paint=surface.getContext("2d");
  let pixels,lastSurface="";
  function mipmap(image,size){
    const width=Math.min(image.naturalWidth,Math.max(256,2**Math.ceil(Math.log2(size*2.8))));
    if(levels.has(width))return levels.get(width);
    const work=document.createElement("canvas");work.width=width;work.height=width/2;
    const g=work.getContext("2d",{willReadFrequently:true});
    g.imageSmoothingQuality="high";g.drawImage(image,0,0,width,width/2);
    const level={width,height:width/2,data:g.getImageData(0,0,width,width/2).data};
    levels.set(width,level);return level;
  }
  function projection(size,latitude){
    const key=size+"/"+latitude;
    if(geometry.has(key))return geometry.get(key);
    const sinB=Math.sin(latitude*rad),cosB=Math.cos(latitude*rad),count=size*size;
    const u=new Float32Array(count),v=new Float32Array(count),limb=new Float32Array(count),networkGain=new Float32Array(count);
    const coverage=new Float32Array(count),fringe=new Float32Array(count);
    for(let j=0,k=0;j<size;j++)for(let i=0;i<size;i++,k++){
      const x=((i+.5)*2/size-1)*extent,y=(1-(j+.5)*2/size)*extent,r=Math.hypot(x,y);
      if(r>=extent)continue;
      const onDisk=Math.min(1,1/Math.max(r,.0001));
      const z=Math.sqrt(Math.max(0,1-r*r)),north=y*onDisk;
      u[k]=Math.atan2(x*onDisk,z*cosB-north*sinB)/turn;
      v[k]=.5-Math.asin(clamp(north*cosB+z*sinB,-1,1))/Math.PI;
      limb[k]=.74+.28*z**.8;networkGain[k]=.0045+.0012*(1-z);
      const edge=(1-r)*size/(2*extent);
      coverage[k]=clamp(edge+.5,0,1);
      if(edge<.5)fringe[k]=Math.exp(-Math.max(0,r-1)/.039)*clamp((extent-r)/.032,0,1);
    }
    const mesh={u,v,limb,networkGain,coverage,fringe};
    if(geometry.size>=5)geometry.delete(geometry.keys().next().value);
    geometry.set(key,mesh);return mesh;
  }
  function bake(size,latitude,longitude,image){
    const atlas=mipmap(image,size),key=[size,latitude,longitude,atlas.width].join("/");
    if(key===lastSurface)return surface;
    const {width,height,data}=atlas,mask=width-1,mesh=projection(size,latitude);
    if(surface.width!==size||!pixels){surface.width=surface.height=size;pixels=paint.createImageData(size,size);}
    const out=pixels.data,phase=longitude/360;
    for(let i=0,k=0;i<mesh.u.length;i++,k+=4){
      const cover=mesh.coverage[i],fringe=mesh.fringe[i];
      if(!cover&&!fringe){out[k+3]=0;continue;}
      const x=(mesh.u[i]+phase+2)*width-.5,y=clamp(mesh.v[i]*height-.5,0,height-1.001);
      const ix=Math.floor(x),iy=Math.floor(y),a=(iy*width+(ix&mask))*4,b=(iy*width+((ix+1)&mask))*4;
      const dx=x-ix,dy=y-iy,row=width*4;
      const aa=(1-dx)*(1-dy),ab=dx*(1-dy),ba=(1-dx)*dy,bb=dx*dy;
      const continuum=data[a]*aa+data[b]*ab+data[a+row]*ba+data[b+row]*bb-128;
      const network=data[a+1]*aa+data[b+1]*ab+data[a+row+1]*ba+data[b+row+1]*bb-128;
      const spot=(data[a+2]*aa+data[b+2]*ab+data[a+row+2]*ba+data[b+row+2]*bb)/255;
      const radiance=mesh.limb[i]*(1+continuum*.0026+network*mesh.networkGain[i])*(1-.92*spot);
      const color=3*clamp(Math.round(radiance*1023/1.34),0,1023);
      out[k]=palette[color];out[k+1]=palette[color+1];out[k+2]=palette[color+2];
      // Unresolved light from bright active regions extends slightly beyond the visible limb.
      out[k+3]=255*(cover+(1-cover)*fringe*clamp(.20+network*.003,.09,.50));
    }
    paint.putImageData(pixels,0,0);lastSurface=key;return surface;
  }
  function scatteredLight(){
    if(halo)return halo;
    halo=document.createElement("canvas");halo.width=halo.height=384;
    const g=halo.getContext("2d"),im=g.createImageData(384,384),p=im.data;
    for(let j=0,k=0;j<384;j++)for(let i=0;i<384;i++,k+=4){
      const r=Math.hypot(i+.5-192,j+.5-192)/48,d=Math.max(0,r-1),warm=Math.exp(-d/.42);
      p[k]=255;p[k+1]=188+47*warm;p[k+2]=108+79*warm;
      p[k+3]=255*(.39*Math.exp(-d/.11)+.30*Math.exp(-d/.48)+.097*Math.exp(-d/1.38))*clamp((4-r)/.65,0,1);
    }
    g.putImageData(im,0,0);return halo;
  }
  function aspect(q,c,day){
    const observer=norm(OrbitMapSpace.subtract(c.eye,q.position));
    const right=norm(cross(c.up,observer)),up=cross(observer,right);
    const angle=Math.atan2(dot(pole,right),dot(pole,up));
    const meridian=Math.atan2(dot(observer,east),dot(observer,node))/rad;
    const prime=84.176+14.1844*(LabInitial.jd-2451545+day);
    return {angle,latitude:Math.round(Math.asin(clamp(dot(pole,observer),-1,1))/rad),
      longitude:Math.round((((meridian-prime)%360+360)%360)*4)/4};
  }
  const aperture=Array.from({length:80},(_,i)=>{
    const angle=i*Math.PI*(3-Math.sqrt(5)),r=Math.sqrt((i+.5)/80);
    return [r*Math.cos(angle),r*Math.sin(angle)];
  });
  const transit=document.createElement("canvas");transit.width=transit.height=144;
  const mask=transit.getContext("2d");
  function transitLight(ctx,sun,nearby){
    // The optical blur is sourced only by the still-visible photosphere. Composite its
    // short wing onto the dark silhouette after the nearer bodies have been painted.
    const scale=64/sun.radius,side=144/scale;
    mask.clearRect(0,0,144,144);mask.fillStyle="#fff2ca";mask.beginPath();mask.arc(72,72,64,0,turn);mask.fill();
    mask.globalCompositeOperation="destination-out";
    for(const b of nearby){
      mask.beginPath();mask.arc(72+(b.x-sun.x)*scale,72+(b.y-sun.y)*scale,b.radius*scale,0,turn);mask.fill();
    }
    mask.globalCompositeOperation="source-over";
    ctx.save();ctx.beginPath();
    for(const b of nearby){ctx.moveTo(b.x+b.radius,b.y);ctx.arc(b.x,b.y,b.radius,0,turn);}
    ctx.clip();ctx.globalCompositeOperation="screen";ctx.globalAlpha=.45;
    ctx.shadowColor="#ffda9e";ctx.shadowBlur=clamp(sun.radius*.065,1.3,8)*Math.min(devicePixelRatio||1,2);
    ctx.drawImage(transit,sun.x-side/2,sun.y-side/2,side,side);ctx.restore();
  }
  function draw(ctx,q,c,s,frame,bodies){
    const wanted=2*extent*q.radius*Math.min(devicePixelRatio||1,1.5);
    const size=diameters.find(n=>n>=wanted)||diameters.at(-1);
    const starterMap=request("sun-carrington-lite");
    const image=size*2.8>512?(request("sun-carrington")||starterMap):starterMap;
    if(s.coronaPlaying&&!film)film=request("sun-map-corona");
    const poster=film?null:request("sun-map-corona-still"),streamers=request("sun-eclipse-corona");
    const view=aspect(q,c,s.day),r=q.radius;
    const nearby=bodies.filter(b=>b.z<q.z&&b.radius>.6&&Math.hypot(b.x-q.x,b.y-q.y)<b.radius+r);
    const visibleFraction=nearby.length?aperture.filter(([x,y])=>nearby.every(b=>
      (q.x+x*r-b.x)**2+(q.y+y*r-b.y)**2>b.radius*b.radius)).length/aperture.length:1;
    ctx.save();ctx.translate(q.x,q.y);ctx.rotate(view.angle);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
    ctx.globalAlpha=visibleFraction*(streamers ? .60 : 1);ctx.drawImage(scatteredLight(),-4*r,-4*r,8*r,8*r);
    ctx.globalCompositeOperation="screen";ctx.globalAlpha=1-.23*visibleFraction;
    if(streamers){
      const reach=2.48*r;
      ctx.drawImage(streamers,-reach,-reach,2*reach,2*reach);
    }
    ctx.globalCompositeOperation="lighter";
    const width=r/.32,loopGain=streamers ? .65 : 1;
    if(film){
      const a=Math.floor(frame),mix=frame-a;
      for(let i=0;i<2;i++){
        const n=(a+i)%24,weight=i?mix:1-mix;if(!weight)continue;
        ctx.globalAlpha=loopGain*weight;ctx.drawImage(film,n%6*256,Math.floor(n/6)*256,256,256,-width/2,-width/2,width,width);
      }
    }else if(poster){ctx.globalAlpha=loopGain;ctx.drawImage(poster,-width/2,-width/2,width,width);}
    ctx.globalCompositeOperation="source-over";ctx.globalAlpha=1;
    if(image){
      const side=r*extent;
      ctx.drawImage(bake(size,view.latitude,view.longitude,image),-side,-side,2*side,2*side);
    }else{
      // A local starter image also keeps the Sun visible if the full atlas cannot be read.
      const starter=request("sun-radiant");
      if(starter)ctx.drawImage(starter,-r,-r,2*r,2*r);
      else{const g=ctx.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,"#fff9df");g.addColorStop(.76,"#ffebbc");g.addColorStop(1,"#ffc881");ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,turn);ctx.fill();}
    }
    ctx.restore();
    if(nearby.length&&visibleFraction>0)return ()=>transitLight(ctx,q,nearby);
  }
  return {draw};
};
