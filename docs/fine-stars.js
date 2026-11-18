// Faint Tycho-2 stars are drawn from sub-arcminute coordinates at the output resolution.
globalThis.createFineStarField=function(changed){
  'use strict';
  const names=['px','nx','py','ny','pz','nz'];
  const faces=names.map(()=>({bytes:null,loading:null,retry:0,buffer:null}));
  let activeContext=null,program=null,loc;
  function load(i){
    const f=faces[i];
    if(f.bytes)return Promise.resolve();
    if(!f.loading)f.loading=fetch(LabMedia.file('assets/space/tycho/'+names[i]+'.bin')).then(async r=>{
      if(!r.ok)throw Error('별 목록을 읽지 못했습니다.');
      const b=new Uint8Array(await r.arrayBuffer());
      if(!b.length||b.length%6)throw Error('별 목록을 다시 내려받아 주세요.');
      f.bytes=b;changed();
    }).catch(e=>{f.retry=performance.now()+8000;throw e;}).finally(()=>{f.loading=null;});
    return f.loading;
  }
  function request(ids){for(const i of ids)if(!faces[i].bytes&&performance.now()>=faces[i].retry)load(i).catch(()=>{});}
  function count(bytes,limit){
    let lo=0,hi=bytes.length/6;
    while(lo<hi){const mid=(hi+lo)>>>1;if(bytes[mid*6+4]<=limit)lo=mid+1;else hi=mid;}
    return lo;
  }
  function setup(gl){
    activeContext=gl;program=gl.createProgram();
    const vertex=`precision highp float;
      attribute vec2 uv,measured; uniform mat3 basis; uniform vec2 aperture,offset;
      uniform float face,gain,outputScale; varying vec3 light;
      void main(){vec2 p=uv*2.-1.;vec3 v;
        if(face<.5)v=vec3(1.,-p.x,-p.y);else if(face<1.5)v=vec3(-1.,p.x,-p.y);
        else if(face<2.5)v=vec3(p.x,1.,-p.y);else if(face<3.5)v=vec3(-p.x,-1.,-p.y);
        else if(face<4.5)v=vec3(p.y,-p.x,1.);else v=vec3(-p.y,-p.x,-1.);
        float z=-dot(v,basis[2]);vec2 pos=vec2(dot(v,basis[0]),dot(v,basis[1]))/aperture+offset*z;
        gl_Position=vec4(pos,0.,z);
        float mag = 6. + measured.x / 32.;
        float bv = measured.y > 254. ? .58 : measured.y * 3. / 254. - .5;
        vec3 colour=mix(vec3(.76,.85,1.),vec3(1.,.79,.60),clamp((bv+.25)/1.85,0.,1.));
        light=colour*gain*clamp(.48*exp(-.48*(mag-8.)),.035,.75);
        gl_PointSize=clamp((1.85-.12*(mag-8.))*outputScale,1.05,4.5);
      }`;
    const fragment=`precision mediump float;varying vec3 light;void main(){vec2 p=2.*gl_PointCoord-1.;gl_FragColor=vec4(light*exp(-2.8*dot(p,p)),1.);}`;
    for(const [type,src] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
      const shader=gl.createShader(type);gl.shaderSource(shader,src);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program,shader);gl.deleteShader(shader);
    }
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    loc=Object.fromEntries(['basis','aperture','offset','face','gain','outputScale'].map(k=>[k,gl.getUniformLocation(program,k)]));
    loc.uv=gl.getAttribLocation(program,'uv');loc.measured=gl.getAttribLocation(program,'measured');
    for(const f of faces)f.buffer=null;
  }
  function resolution(focal){
    const octaves=Math.log2(Math.max(1,focal/650));
    return {limit:Math.min(224,Math.round(32*(1.6+1.56*octaves))),gain:Math.min(.95,.20+.18*octaves),psf:Math.min(1.85,1+.12*octaves)};
  }
  function draw(gl,frame,ids,focal){
    if(!ids.some(i=>faces[i].bytes))return;
    if(activeContext!==gl){try{setup(gl);}catch{program=null;}}
    if(!program)return;
    const {limit,gain,psf}=resolution(focal);
    gl.useProgram(program);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
    gl.uniformMatrix3fv(loc.basis,false,frame.m);gl.uniform2f(loc.aperture,frame.ax,frame.ay);
    gl.uniform2f(loc.offset,frame.ox,frame.oy);gl.uniform1f(loc.gain,gain*frame.exposure);gl.uniform1f(loc.outputScale,psf);
    gl.enableVertexAttribArray(loc.uv);gl.enableVertexAttribArray(loc.measured);
    for(const i of ids){
      const f=faces[i];if(!f.bytes)continue;
      if(!f.buffer){f.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,f.buffer);gl.bufferData(gl.ARRAY_BUFFER,f.bytes,gl.STATIC_DRAW);}
      else gl.bindBuffer(gl.ARRAY_BUFFER,f.buffer);
      gl.vertexAttribPointer(loc.uv,2,gl.UNSIGNED_SHORT,true,6,0);gl.vertexAttribPointer(loc.measured,2,gl.UNSIGNED_BYTE,false,6,4);
      gl.uniform1f(loc.face,i);gl.drawArrays(gl.POINTS,0,count(f.bytes,limit));
    }
    gl.disableVertexAttribArray(loc.uv);gl.disableVertexAttribArray(loc.measured);gl.disable(gl.BLEND);
  }
  // Cache projected points by output scale and orientation. Software export reuses this
  // projection for each tile and scans only rows that intersect that tile.
  let key='',buckets=new Map();
  function software(ctx,frame,ids,focal,width,height){
    const {m}=frame,{limit,gain,psf}=resolution(focal);
    const k=[...m,focal,limit,...ids.map(i=>faces[i].bytes?i:-1)].join('/');
    if(k!==key){
      key=k;buckets=new Map();
      for(const i of ids){
        const b=faces[i].bytes;if(!b)continue;const n=count(b,limit)*6;
        for(let j=0;j<n;j+=6){
          const u=(b[j]+256*b[j+1])/32767.5-1,v=(b[j+2]+256*b[j+3])/32767.5-1;
          const x=i===0?1:i===1?-1:i===2?u:i===3?-u:i===4?v:-v;
          const y=i===2?1:i===3?-1:i===1?u:-u,z=i===4?1:i===5?-1:-v;
          const depth=-(x*m[6]+y*m[7]+z*m[8]);if(depth<=.002)continue;
          const px=(x*m[0]+y*m[1]+z*m[2])*focal/depth,py=-(x*m[3]+y*m[4]+z*m[5])*focal/depth;
          const row=Math.floor(py/256);let bin=buckets.get(row);if(!bin)buckets.set(row,bin=[]);
          bin.push(px,py,b[j+4],b[j+5]);
        }
      }
    }
    const ox=(1+frame.ox)*width/2,oy=(1-frame.oy)*height/2;
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='lighter';
    for(let row=Math.floor((-oy-3)/256);row<=Math.floor((height-oy+3)/256);row++){
      const b=buckets.get(row);if(!b)continue;
      for(let j=0;j<b.length;j+=4){
        const x=b[j]+ox,y=b[j+1]+oy;if(x< -2||x>width+2||y< -2||y>height+2)continue;
        const mag=6+b[j+2]/32,colour=b[j+3];ctx.fillStyle=colour===255?'#e6e8ed':colour<65?'#d3e0ff':colour>129?'#ffd5ad':'#f1e8db';
        ctx.globalAlpha=Math.min(1,gain*frame.exposure*.60*Math.min(.75,.48*Math.exp(-.48*(mag-8))));
        const size=Math.max(.8,(1.5-.10*(mag-8))*psf);ctx.fillRect(x-size/2,y-size/2,size,size);
      }
    }
    ctx.restore();
  }
  return {request,prepare:ids=>Promise.all(ids.map(load)),draw,software,reset:()=>{activeContext=null;program=null;}};
};
