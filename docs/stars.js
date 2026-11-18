"use strict";
// Project the ESO full-sky mosaic along the same J2000 sight lines as the orbit camera.
globalThis.createMapSky = function createMapSky(canvas, invalidate, withCatalog=true) {

  const context = canvas.getContext("2d", {alpha: false});
  const buffer = document.createElement("canvas");
  const panorama = new Image();
  let gl, survey;
  const photoCache=typeof withCatalog==="function"?document.createElement("canvas"):null;let photoKey="";
  let program, uniforms, texture, pixels, started = false, loaded = false, lastKey = "", annotations=[];
  const refresh=()=>{lastKey="";invalidate();};
  const celestial=typeof withCatalog==="function"?withCatalog(refresh):withCatalog?CosmicSky.setupBackdrop(refresh):null;
  const vertex = "attribute vec2 corner; varying vec2 screen; void main(){ screen=corner; gl_Position=vec4(corner,0.,1.); }";
  const fragment = `precision highp float;
    varying vec2 screen; uniform sampler2D stars; uniform mat3 galactic;
    uniform vec2 aperture, offset; uniform float exposure;
    void main(){
      vec3 direction = normalize(galactic * vec3((screen-offset)*aperture,-1.));
      vec2 uv = vec2(fract(.5-atan(direction.y,direction.x)/6.28318530718),acos(clamp(direction.z,-1.,1.))/3.14159265359);
      vec3 photo=texture2D(stars,uv).rgb;
      vec3 light=max(vec3(0.),(photo*(1.35-.40*photo)-.013)*exposure);
      gl_FragColor=vec4(light,1.);
    }`;
  function initialize(){
    if(!gl) return;
    function compile(type,source){
      const shader=gl.createShader(type);
      gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
      return shader;
    }
    program=gl.createProgram();
    gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex)); gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const vertices=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,vertices);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(program,"corner");
    gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    uniforms=Object.fromEntries(["stars","galactic","aperture","offset","exposure"].map(name=>[name,gl.getUniformLocation(program,name)]));
    texture=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,panorama);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR); gl.generateMipmap(gl.TEXTURE_2D);
  }
  function load(){
    started=true;
    gl=buffer.getContext("webgl", {alpha:false, depth:false, antialias:false});
    panorama.onload=()=>{
      loaded=true;
      try {initialize();} catch {program=null;}
      lastKey="";invalidate();
    };
    panorama.src=LabMedia.file("assets/space/"+(matchMedia("(max-width: 720px)").matches?"lite-sky":"sky")+".webp");
  }
  buffer.addEventListener("webglcontextlost",event=>{event.preventDefault();program=null;lastKey="";invalidate();});
  const cpu=document.createElement("canvas"), cpuCtx=cpu.getContext("2d",{alpha:false});
  function software(width,height,m,aperture,offset,exposure,moving){
    if(!pixels){
      const strip=document.createElement("canvas");
      strip.width=Math.min(2048,panorama.naturalWidth);strip.height=strip.width/2;
      const read=strip.getContext("2d",{willReadFrequently:true});read.drawImage(panorama,0,0,strip.width,strip.height);
      pixels=read.getImageData(0,0,strip.width,strip.height);
    }
    const scale=Math.min(1,(moving?600:830)/width,(moving?420:560)/height);
    cpu.width=Math.max(1,Math.round(width*scale));cpu.height=Math.max(1,Math.round(height*scale));
    const result=cpuCtx.createImageData(cpu.width,cpu.height),out=result.data,photo=pixels.data;
    const tones=Array.from({length:256},(_,v)=>Math.max(0,(v/255*(1.35-.40*v/255)-.013)*exposure)*255);
    for(let y=0,k=0;y<cpu.height;y++){
      const sy=(1-2*(y+.5)/cpu.height-offset[1])*aperture[1];
      for(let x=0;x<cpu.width;x++,k+=4){
        const sx=(2*(x+.5)/cpu.width-1-offset[0])*aperture[0],inv=1/Math.hypot(sx,sy,1);
        const a=m[0]*sx+m[3]*sy-m[6],b=m[1]*sx+m[4]*sy-m[7],c=(m[2]*sx+m[5]*sy-m[8])*inv;
        const u=.5-Math.atan2(b,a)/(2*Math.PI),v=Math.acos(Math.max(-1,Math.min(1,c)))/Math.PI;
        const i=4*(Math.min(pixels.height-1,Math.floor(v*pixels.height))*pixels.width+Math.floor((u-Math.floor(u))*pixels.width));
        out[k]=tones[photo[i]];out[k+1]=tones[photo[i+1]];out[k+2]=tones[photo[i+2]];out[k+3]=255;
      }
    }
    cpuCtx.putImageData(result,0,0);return cpu;
  }
  return function paint(width,height,ratio,views){
    if(!started&&views.some(v=>!v.camera.surveySky))load();
    const geometry=[width,height,ratio,...views.flatMap(({pane,camera,exposure})=>[pane.x,pane.y,pane.w,pane.h,camera.skyFocal??camera.focal,...camera.principal,...camera.right,...camera.up,exposure,Number(!!camera.cruising)])].map(v=>Math.round(v*10000)).join("/");
    const key=geometry+"/"+views.map(({skyId,showSurvey,camera})=>[skyId??"",!!showSurvey,!!camera.surveySky,celestial?Math.floor((camera.day??0)/32):0,camera.closeBody??0].join("|")).join("/");
    if(key===lastKey) return annotations;
    lastKey=key;annotations=[];
    const cw=Math.round(width*ratio),ch=Math.round(height*ratio);
    if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
    context.setTransform(ratio,0,0,ratio,0,0);
    context.fillStyle="#020305";context.fillRect(0,0,width,height);
    // A change in the catalogue epoch only moves individual stars. Reuse the
    // panorama projection while the field of view and exposure are unchanged.
    const cachePhoto=photoCache&&views.length===1;
    if(cachePhoto&&geometry===photoKey){
      context.drawImage(photoCache,0,0,width,height);
      const {pane,camera,showSurvey,exposure}=views[0];
      annotations.push(celestial(context,pane,camera,showSurvey,exposure));return annotations;
    }
    for(const {pane,camera,exposure,showSurvey} of views){
      if(camera.surveySky){
        survey??=createSurveySky(refresh);
        context.drawImage(survey(pane,camera,ratio,exposure),pane.x,pane.y,pane.w,pane.h);
        if(celestial)annotations.push(celestial(context,pane,camera,showSurvey,exposure));
        continue;
      }
      if(!loaded){annotations.push([]);continue;}
      const m=[camera.right,camera.up,camera.front].flatMap(OrbitFrames.panorama);
      const focal=camera.skyFocal??camera.focal;
      const aperture=[pane.w/(2*focal),pane.h/(2*focal)];
      const offset=[2*camera.principal[0]-1,1-2*camera.principal[1]];
      let image;
      if(program){
        const scale=camera.cruising?Math.min(ratio,1.2,1700/pane.w,1100/pane.h):Math.min(ratio,1.55,2300/pane.w);
        const bw=Math.max(1,Math.round(pane.w*scale)),bh=Math.max(1,Math.round(pane.h*scale));
        if(buffer.width!==bw||buffer.height!==bh){buffer.width=bw;buffer.height=bh;}
        gl.viewport(0,0,buffer.width,buffer.height);gl.uniformMatrix3fv(uniforms.galactic,false,m);
        gl.uniform2fv(uniforms.aperture,aperture);gl.uniform2fv(uniforms.offset,offset);gl.uniform1f(uniforms.exposure,exposure);
        gl.drawArrays(gl.TRIANGLES,0,3);image=buffer;
      }else image=software(pane.w,pane.h,m,aperture,offset,exposure,camera.cruising);
      context.drawImage(image,pane.x,pane.y,pane.w,pane.h);
      if(cachePhoto){
        if(photoCache.width!==cw||photoCache.height!==ch){photoCache.width=cw;photoCache.height=ch;}
        photoCache.getContext("2d").drawImage(canvas,0,0);photoKey=geometry;
      }
      if(celestial)annotations.push(celestial(context,pane,camera,showSurvey,exposure));
    }
    return annotations;
  };
};
