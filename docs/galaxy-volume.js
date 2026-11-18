// Integrate the observed surface light through a model of stellar thickness and dust.
// Each observation has its own deprojected disc; the line-of-sight depth is inferred.
globalThis.createGalaxyVolume = function(gpu,software,changed){
  'use strict';
  let gl,program,texture,uniforms,ready=false,started=false,source=null,raw=null,frame=null;
  const cpu=software.getContext('2d',{alpha:false});
  const shader=`precision highp float;
    varying vec2 screen; uniform sampler2D field;
    uniform vec3 right,up,eye; uniform vec2 aperture; uniform float ratio,irregular,samples;
    void main(){
      vec3 ray=normalize(-eye+(right*screen.x*aperture.x+up*screen.y*aperture.y)/4.6);
      vec3 origin=eye*4.6,box=vec3(1.,1.,.42);
      vec3 inverse=mix(vec3(-1.),vec3(1.),step(vec3(0.),ray))/max(abs(ray),vec3(.00001));
      vec3 a=(-box-origin)*inverse,b=(box-origin)*inverse;
      vec3 lo=min(a,b),hi=max(a,b);
      float start=max(0.,max(lo.x,max(lo.y,lo.z))),end=min(hi.x,min(hi.y,hi.z));
      vec3 light=vec3(0.);float transmission=1.;
      if(end>start){
        float ds=(end-start)/samples;
        float shear=sqrt(1.-ratio*ratio)/ratio;
        float sheet=smoothstep(.09,.33,abs(ray.z))*(.60-.28*irregular);
        vec3 p=origin+(start+.5*ds)*ray;
        for(int i=0;i<64;i++){
          if(float(i)>=samples)break;
          vec2 observed=vec2(p.x,p.y+p.z*shear);
          vec4 cell=texture2D(field,.5+.5*observed*vec2(1.,-1.));
          if(abs(observed.y)>1.){p+=ds*ray;continue;}
          float r2=dot(p.xy,p.xy),core=exp(-13.*r2);
          float thin=.025+.021*min(r2,1.)+.056*irregular;
          float thick=.105+.125*core+.042*irregular;
          float bulge=.15+core*(.72-.45*irregular);
          float z=abs(p.z);
          float mass=mix(exp(-z/thin)/(2.*thin),exp(-z/thick)/(2.*thick),bulge);
          vec3 emission=-log(max(vec3(.025),1.-.954*cell.rgb));
          light+=transmission*emission*(ds*ratio*mass*(1.-sheet));
          transmission*=exp(-ds*ratio*(1.-cell.a)*exp(-z/(thin*.72))/(thin*1.44)*1.45);
          p+=ds*ray;
        }
        float mid=-origin.z/(abs(ray.z)>.0001?ray.z:.0001);
        if(sheet>0.&&mid>=start&&mid<=end){
          vec2 xy=(origin+ray*mid).xy;
          vec3 stars=texture2D(field,.5+.5*xy*vec2(1.,-1.)).rgb;
          light+=sqrt(transmission)*sheet*ratio/abs(ray.z)*(-log(max(vec3(.025),1.-.954*stars)));
        }
      }
      float gain=1.22*pow(clamp((abs(eye.z)+.2)/(ratio+.2),.40,2.8),.36);
      gl_FragColor=vec4(1.-exp(-light*gain),1.);
    }`;
  function upload(){
    if(!source||!gl)return;
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
  }
  function init(){
    ready=false;gl=gpu.getContext('webgl',{alpha:false,antialias:false,depth:false,preserveDrawingBuffer:false});
    if(!gl)return;
    try{
      program=gl.createProgram();
      for(const [kind,code] of [[gl.VERTEX_SHADER,'attribute vec2 corner;varying vec2 screen;void main(){screen=corner;gl_Position=vec4(corner,0.,1.);}'],[gl.FRAGMENT_SHADER,shader]]){
        const s=gl.createShader(kind);gl.shaderSource(s,code);gl.compileShader(s);
        if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));
        gl.attachShader(program,s);gl.deleteShader(s);
      }
      gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
      const at=gl.getAttribLocation(program,'corner');gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,2,gl.FLOAT,false,0,0);
      texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      uniforms=Object.fromEntries(['right','up','eye','aperture','ratio','irregular','samples'].map(k=>[k,gl.getUniformLocation(program,k)]));
      upload();ready=true;
    }catch{gl=null;}
  }
  gpu.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;gl=null;changed();});
  gpu.addEventListener('webglcontextrestored',()=>{init();changed();});
  function use(im){
    source=im;raw=null;
    if(!started){started=true;init();}else upload();
  }
  const emission=Float32Array.from({length:256},(_,i)=>-Math.log(1-.954*i/255));
  function raster(w,h,axes,ap,model,steps){
    if(!raw){
      const c=document.createElement('canvas');c.width=c.height=512;
      const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(source,0,0,512,512);raw=g.getImageData(0,0,512,512).data;
    }
    if(frame?.width!==w||frame.height!==h)frame=cpu.createImageData(w,h);
    const {right:R,up:U,eye:F}=axes,ratio=model.ratio,irr=+model.irregular,ox=4.6*F[0],oy=4.6*F[1],oz=4.6*F[2];
    const shear=Math.sqrt(1-ratio*ratio)/ratio;
    const gain=1.22*Math.pow(Math.min(2.8,Math.max(.4,(Math.abs(F[2])+.2)/(ratio+.2))),.36),out=frame.data;
    for(let y=0,k=0;y<h;y++){
      const v=(1-2*(y+.5)/h)*ap[1]/4.6;
      for(let x=0;x<w;x++,k+=4){
        const u=(2*(x+.5)/w-1)*ap[0]/4.6;
        let dx=-F[0]+R[0]*u+U[0]*v,dy=-F[1]+R[1]*u+U[1]*v,dz=-F[2]+R[2]*u+U[2]*v;
        const mag=1/Math.sqrt(dx*dx+dy*dy+dz*dz);dx*=mag;dy*=mag;dz*=mag;
        const ax=(-1-ox)/(dx||1e-12),bx=(1-ox)/(dx||1e-12),ay=(-1-oy)/(dy||1e-12),by=(1-oy)/(dy||1e-12),az=(-.42-oz)/(dz||1e-12),bz=(.42-oz)/(dz||1e-12);
        const start=Math.max(0,Math.min(ax,bx),Math.min(ay,by),Math.min(az,bz)),end=Math.min(Math.max(ax,bx),Math.max(ay,by),Math.max(az,bz));
        let red=0,green=0,blue=0,tr=1;
        if(end>start){
          const ds=(end-start)/steps;let px=ox+dx*(start+.5*ds),py=oy+dy*(start+.5*ds),pz=oz+dz*(start+.5*ds);
          const k=Math.min(1,Math.max(0,(Math.abs(dz)-.09)/.24)),sheet=k*k*(3-2*k)*(.60-.28*irr);
          for(let i=0;i<steps;i++,px+=dx*ds,py+=dy*ds,pz+=dz*ds){
            if(Math.abs(py+pz*shear)>1)continue;
            const ix=Math.max(0,Math.min(511,Math.floor((px+1)*256))),iy=Math.max(0,Math.min(511,Math.floor((1-py-pz*shear)*256))),j=(iy*512+ix)*4;
            if((raw[j]|raw[j+1]|raw[j+2])<2)continue;
            const r2=px*px+py*py,core=Math.exp(-13*r2),thin=.025+.021*Math.min(r2,1)+.056*irr,thick=.105+.125*core+.042*irr,bulge=.15+core*(.72-.45*irr),z=Math.abs(pz);
            const mass=(1-bulge)*Math.exp(-z/thin)/(2*thin)+bulge*Math.exp(-z/thick)/(2*thick),w=tr*ds*ratio*mass*(1-sheet);
            red+=w*emission[raw[j]];green+=w*emission[raw[j+1]];blue+=w*emission[raw[j+2]];
            tr*=Math.exp(-ds*ratio*(1-raw[j+3]/255)*Math.exp(-z/(thin*.72))/(thin*1.44)*1.45);
          }
          const mid=-oz/(dz||1e-12);
          if(sheet>0&&mid>=start&&mid<=end){
            const ix=Math.max(0,Math.min(511,Math.floor((1+ox+dx*mid)*256))),iy=Math.max(0,Math.min(511,Math.floor((1-oy-dy*mid)*256)));
            const j=4*(iy*512+ix),w=Math.sqrt(tr)*sheet*ratio/Math.abs(dz);
            red+=w*emission[raw[j]];green+=w*emission[raw[j+1]];blue+=w*emission[raw[j+2]];
          }
        }
        out[k]=255*(1-Math.exp(-red*gain));out[k+1]=255*(1-Math.exp(-green*gain));out[k+2]=255*(1-Math.exp(-blue*gain));out[k+3]=255;
      }
    }
    cpu.putImageData(frame,0,0);
  }
  function draw(model,yaw,inclination,zoom,moving){
    if(!source)return;
    gpu.hidden=!ready;software.hidden=ready;
    const canvas=ready?gpu:software,w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
    const scale=ready?Math.min(devicePixelRatio||1,1.6,(moving?950:1700)/w,(moving?750:1300)/h):Math.min(1,(moving?330:660)/w,(moving?240:470)/h);
    const W=Math.max(1,Math.round(w*scale)),H=Math.max(1,Math.round(h*scale));
    if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;}
    const co=Math.cos(yaw),si=Math.sin(yaw),ci=Math.cos(inclination),sn=Math.sin(inclination),cr=Math.cos(model.roll),sr=Math.sin(model.roll);
    const u=[-ci*si,ci*co,sn],r=[co,si,0],eye=[sn*si,-sn*co,ci];
    const right=r.map((x,i)=>cr*x-sr*u[i]),up=r.map((x,i)=>sr*x+cr*u[i]);
    const xRadius=Math.hypot(cr,sr*model.ratio),yRadius=Math.hypot(sr,cr*model.ratio);
    const pixels=.53*Math.min(w/Math.max(.4,xRadius),h/Math.max(.4,yRadius))*zoom;
    const aperture=[w/(2*pixels),h/(2*pixels)];
    if(!ready){raster(W,H,{right,up,eye},aperture,model,moving?18:36);return;}
    gl.viewport(0,0,W,H);gl.uniform3fv(uniforms.right,right);gl.uniform3fv(uniforms.up,up);gl.uniform3fv(uniforms.eye,eye);gl.uniform2fv(uniforms.aperture,aperture);
    gl.uniform1f(uniforms.ratio,model.ratio);gl.uniform1f(uniforms.irregular,+model.irregular);gl.uniform1f(uniforms.samples,moving?32:64);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
  return {use,draw};
};
