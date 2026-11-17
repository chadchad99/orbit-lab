// Observed solar images are displayed in the orientation in which the instruments recorded them.
globalThis.createSolarOptics=function(invalidate){
  const pictures=new Map(),pending=new Set(),retryAt=new Map(),tau=2*Math.PI;
  const geometry={
    visible:{cx:.5,cy:.5,r:.386595},euv:{cx:.5,cy:.5,r:.386595}
  };
  const corona={columns:6,count:24,tile:320,diskFraction:.30,fps:4};
  let framePosition=0,untilPaint=0;
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
    if(s.scope!=="wide"||s.actualSize||!s.coronaPlaying||!pictures.has("corona-sequence"))return false;
    if(s.applied&&!s.split&&(s.kind==="vanish"||s.kind==="black"))return false;
    const delta=Math.min(seconds,.25);
    framePosition=(framePosition+delta*corona.fps)%corona.count;
    untilPaint-=delta;
    if(untilPaint>0)return false;
    untilPaint=1/24;
    return true;
  }
  function drawOverview(ctx,q,s){
    const surface=request("sun-atlas-visible"),poster=request("corona-limb-preview");
    const sequence=s.coronaPlaying?request("corona-sequence"):pictures.get("corona-sequence");
    const size=q.radius/corona.diskFraction,x=q.x-size/2,y=q.y-size/2;
    ctx.save();
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality="high";
    // Add the observed off-limb radiance behind the opaque white-light photosphere.
    ctx.globalCompositeOperation="lighter";
    if(sequence){
      const first=Math.floor(framePosition),mix=framePosition-first;
      for(let i=0;i<2;i++){
        const weight=i===0?1-mix:mix;
        if(weight===0)continue;
        const frame=(first+i)%corona.count;
        const sx=(frame%corona.columns)*corona.tile,sy=Math.floor(frame/corona.columns)*corona.tile;
        ctx.globalAlpha=weight;
        ctx.drawImage(sequence,sx,sy,corona.tile,corona.tile,x,y,size,size);
      }
    }else if(poster){
      ctx.drawImage(poster,x,y,size,size);
    }
    ctx.restore();
    if(!surface)return false;
    ctx.save();
    ctx.beginPath();ctx.arc(q.x,q.y,q.radius,0,tau);ctx.clip();
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
    ctx.drawImage(surface,q.x-q.radius,q.y-q.radius,q.radius*2,q.radius*2);
    ctx.restore();
    return true;
  }
  function disk(ctx,q,c,s,companion){
    if(!companion&&s.scope==="wide"&&!s.actualSize&&drawOverview(ctx,q,s))return;
    const close=c.closeBody===0&&!companion;
    const band=close&&s.sunBand==="euv"?"euv":"visible";
    const g=geometry[band],lite=request("sun-"+band+"-lite");
    const full=close&&lite?request("sun-"+band):null;
    const photo=full||lite,r=q.radius;
    if(r<.65){ctx.fillStyle="#eeeae0";ctx.fillRect(q.x-.45,q.y-.45,.9,.9);return;}
    ctx.save();
    if(!close&&r>2){
      const glow=ctx.createRadialGradient(q.x,q.y,r*.96,q.x,q.y,r*1.65);
      glow.addColorStop(0,"rgba(240,224,192,.09)");glow.addColorStop(.28,"rgba(231,212,176,.026)");glow.addColorStop(1,"rgba(225,209,180,0)");
      ctx.fillStyle=glow;ctx.fillRect(q.x-1.65*r,q.y-1.65*r,r*3.3,r*3.3);
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
