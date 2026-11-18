// Registered optical and Gaia skies share one Galactic-coordinate projection.
// Each face has its own texture so a phone need not allocate a full 8K panorama.
globalThis.createSurveySky = function createSurveySky(invalidate) {
  "use strict";
  const names=["px","nx","py","ny","pz","nz"];
  const faces=names.map(name=>({name,low:null,high:null,pixels:null,texture:null,uploaded:null,retry:0,delay:0,loading:false,lastVisible:0}));
  const canvas=document.createElement("canvas"),cpu=document.createElement("canvas");
  const ctx=cpu.getContext("2d",{alpha:false});
  let gl,program,orientation,aperture,offset,gain,positiveSides,negativeSides,frame,wanted=[],inFlight=0,retryTimer;
  let dir="",generation=0;
  function initialize(){
    const vertex="attribute vec2 corner; varying vec2 screen; void main(){screen=corner; gl_Position=vec4(corner,0.,1.);}";
    const derivatives=gl.getExtension("OES_standard_derivatives");
    const textureLod=derivatives&&gl.getExtension("EXT_shader_texture_lod");
    // Implicit per-face mip derivatives jump at face boundaries. Derive the
    // footprint from the continuous sky ray before selecting a face.
    const extensions=textureLod?"#extension GL_EXT_shader_texture_lod : enable\n#extension GL_OES_standard_derivatives : enable\n#define EXPLICIT_LOD\n":"";
    const fragment=extensions+`precision highp float;
      varying vec2 screen; uniform vec2 aperture,offset; uniform mat3 orientation; uniform float gain;
      uniform sampler2D px,nx,py,ny,pz,nz;
      vec3 sampleFace(sampler2D face,vec2 uv,float lod){
        #ifdef EXPLICIT_LOD
          return texture2DLodEXT(face,uv,lod).rgb;
        #else
          return texture2D(face,uv).rgb;
        #endif
      }
      uniform vec3 positiveSides,negativeSides;
      void main(){
        vec3 v=orientation*vec3((screen-offset)*aperture,-1.); vec3 a=abs(v),c;
        float footprint=0.;
        #ifdef EXPLICIT_LOD
          footprint=.5*max(length(dFdx(v)),length(dFdy(v)))/max(a.x,max(a.y,a.z));
        #endif
        if(a.x>=a.y&&a.x>=a.z){
          if(v.x>0.)c=sampleFace(px,.5+.5*vec2(-v.y,-v.z)/a.x,log2(max(1.,footprint*positiveSides.x)));
          else c=sampleFace(nx,.5+.5*vec2(v.y,-v.z)/a.x,log2(max(1.,footprint*negativeSides.x)));
        }else if(a.y>=a.z){
          if(v.y>0.)c=sampleFace(py,.5+.5*vec2(v.x,-v.z)/a.y,log2(max(1.,footprint*positiveSides.y)));
          else c=sampleFace(ny,.5+.5*vec2(-v.x,-v.z)/a.y,log2(max(1.,footprint*negativeSides.y)));
        }else{
          if(v.z>0.)c=sampleFace(pz,.5+.5*vec2(-v.y,v.x)/a.z,log2(max(1.,footprint*positiveSides.z)));
          else c=sampleFace(nz,.5+.5*vec2(-v.y,-v.x)/a.z,log2(max(1.,footprint*negativeSides.z)));
        }
        gl_FragColor=vec4(max(vec3(0.),c-.003)*gain,1.);
      }`;
    program=gl.createProgram();
    for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
      const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);
      if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));
      gl.attachShader(program,sh);gl.deleteShader(sh);
    }
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const corner=gl.getAttribLocation(program,"corner");
    gl.enableVertexAttribArray(corner);gl.vertexAttribPointer(corner,2,gl.FLOAT,false,0,0);
    [orientation,aperture,offset,gain,positiveSides,negativeSides]=["orientation","aperture","offset","gain","positiveSides","negativeSides"].map(k=>gl.getUniformLocation(program,k));
    for(const [i,face] of faces.entries()){
      face.uploaded=null;
      face.pixels=null;
      face.texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,face.texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,1,1,0,gl.RGB,gl.UNSIGNED_BYTE,new Uint8Array(3));
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.uniform1i(gl.getUniformLocation(program,face.name),i);
    }
  }
  function startWebGL(){
    gl=canvas.getContext("webgl",{alpha:false,depth:false,antialias:false});
    if(gl){try{initialize();}catch{gl=null;}}
  }
  startWebGL();
  canvas.addEventListener("webglcontextlost",event=>{event.preventDefault();gl=null;invalidate();});
  canvas.addEventListener("webglcontextrestored",()=>{startWebGL();invalidate();});
  function selectSource(photographic){
    const next="assets/space/"+(photographic?"photographic/":"galactic/");
    if(dir===next)return;
    dir=next;
    const current=++generation;
    clearTimeout(retryTimer);inFlight=0;
    // The registered low-resolution faces cover the same directions during a switch.
    for(const face of faces)Object.assign(face,{high:null,pixels:null,loading:false,retry:0,delay:0});
    const preview=new Image();
    preview.onload=()=>{
      if(current!==generation)return;
      const side=preview.naturalHeight;
      for(const [i,face] of faces.entries()){
        face.low=document.createElement("canvas");face.low.width=face.low.height=side;
        face.low.getContext("2d").drawImage(preview,i*side,0,side,side,0,0,side,side);
      }
      invalidate();
    };
    preview.src=LabMedia.file(dir+"preview.webp");
  }
  function requestFaces(){
    clearTimeout(retryTimer);
    if(document.hidden)return;
    const now=performance.now();
    let nextRetry=Infinity;
    for(const i of wanted){
      if(inFlight>=2)break;
      const face=faces[i];
      if(face.high||face.loading)continue;
      if(face.retry){
        if(!navigator.onLine)continue;
        if(face.retry>now){nextRetry=Math.min(nextRetry,face.retry);continue;}
      }
      face.loading=true;inFlight++;
      const current=generation;
      const im=new Image();im.decoding="async";
      const finish=()=>{face.loading=false;inFlight--;requestFaces();};
      im.onload=()=>{
        if(current!==generation)return;
        face.retry=face.delay=0;
        if(wanted.includes(i)){face.high=im;invalidate();}
        finish();
      };
      im.onerror=()=>{
        if(current!==generation)return;
        face.delay=Math.min(60000,face.delay?face.delay*2:2000);
        face.retry=performance.now()+face.delay;finish();
      };
      im.src=LabMedia.file(dir+face.name+".webp");
    }
    if(Number.isFinite(nextRetry))retryTimer=setTimeout(requestFaces,Math.max(1,Math.ceil(nextRetry-performance.now())));
  }
  window.addEventListener("online",()=>{
    for(const i of wanted)faces[i].retry=faces[i].delay=0;
    requestFaces();
  });
  document.addEventListener("visibilitychange",requestFaces);
  const empty={width:1,data:new Uint8Array(4)};
  function raster(face){
    const source=face.high||face.low;if(!source)return empty;
    if(face.pixels?.source===source)return face.pixels;
    const tile=document.createElement("canvas");tile.width=tile.height=source.width;
    const read=tile.getContext("2d",{willReadFrequently:true});read.drawImage(source,0,0);
    face.pixels={source,width:tile.width,data:read.getImageData(0,0,tile.width,tile.height).data};
    return face.pixels;
  }
  function software(w,h,m,ax,ay,ox,oy,light){
    if(cpu.width!==w||cpu.height!==h||!frame){cpu.width=w;cpu.height=h;frame=ctx.createImageData(w,h);}
    const tiles=faces.map(raster),dst=frame.data;
    const tone=Uint8ClampedArray.from({length:256},(_,i)=>Math.max(0,i-.765)*light);
    for(let y=0,k=0;y<h;y++){
      const ry=(1-2*(y+.5)/h-oy)*ay;
      const bx=ry*m[3]-m[6],by=ry*m[4]-m[7],bz=ry*m[5]-m[8];
      for(let x=0;x<w;x++,k+=4){
        const rx=(2*(x+.5)/w-1-ox)*ax,dx=m[0]*rx+bx,dy=m[1]*rx+by,dz=m[2]*rx+bz;
        const xx=Math.abs(dx),yy=Math.abs(dy),zz=Math.abs(dz);
        let tile,u,v,major;
        if(xx>=yy&&xx>=zz){tile=tiles[dx>0?0:1];major=xx;u=dx>0?-dy:dy;v=-dz;}
        else if(yy>=zz){tile=tiles[dy>0?2:3];major=yy;u=dy>0?dx:-dx;v=-dz;}
        else{tile=tiles[dz>0?4:5];major=zz;u=-dy;v=dz>0?dx:-dx;}
        const n=tile.width,a=tile.data;
        u=Math.max(0,Math.min(n-1,(.5+.5*u/major)*n-.5));
        v=Math.max(0,Math.min(n-1,(.5+.5*v/major)*n-.5));
        const ix=Math.floor(u),iy=Math.floor(v),fx=u-ix,fy=v-iy;
        const tl=4*(iy*n+ix),tr=ix<n-1?tl+4:tl,bl=iy<n-1?tl+4*n:tl,br=bl+(tr-tl);
        for(let j=0;j<3;j++){
          const top=a[tl+j]+fx*(a[tr+j]-a[tl+j]),bottom=a[bl+j]+fx*(a[br+j]-a[bl+j]);
          dst[k+j]=tone[Math.round(top+fy*(bottom-top))];
        }
        dst[k+3]=255;
      }
    }
    ctx.putImageData(frame,0,0);return cpu;
  }
  function render({p,c,exposure:light,m,ax,ay,ox,oy},ratio){
    const moving=c.cruising||c.flyby;
    const scale=gl?Math.min(ratio,moving?1.5:2,(moving?2450:4096)/p.w,2500/p.h):
      Math.min(ratio,moving?1:1.75,(c.flyby?800:moving?1150:2250)/p.w,(c.flyby?580:moving?820:1550)/p.h);
    const w=Math.max(1,Math.round(p.w*scale)),h=Math.max(1,Math.round(p.h*scale));
    if(!gl)return software(w,h,m,ax,ay,ox,oy,light);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    for(const [i,face] of faces.entries()){
      const source=face.high||face.low;if(!source||face.uploaded===source)continue;
      gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,face.texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,source);
      gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
      face.uploaded=source;
    }
    gl.viewport(0,0,w,h);gl.uniformMatrix3fv(orientation,false,m);gl.uniform2f(aperture,ax,ay);
    gl.uniform3f(positiveSides,faces[0].uploaded?.width||1,faces[2].uploaded?.width||1,faces[4].uploaded?.width||1);
    gl.uniform3f(negativeSides,faces[1].uploaded?.width||1,faces[3].uploaded?.width||1,faces[5].uploaded?.width||1);
    gl.uniform2f(offset,ox,oy);gl.uniform1f(gain,light);gl.drawArrays(gl.TRIANGLES,0,3);return canvas;
  }
  const screen=[[-1,-1],[1,-1],[1,1],[-1,1]];
  function clip(polygon,a,b,c){
    const output=[];
    let last=polygon[polygon.length-1],d0=a*last[0]+b*last[1]+c;
    for(const point of polygon){
      const d1=a*point[0]+b*point[1]+c;
      if((d0>=0)!==(d1>=0)){
        const t=d0/(d0-d1);
        output.push([last[0]+t*(point[0]-last[0]),last[1]+t*(point[1]-last[1])]);
      }
      if(d1>=0)output.push(point);
      last=point;d0=d1;
    }
    return output;
  }
  function visibleArea(face,axes){
    // A face owns the rays for which its signed axis exceeds both other
    // absolute components. Each of the four boundaries is a line on screen.
    const axis=Math.floor(face/2),sign=face%2?-1:1,major=axes[axis];
    let polygon=screen;
    for(let k=0;k<3;k++){
      if(k===axis)continue;
      const minor=axes[k];
      for(const edge of [-1,1]){
        polygon=clip(polygon,sign*major[0]+edge*minor[0],sign*major[1]+edge*minor[1],sign*major[2]+edge*minor[2]);
        if(polygon.length<3)return 0;
      }
    }
    let twiceArea=0,prev=polygon[polygon.length-1];
    for(const p of polygon){twiceArea+=prev[0]*p[1]-prev[1]*p[0];prev=p;}
    return Math.abs(twiceArea)/2;
  }
  return function paint(context,views,ratio){
    const areas=faces.map(()=>0),now=performance.now();
    const frames=[];
    for(const {pane:p,camera:c,exposure} of views){
      if(!c.surveySky)continue;
      const m=[c.right,c.up,c.front].flatMap(OrbitFrames.galactic);
      const ax=p.w/(2*c.skyFocal),ay=p.h/(2*c.skyFocal),ox=2*c.principal[0]-1,oy=1-2*c.principal[1];
      const axes=[0,1,2].map(k=>[m[k]*ax,m[k+3]*ay,-m[k+6]-ox*m[k]*ax-oy*m[k+3]*ay]);
      for(let i=0;i<faces.length;i++)areas[i]+=visibleArea(i,axes)*p.w*p.h/4;
      frames.push({p,c,exposure,m,ax,ay,ox,oy});
    }
    if(frames.length)selectSource(!!frames[0].c.photographic);
    wanted=faces.map((_,i)=>i).filter(i=>areas[i]>0).sort((a,b)=>areas[b]-areas[a]);
    for(const i of wanted)faces[i].lastVisible=now;
    // Keep one recently visible neighbour for pans across a face boundary.
    const spare=faces.filter((face,i)=>face.high&&!areas[i]).sort((a,b)=>b.lastVisible-a.lastVisible);
    for(const face of spare.slice(frames.length?1:0)){face.high=null;face.pixels=null;}
    requestFaces();
    for(const view of frames){
      const p=view.p;
      context.drawImage(render(view,ratio),p.x,p.y,p.w,p.h);
    }
  };
};
