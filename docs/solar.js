// Observed solar images are displayed in the orientation in which the instruments recorded them.
globalThis.createSolarOptics=function(invalidate){
  const pictures=new Map(),pending=new Set(),retryAt=new Map(),tau=2*Math.PI;
  const geometry={
    visible:{cx:.5,cy:.5,r:.386595},euv:{cx:.5,cy:.5,r:.386595}
  };
  const corona={columns:6,count:24,tile:320,diskFraction:.30,fps:4};
  let framePosition=0;
  function coronaField(image){
    // Apodize only the edge of the square detector field, beyond the photographed limb.
    const field=document.createElement("canvas");field.width=image.naturalWidth;field.height=image.naturalHeight;
    const surface=field.getContext("2d"),r=field.width/2;
    surface.drawImage(image,0,0);
    const edge=surface.createRadialGradient(r,r,r*.895,r,r,r);
    edge.addColorStop(0,"#000");edge.addColorStop(.35,"rgba(0,0,0,.83)");edge.addColorStop(.77,"rgba(0,0,0,.14)");edge.addColorStop(1,"transparent");
    surface.globalCompositeOperation="destination-in";surface.fillStyle=edge;surface.fillRect(0,0,field.width,field.height);
    return field;
  }
  function request(file){
    if(!pictures.has(file)&&!pending.has(file)&&performance.now()>=(retryAt.get(file)??0)){
      pending.add(file);const image=new Image();image.decoding="async";
      image.onload=()=>{pending.delete(file);retryAt.delete(file);pictures.set(file,file.startsWith("sun-euv")?coronaField(image):image);invalidate();};
      image.onerror=()=>{pending.delete(file);retryAt.set(file,performance.now()+15000);};
      image.src=LabMedia.file("assets/space/"+file+".webp");
    }
    return pictures.get(file);
  }
  function advance(s,seconds){
    const visible=s.scope==="wide"&&!s.actualSize||s.scope==="sun"&&s.sunBand==="radiant";
    if(!visible||!s.coronaPlaying||!pictures.has("corona-optical"))return false;
    if(s.applied&&!s.split&&(s.kind==="vanish"||s.kind==="black"))return false;
    const delta=Math.min(seconds,.25);
    framePosition=(framePosition+delta*corona.fps)%corona.count;
    return delta>0;
  }
  function starlight(ctx,q){
    const r=q.radius,reach=r*3.2,scatter=request("sun-scatter");
    ctx.save();ctx.globalCompositeOperation="screen";
    if(scatter)ctx.drawImage(scatter,q.x-reach,q.y-reach,2*reach,2*reach);
    else{
      const light=ctx.createRadialGradient(q.x,q.y,.84*r,q.x,q.y,reach);
      light.addColorStop(0,"rgba(255,236,187,.83)");light.addColorStop(.09,"rgba(255,217,150,.42)");light.addColorStop(.34,"rgba(248,189,100,.13)");light.addColorStop(1,"rgba(244,164,78,0)");ctx.fillStyle=light;ctx.fillRect(q.x-reach,q.y-reach,reach*2,reach*2);
    }
    ctx.restore();
  }
  function luminousDisk(ctx,q,s,close=false){
    starlight(ctx,q);
    const lite=request("sun-radiant"),surface=close?(request("sun-radiant-close")||lite):lite;
    const poster=request("corona-optical-poster"),sequence=s.coronaPlaying?request("corona-optical"):pictures.get("corona-optical");
    const size=q.radius/corona.diskFraction,x=q.x-size/2,y=q.y-size/2;
    ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.globalCompositeOperation="lighter";
    if(sequence){
      const first=Math.floor(framePosition),mix=framePosition-first;
      for(let i=0;i<2;i++){
        const weight=i===0?1-mix:mix;if(weight===0)continue;
        const frame=(first+i)%corona.count,sx=(frame%corona.columns)*corona.tile,sy=Math.floor(frame/corona.columns)*corona.tile;
        ctx.globalAlpha=.94*weight;ctx.drawImage(sequence,sx,sy,corona.tile,corona.tile,x,y,size,size);
      }
    }else if(poster){ctx.globalAlpha=.94;ctx.drawImage(poster,x,y,size,size);}
    ctx.restore();ctx.save();
    const r=q.radius;
    if(surface){ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(surface,q.x-r,q.y-r,r*2,r*2);}
    else{const core=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,r);core.addColorStop(0,"#fffbed");core.addColorStop(.82,"#ffedbf");core.addColorStop(1,"#eeb96f");ctx.fillStyle=core;ctx.beginPath();ctx.arc(q.x,q.y,r,0,tau);ctx.fill();}
    ctx.restore();
  }
  function disk(ctx,q,c,s,companion){
    const observational=c.closeBody===0&&!companion&&s.sunBand!=="radiant";
    if(!observational&&!s.actualSize&&q.radius>=2&&!companion){luminousDisk(ctx,q,s,c.closeBody===0);return;}
    if(c.closeBody===0&&s.sunBand==="radiant"&&!companion){luminousDisk(ctx,q,s,true);return;}
    const close=c.closeBody===0&&!companion;
    const band=close&&s.sunBand==="euv"?"euv":"visible";
    const g=geometry[band],lite=request("sun-"+band+"-lite");
    const full=close&&lite?request("sun-"+band):null;
    const photo=full||lite,r=q.radius;
    if(r<.65){ctx.fillStyle="#eeeae0";ctx.fillRect(q.x-.45,q.y-.45,.9,.9);return;}
    ctx.save();
    if(!close&&r>2){
      starlight(ctx,q);
    }
    ctx.beginPath();ctx.arc(q.x,q.y,r,0,tau);
    if(!photo){ctx.fillStyle="#e6e4dc";ctx.fill();ctx.restore();return;}
    const size=r/g.r;
    if(band==="visible")ctx.clip();
    else{ctx.fillStyle="#020202";ctx.fill();ctx.globalCompositeOperation="screen";}
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
    ctx.drawImage(photo,q.x-size*g.cx,q.y-size*g.cy,size,size);
    ctx.restore();
  }
  function granules(ctx,p,zoom,panX,panY){
    ctx.fillStyle="#030404";ctx.fillRect(p.x,p.y,p.w,p.h);
    const image=request("sun-granules");
    if(!image)return;
    const side=Math.min(p.w,p.h)*Math.max(1,zoom);
    const dx=Math.max(0,(side-p.w)/2),dy=Math.max(0,(side-p.h)/2);
    const x=p.x+(p.w-side)/2+Math.max(-dx,Math.min(dx,panX*p.w*.2));
    const y=p.y+(p.h-side)/2+Math.max(-dy,Math.min(dy,panY*p.h*.2));
    ctx.drawImage(image,x,y,side,side);
    const km=5000,length=side*km/30720,barX=p.x+16,barY=p.y+p.h-13;
    ctx.fillStyle="#f4f3ec";ctx.shadowColor="#000";ctx.shadowBlur=4;
    ctx.fillRect(barX,barY,length,1);ctx.font="11px sans-serif";ctx.fillText("5,000 km",barX,barY-6);ctx.shadowBlur=0;
  }
  return {disk,granules,advance};
};
