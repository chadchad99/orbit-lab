// NASA/SVS Galactic-coordinate sky, with the bright catalogue stars drawn separately.
// Each face has its own texture so a phone need not allocate a full 8K panorama.
globalThis.createSurveySky = function createSurveySky(invalidate) {
  "use strict";
  const names=["px","nx","py","ny","pz","nz"];
  const faces=names.map(name=>({name,low:null,high:null,pixels:null,texture:null,uploaded:null,retry:0,loading:false}));
  const canvas=document.createElement("canvas"),cpu=document.createElement("canvas");
  const ctx=cpu.getContext("2d",{alpha:false});
  let gl=canvas.getContext("webgl",{alpha:false,depth:false,antialias:false});
  let program,orientation,aperture,offset,gain,frame,wanted=[],inFlight=0;
  const dir="assets/space/galactic/";
  function initialize(){
    const vertex="attribute vec2 corner; varying vec2 screen; void main(){screen=corner; gl_Position=vec4(corner,0.,1.);}";
    const fragment=`precision highp float;
      varying vec2 screen; uniform vec2 aperture,offset; uniform mat3 orientation; uniform float gain;
      uniform sampler2D px,nx,py,ny,pz,nz;
      void main(){
        vec3 v=orientation*vec3((screen-offset)*aperture,-1.); vec3 a=abs(v),c;
        if(a.x>=a.y&&a.x>=a.z){
          if(v.x>0.)c=texture2D(px,.5+.5*vec2(-v.y,-v.z)/a.x).rgb;
          else c=texture2D(nx,.5+.5*vec2(v.y,-v.z)/a.x).rgb;
        }else if(a.y>=a.z){
          if(v.y>0.)c=texture2D(py,.5+.5*vec2(v.x,-v.z)/a.y).rgb;
          else c=texture2D(ny,.5+.5*vec2(-v.x,-v.z)/a.y).rgb;
        }else{
          if(v.z>0.)c=texture2D(pz,.5+.5*vec2(-v.y,v.x)/a.z).rgb;
          else c=texture2D(nz,.5+.5*vec2(-v.y,-v.x)/a.z).rgb;
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
    [orientation,aperture,offset,gain]=["orientation","aperture","offset","gain"].map(k=>gl.getUniformLocation(program,k));
    for(const [i,face] of faces.entries()){
      face.texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,face.texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,1,1,0,gl.RGB,gl.UNSIGNED_BYTE,new Uint8Array(3));
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.uniform1i(gl.getUniformLocation(program,face.name),i);
    }
  }
  if(gl){try{initialize();}catch{gl=null;}}
  canvas.addEventListener("webglcontextlost",event=>{event.preventDefault();gl=null;invalidate();});
  const preview=new Image();
  preview.onload=()=>{
    const side=preview.naturalHeight;
    for(const [i,face] of faces.entries()){
      face.low=document.createElement("canvas");face.low.width=face.low.height=side;
      face.low.getContext("2d").drawImage(preview,i*side,0,side,side,0,0,side,side);
    }
    invalidate();
  };
  preview.src=LabMedia.file(dir+"preview.webp");
  function requestFaces(){
    for(const i of wanted){
      if(inFlight>=2)break;
      const face=faces[i];
      if(face.high||face.loading||performance.now()<face.retry)continue;
      face.loading=true;inFlight++;
      const im=new Image();im.decoding="async";
      const finish=()=>{face.loading=false;inFlight--;invalidate();requestFaces();};
      im.onload=()=>{if(wanted.includes(i))face.high=im;finish();};
      im.onerror=()=>{face.retry=performance.now()+30000;finish();};
      im.src=LabMedia.file(dir+face.name+".webp");
    }
  }
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
  return function draw(p,c,ratio,light){
    const m=[c.right,c.up,c.front].flatMap(OrbitFrames.galactic);
    const ax=p.w/(2*c.skyFocal),ay=p.h/(2*c.skyFocal),ox=2*c.principal[0]-1,oy=1-2*c.principal[1];
    // Intersect a conservative view cone with each cube face and fetch the
    // forward faces first. A low-resolution face covers the first frame and errors.
    const halfFov=Math.atan(Math.hypot(ax*(1+Math.abs(ox)),ay*(1+Math.abs(oy))));
    const limit=Math.cos(halfFov+Math.acos(1/Math.sqrt(3)));
    const facing=[-m[6],m[6],-m[7],m[7],-m[8],m[8]];
    wanted=[0,1,2,3,4,5].filter(i=>facing[i]>=limit).sort((a,b)=>facing[b]-facing[a]);
    for(const [i,face] of faces.entries()){
      if(face.high&&!wanted.includes(i)&&facing[i]<limit-.28){face.high=null;face.pixels=null;}
    }
    requestFaces();
    const scale=gl?Math.min(ratio,c.cruising?1.5:2,(c.cruising?2450:4096)/p.w,2500/p.h):
      Math.min(ratio,c.cruising?1:1.75,(c.cruising?1150:2250)/p.w,(c.cruising?820:1550)/p.h);
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
    gl.uniform2f(offset,ox,oy);gl.uniform1f(gain,light);gl.drawArrays(gl.TRIANGLES,0,3);return canvas;
  };
};
