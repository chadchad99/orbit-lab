(() => {
  "use strict";
  const {bodies,orbitAt,point,DAY} = OrbitModel;
  const TAU = Math.PI*2;
  const clamp = (n,lo,hi) => Math.min(hi,Math.max(lo,n));
  const sizes = [64,12,19,22,16,44,67,26,25];
  const orbitRadii = [0,.164,.264,.357,.463,.636,.758,.879,1];
  const semimajor = [0,.3871,.7233,1,1.5237,5.2029,9.5367,19.1892,30.0699];
  const labelFont = '"Orbit Korean","Apple SD Gothic Neo","Malgun Gothic",sans-serif';

  function randomSeries(seed) {
    return () => {
      seed = (Math.imul(1664525,seed)+1013904223)>>>0;
      return seed/4294967296;
    };
  }

  // The background is an illustrative star field, independent of the orbital model.
  function paintStars(canvas,width,height,pixelRatio) {
    const ctx = canvas.getContext("2d");
    canvas.width = Math.round(width*pixelRatio);
    canvas.height = Math.round(height*pixelRatio);
    ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
    const random = randomSeries(829106);
    const texture = document.createElement("canvas");
    texture.width = 280;
    texture.height = Math.max(100,Math.round(280*height/width));
    const tex = texture.getContext("2d");
    const dust = tex.createImageData(texture.width,texture.height);
    const noise = Array.from({length:4096},random);
    function sample(x,y) {
      const i = Math.floor(x), j = Math.floor(y);
      let fx = x-i, fy = y-j;
      fx *= fx*(3-2*fx); fy *= fy*(3-2*fy);
      const row = ((j&63)<<6), row2 = (((j+1)&63)<<6);
      const a = noise[row+(i&63)]*(1-fx)+noise[row+((i+1)&63)]*fx;
      const b = noise[row2+(i&63)]*(1-fx)+noise[row2+((i+1)&63)]*fx;
      return a*(1-fy)+b*fy;
    }
    for(let y=0;y<texture.height;y++) {
      for(let x=0;x<texture.width;x++) {
        const u=x/texture.width, v=y/texture.height;
        const band = Math.exp(-Math.pow((v-.80+.69*u+.06*Math.sin(u*6))/.18,2));
        const grain = .55*sample(u*7+3,v*7)+.27*sample(u*16,v*16+4)+.12*sample(u*39,v*39)+.06*sample(u*95,v*95);
        const cloud = band*Math.max(0,(grain-.24)) + grain*.12;
        const vignette = Math.max(0,1-Math.hypot((u-.48)*1.19,(v-.48)*.72));
        const k = (y*texture.width+x)*4;
        dust.data[k]=5+vignette*4+cloud*22;
        dust.data[k+1]=9+vignette*5+cloud*26;
        dust.data[k+2]=15+vignette*8+cloud*43;
        dust.data[k+3]=255;
      }
    }
    tex.putImageData(dust,0,0);
    ctx.drawImage(texture,0,0,width,height);
    const count = Math.max(250,Math.round(width*height/365));
    for(let i=0;i<count;i++) {
      const x=random()*width,y=random()*height;
      const power = Math.pow(random(),3.2);
      const radius = .28+power*.82;
      const tint = random();
      const rgb = tint<.17?"238,208,173":tint>.69?"161,193,232":"208,219,233";
      ctx.fillStyle="rgba("+rgb+","+(0.14+power*.62)+")";
      ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fill();
      if(power>.969) {
        const size=radius*(2.5+random()*1.5);
        const glow=ctx.createRadialGradient(x,y,0,x,y,size);
        glow.addColorStop(0,"rgba("+rgb+",.31)");glow.addColorStop(1,"rgba("+rgb+",0)");
        ctx.fillStyle=glow;ctx.fillRect(x-size,y-size,size*2,size*2);
        ctx.strokeStyle="rgba("+rgb+",.21)";ctx.lineWidth=.55;
        ctx.beginPath();ctx.moveTo(x-size,y);ctx.lineTo(x+size,y);ctx.moveTo(x,y-size);ctx.lineTo(x,y+size);ctx.stroke();
      }
    }
  }

  function makeBelt() {
    const random = randomSeries(662794), result=[];
    for(let i=0;i<1850;i++) {
      const au=2.05+((random()+random()+random())/3)*1.42;
      const angle=random()*TAU;
      const frac=Math.log(au/semimajor[4])/Math.log(semimajor[5]/semimajor[4]);
      const r=orbitRadii[4]+frac*(orbitRadii[5]-orbitRadii[4]);
      const z=(random()-.5)*(random()-.5)*.15;
      const unit=[Math.cos(angle),Math.sin(angle),z];
      result.push({compact:unit.map(n=>n*r),linear:unit.map(n=>n*au/semimajor[8]),size:.32+random()*.62,tone:Math.floor(random()*4)});
    }
    return result;
  }

  function makeSky(canvas,starCanvas,onSelect,onCamera) {
    const ctx = canvas.getContext("2d");
    const trackCanvas = document.createElement("canvas");
    const tracks = trackCanvas.getContext("2d");
    const images = bodies.map(body => {
      const image = new Image();
      image.onload = () => {dirty=true};
      image.src = "assets/"+body.id+".webp";
      return image;
    });
    const belt = makeBelt();
    const settings={paths:true,names:true,belt:true,scale:"compact"};
    const baseYaw = -.77, baseElev=.45;
    let yaw=baseYaw,elevation=baseElev,zoom=1,mode="3d";
    let width=0,height=0,pixelRatio=1,dirty=true,trackKey="",cameraRevision=0;
    let selected=3,positions=[],labels=[];
    let camera;
    const pointers=new Map();
    let gesture=null;
    function invalidate() { dirty=true }
    function changeCamera() {
      cameraRevision++;
      dirty=true;
      onCamera({zoom,mode});
    }
    function resize() {
      const box=canvas.getBoundingClientRect();
      if(box.width<1 || box.height<1) return;
      const nextRatio=Math.min(window.devicePixelRatio||1,2);
      if(width===box.width && height===box.height && pixelRatio===nextRatio) return;
      width=box.width;height=box.height;pixelRatio=nextRatio;
      canvas.width=Math.round(width*pixelRatio);canvas.height=Math.round(height*pixelRatio);
      trackCanvas.width=canvas.width;trackCanvas.height=canvas.height;
      ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
      tracks.setTransform(pixelRatio,0,0,pixelRatio,0,0);
      paintStars(starCanvas,width,height,pixelRatio);
      changeCamera();
    }
    const observer=new ResizeObserver(resize);
    observer.observe(canvas);
    function setZoom(value) {
      const next=clamp(value,.65,64);
      if(next!==zoom) {zoom=next;changeCamera()}
    }
    function setMode(value) { mode=value;changeCamera() }
    function reset() {yaw=baseYaw;elevation=baseElev;zoom=1;mode="3d";changeCamera()}
    function setSettings(next) {
      Object.assign(settings,next);
      trackKey="";
      dirty=true;
    }
    function select(index) { selected=index;dirty=true;trackKey="" }

    function prepareCamera() {
      const narrow=width<530;
      const portraitFactor=clamp((1.62-width/height)/.62,0,1);
      const tilt=mode==="2d"?Math.PI/2:clamp(elevation+portraitFactor*.20,.12,1.48);
      const roll=mode==="2d"?0:-.24-portraitFactor*.46;
      const ca=Math.cos(yaw),sa=Math.sin(yaw),cr=Math.cos(roll),sr=Math.sin(roll);
      const se=Math.sin(tilt),ce=Math.cos(tilt);
      const xExtent=Math.hypot(cr,sr*se),yExtent=Math.hypot(sr,cr*se);
      const xPadding=narrow?18:Math.max(25,width*.035);
      const yPadding=narrow?32:Math.max(25,height*.067);
      const radius=Math.min((width/2-xPadding)/xExtent,(height/2-yPadding)/yExtent)*zoom;
      const x0=width*.50,y0=height*.507;
      const xx= radius*(ca*cr-sa*se*sr),xy=radius*(sa*cr+ca*se*sr),xz=radius*ce*sr;
      const yx=radius*(ca*sr+sa*se*cr),yy=radius*(sa*sr-ca*se*cr),yz=-radius*ce*cr;
      camera={x0,y0,xx,xy,xz,yx,yy,yz,sa,ca,se,ce};
    }
    function project(x,y,z) {
      const c=camera;
      return {x:c.x0+c.xx*x+c.xy*y+c.xz*z,y:c.y0+c.yx*x+c.yy*y+c.yz*z,depth:(x*c.sa-y*c.ca)*c.ce+z*c.se};
    }
    function relativeScale(orbit,index) {
      return settings.scale==="linear"?1/semimajor[8]:orbitRadii[index]/orbit.a;
    }
    function projectOrbit(orbit,anomaly,scale) {
      const p=point(orbit,anomaly);
      return project(p[0]*scale,p[1]*scale,p[2]*scale);
    }

    function drawTracks(orbits) {
      tracks.clearRect(0,0,width,height);
      if(settings.belt) {
        const beltScale=settings.scale;
        const shades=["rgba(147,157,169,.28)","rgba(183,168,151,.37)","rgba(189,200,208,.39)","rgba(219,197,165,.55)"];
        for(const d of belt) {
          const [x,y,z]=d[beltScale];
          const p=project(x,y,z);
          if(p.x<-1||p.x>width+1||p.y<-1||p.y>height+1)continue;
          tracks.fillStyle=shades[d.tone];const size=d.size*(width<490?.83:1);
          tracks.fillRect(p.x,p.y,size,size);
        }
      }
      if(!settings.paths) return;
      orbits.forEach((o,k) => {
        const index=k+1;
        const scale=relativeScale(o,index);
        const active=selected===index;
        const divisions=zoom>3?250:160;
        tracks.beginPath();
        for(let j=0;j<=divisions;j++) {
          const p=projectOrbit(o,j*TAU/divisions,scale);
          if(j===0) tracks.moveTo(p.x,p.y);else tracks.lineTo(p.x,p.y);
        }
        tracks.closePath();
        tracks.lineWidth=active?1.35:.95;
        tracks.strokeStyle=active?"rgba(236,173,90,.76)":(index<5?"rgba(135,151,172,.52)":"rgba(141,157,179,.51)");
        tracks.stroke();
      });
    }

    function sunlight(x,y,r) {
      const rr=r*4.4;
      const glow=ctx.createRadialGradient(x,y,r*.62,x,y,rr);
      glow.addColorStop(0,"rgba(255,208,99,.94)");
      glow.addColorStop(.11,"rgba(255,158,47,.60)");
      glow.addColorStop(.25,"rgba(250,120,31,.31)");
      glow.addColorStop(.51,"rgba(209,91,27,.075)");
      glow.addColorStop(1,"rgba(167,77,31,0)");
      ctx.fillStyle=glow;ctx.fillRect(x-rr,y-rr,rr*2,rr*2);
    }
    function paintBody(p) {
      const {x,y,size,index}=p,r=size/2,body=bodies[index],img=images[index];
      if(x+r<0||x-r>width||y+r<0||y-r>height) return;
      if(index===0) sunlight(x,y,r);
      if(img.complete && img.naturalWidth) {
        ctx.drawImage(img,x-r,y-r,size,size);
        if(index===0) {
          ctx.save();ctx.globalCompositeOperation="screen";ctx.globalAlpha=.61;
          ctx.drawImage(img,x-r,y-r,size,size);
          const surface=ctx.createRadialGradient(x-r*.2,y-r*.2,0,x,y,r*.92);
          surface.addColorStop(0,"rgba(255,196,80,.40)");surface.addColorStop(.82,"rgba(255,163,52,.23)");surface.addColorStop(1,"rgba(255,157,43,0)");
          ctx.globalAlpha=1;ctx.fillStyle=surface;ctx.fillRect(x-r,y-r,size,size);ctx.restore();
        }
        if(index!==0 && body.id!=="saturn") {
          const angle=Math.atan2(y-camera.y0,x-camera.x0);
          const dx=Math.cos(angle)*r,dy=Math.sin(angle)*r;
          const shadow=ctx.createLinearGradient(x-dx,y-dy,x+dx,y+dy);
          shadow.addColorStop(0,"rgba(0,2,8,0)");shadow.addColorStop(.43,"rgba(0,2,8,0)");shadow.addColorStop(1,"rgba(0,2,8,.65)");
          ctx.fillStyle=shadow;ctx.beginPath();ctx.arc(x,y,r*.93,0,TAU);ctx.fill();
        }
      } else {
        const fill=ctx.createRadialGradient(x-r*.31,y-r*.34,r*.06,x,y,r);
        fill.addColorStop(0,"#fff0d7");fill.addColorStop(.35,body.color);fill.addColorStop(1,index===0?"#db862c":"#26303d");
        ctx.fillStyle=fill;ctx.beginPath();ctx.arc(x,y,r*.93,0,TAU);ctx.fill();
      }
      if(index===selected) {
        const radius=(body.id==="saturn"?size*.51:r)+3.5;
        ctx.lineWidth=1.35;ctx.strokeStyle="#f2bc75";
        ctx.beginPath();
        for(let n=0;n<4;n++) {
          const a=n*Math.PI/2+.22;ctx.moveTo(x+radius*Math.cos(a),y+radius*Math.sin(a));
          ctx.arc(x,y,radius,a,a+1.07);
        }
        ctx.stroke();
      }
    }
    function overlap(a,b) {
      return Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
    }
    function roundRect(x,y,w,h,r) {
      ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
      ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
    }
    function drawLabels() {
      labels=[];
      if(!settings.names)return;
      const small=width<510;
      const fontSize=small?10.5:12;
      ctx.font="550 "+fontSize+"px "+labelFont;
      ctx.textBaseline="middle";
      const visible=positions.filter(p=>p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height);
      const occupied=visible.map(p=>({x:p.x-p.size*.49-2,y:p.y-p.size*(p.index===6?.30:.49)-2,w:p.size*.98+4,h:p.size*(p.index===6?.60:.98)+4}));
      occupied.push({x:0,y:0,w:87,h:37},{x:width-131,y:0,w:131,h:45},{x:width-146,y:height-46,w:146,h:46},{x:0,y:height-34,w:127,h:34});
      const ordered=visible.slice().sort((a,b)=>Number(b.index===selected)-Number(a.index===selected)||b.size-a.size);
      for(const p of ordered) {
        const active=p.index===selected;
        const name=bodies[p.index].name;
        const w=Math.ceil(ctx.measureText(name).width)+(active?12:6),h=active?21:17;
        const r=p.size*.5+(active?5:1),ry=p.index===6?r*.65:r;
        const side=p.x<camera.x0?-1:1;
        const vertical=p.y<camera.y0?-1:1;
        const candidates=[];
        for(const extra of [0,9,21,36]) {
          for(const [dx,dy] of [[side,.3],[side,vertical*.92],[-side,.35],[0,vertical],[0,-vertical],[-side,-vertical*.85],[side,-vertical*.85]]) {
            const x=p.x+dx*(r+2+extra)+(dx>0?0:dx<0?-w:-w/2);
            const y=p.y+dy*(ry+extra)+(Math.abs(dx)<.1?(dy>0?1:-h-1):-h/2);
            candidates.push({x,y,w,h,index:p.index,extra});
          }
        }
        let box=candidates[0],best=Infinity;
        for(let k=0;k<candidates.length;k++){
          const c=candidates[k];
          let cost=k*.18+c.extra*.6;
          if(c.x<2||c.x+w>width-2||c.y<2||c.y+h>height-2)cost+=1e4;
          for(const other of occupied)cost+=overlap(c,other)*4;
          if(cost<best){best=cost;box=c}
        }
        if(box.x<0||box.y<0||box.x+w>width||box.y+h>height) continue;
        if(box.extra>=9) {
          const endX=clamp(p.x,box.x,box.x+w),endY=clamp(p.y,box.y,box.y+h);
          const angle=Math.atan2(endY-p.y,endX-p.x);
          ctx.strokeStyle=active?"#cea46a99":"#8091a080";ctx.lineWidth=.7;ctx.beginPath();
          ctx.moveTo(p.x+Math.cos(angle)*r,p.y+Math.sin(angle)*ry);ctx.lineTo(endX,endY);ctx.stroke();
        }
        if(active) {
          roundRect(box.x,box.y,w,h,4);ctx.fillStyle="#211c15ed";ctx.fill();ctx.strokeStyle="#b48951b3";ctx.lineWidth=.85;ctx.stroke();
        }
        ctx.fillStyle=active?"#ffcf8c":p.index===0?"#f1c88a":"#d0d9e6";
        ctx.shadowColor="#03060c";ctx.shadowBlur=4;ctx.fillText(name,box.x+(active?6:3),box.y+h/2+.5);ctx.shadowBlur=0;
        occupied.push({x:box.x-2,y:box.y-1,w:w+4,h:h+2});
        labels.push(box);
      }
    }
    function render(time) {
      if(!width || !height) resize();
      if(!width || !height) return;
      const key=[Math.floor(time/DAY),cameraRevision,selected,settings.paths,settings.belt,settings.scale].join("|");
      prepareCamera();
      const orbits=bodies.slice(1).map(b=>orbitAt(b.id,time));
      if(trackKey!==key) {drawTracks(orbits);trackKey=key}
      ctx.clearRect(0,0,width,height);
      ctx.drawImage(trackCanvas,0,0,width,height);
      const factor=clamp(Math.min(width/885,height/460),.57,1.34)*clamp(Math.pow(zoom,.15),.87,1.5);
      positions=[{index:0,x:camera.x0,y:camera.y0,depth:0,size:sizes[0]*factor}];
      orbits.forEach((orbit,k)=>{
        const index=k+1,scale=relativeScale(orbit,index);
        const p=projectOrbit(orbit,orbit.anomaly,scale);
        positions.push({...p,index,size:sizes[index]*factor});
      });
      positions.slice().sort((a,b)=>a.depth-b.depth).forEach(paintBody);
      drawLabels();dirty=false;
    }

    function pointerAt(event) {
      const rect=canvas.getBoundingClientRect();
      return {x:event.clientX-rect.left,y:event.clientY-rect.top};
    }
    function hit(x,y,touch=false) {
      const radiusExtra=touch?7:3;
      const near=positions.map(p=>({p,d:Math.hypot(p.x-x,p.y-y)}))
        .filter(({p,d})=>d<Math.max(touch?12:8,p.size/2+radiusExtra))
        .sort((a,b)=>a.d-b.d);
      if(near.length)return near[0].p.index;
      return labels.find(b=>x>=b.x-2 && x<=b.x+b.w+2 && y>=b.y-2 && y<=b.y+b.h+2)?.index ?? -1;
    }
    function twoDistance() {
      const [a,b]=pointers.values();return Math.hypot(a.x-b.x,a.y-b.y);
    }
    canvas.addEventListener("pointerdown",event=>{
      if(event.button!==0) return;
      const p=pointerAt(event);pointers.set(event.pointerId,p);
      canvas.setPointerCapture(event.pointerId);
      if(pointers.size===1) gesture={start:p,last:p,moved:false,pinched:false};
      else if(pointers.size===2) {gesture.pinched=true;gesture.distance=twoDistance();gesture.zoom=zoom}
    });
    canvas.addEventListener("pointermove",event=>{
      const p=pointerAt(event);
      if(!pointers.has(event.pointerId)) {
        canvas.classList.toggle("on-body",hit(p.x,p.y)>=0);return;
      }
      pointers.set(event.pointerId,p);
      if(pointers.size===2) {
        setZoom(gesture.zoom*twoDistance()/Math.max(1,gesture.distance));
      } else if(pointers.size===1 && !gesture.pinched) {
        if(Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)>3)gesture.moved=true;
        if(gesture.moved) {
          canvas.classList.add("dragging");canvas.classList.remove("on-body");
          yaw+=(p.x-gesture.last.x)*.008;
          if(mode==="3d")elevation=clamp(elevation+(p.y-gesture.last.y)*.006,.13,1.34);
          changeCamera();
        }
      }
      gesture.last=p;
    });
    function endPointer(event,cancel) {
      if(!pointers.has(event.pointerId))return;
      const p=pointerAt(event);
      if(!cancel&&!gesture.pinched&&!gesture.moved&&Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)<6) {
        const index=hit(p.x,p.y,event.pointerType==="touch");if(index>=0)onSelect(index);
      }
      pointers.delete(event.pointerId);
      if(!pointers.size){gesture=null;canvas.classList.remove("dragging")}
      if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    }
    canvas.addEventListener("pointerup",e=>endPointer(e,false));
    canvas.addEventListener("pointercancel",e=>endPointer(e,true));
    canvas.addEventListener("lostpointercapture",e=>endPointer(e,true));
    canvas.addEventListener("wheel",event=>{
      event.preventDefault();
      const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?height:1);
      setZoom(zoom*Math.exp(-clamp(delta,-320,320)*.0018));
    },{passive:false});
    canvas.addEventListener("keydown",event=>{
      if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","+","=","-","Home"].includes(event.key)) {
        event.preventDefault();
        if(event.key==="ArrowLeft"||event.key==="ArrowRight") {yaw+=event.key==="ArrowLeft"?-.12:.12;changeCamera()}
        if(event.key==="ArrowUp"||event.key==="ArrowDown") {if(mode==="3d")elevation=clamp(elevation+(event.key==="ArrowUp"?.1:-.1),.13,1.34);changeCamera()}
        if(event.key==="+"||event.key==="=")setZoom(zoom*1.25);
        if(event.key==="-")setZoom(zoom/1.25);
        if(event.key==="Home")reset();
      }
    });
    return {render,needsRender:()=>dirty,invalidate,select,setSettings,setMode,reset,zoomBy:f=>setZoom(zoom*f)};
  }
  globalThis.makeOrbitSky=makeSky;
})();
