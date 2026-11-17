// Orbit Lab optical pass: perspective rays in planet radii, radiance in linear RGB.
globalThis.OrbitOptics = (() => {
"use strict";
const vertex = 'attribute vec2 point;void main(){gl_Position=vec4(point,0.,1.);}';
const fragment = `precision highp float;
uniform vec2 size, focus;
uniform float ringProfile, tanHalfFov, isolated, polarRatio, longitudeShift;
uniform float dist, tilt, body, air, flux, flux2, sunSize, starSize, skyPower, cloudsDrift;
uniform vec3 sun, star, airColor, sunTint, secondTint;
uniform vec4 surfaceParams;
uniform float emissive;
uniform vec4 ringSin,ringCos;
uniform mat3 viewToBody, viewToGal;
uniform sampler2D surfaceMap, nightMap, cloudMap, oceanMap, skyMap, ringMap;
const float pi=3.14159265359;
vec2 sphereUV(vec3 n){return vec2(fract(.5+atan(n.x,n.z)/(2.*pi)),acos(clamp(n.y,-1.,1.))/pi);}
float lum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 film(vec3 x){return pow(max(vec3(0.),vec3(1.)-exp(-max(vec3(0.),x)*1.34)),vec3(.46));}
float cloudAt(vec3 n){vec2 uv=sphereUV(n);uv.x=fract(uv.x+cloudsDrift+longitudeShift);return smoothstep(.022,.95,texture2D(cloudMap,uv).r);}
float hit(vec3 o,vec3 ray,float radius){float b=dot(o,ray);float d=radius*radius-dot(cross(o,ray),cross(o,ray));return d>=0.&&b<0.?-b-sqrt(max(0.,d)):1.e5;}
vec4 ringAt(float r){float u=(r-1.21)/1.06;if(u<0.||u>1.)return vec4(0.);return texture2D(ringMap,vec2(clamp(u,.001,.999),.5));}
${SaturnRings.shader}
float ringShadow(vec3 p,vec3 l,vec3 pole){float ld=dot(l,pole);if(abs(ld)<.001)return 1.;float t=-dot(p,pole)/ld;if(t<=0.)return 1.;return 1.-.89*ringAt(length(p+t*l)).a;}
float globeShadow(vec3 point,vec3 light,vec3 pole,float flatten){
  vec3 p=point+flatten*dot(point,pole)*pole;
  vec3 l=normalize(light+flatten*dot(light,pole)*pole);
  return dot(p,l)<0.?mix(.07,1.,smoothstep(.99,1.01,length(cross(p,l)))):1.;
}
float ringLight(vec3 pt,vec3 l,vec3 pole,float dn,float a,float flatten){
  float incidence=dot(l,pole);
  float scatter=incidence*dn<0.?.60+.40*sqrt(abs(incidence)):.32+.32*(1.-a);
  return scatter*globeShadow(pt,l,pole,flatten);
}
float irradiance(vec3 n,vec3 l,float f,float shadow){float nl=dot(n,l);return f*(max(nl,0.)*shadow+.009*smoothstep(-.12,.48,nl));}
vec3 sunImage(vec3 r,vec3 l,float a,float f,vec3 tint){float co=dot(r,l);if(co<.9||f<=0.)return vec3(0.);float theta=length(cross(r,l));float w=.54/size.y;float core=1.-smoothstep(max(0.,a-w),a+w,theta);return tint*(core*2.8+min(.6,.10*exp(-theta/max(a*4.,.001))+.019*exp(-theta/max(a*16.,.003)))*min(f,1.));}
void main(){
  vec2 q=(gl_FragCoord.xy-size*focus)/(.5*size.y);
  vec3 raw=normalize(vec3(q*tanHalfFov,-1.));vec3 ray=vec3(raw.x,cos(tilt)*raw.y-sin(tilt)*raw.z,sin(tilt)*raw.y+cos(tilt)*raw.z),o=vec3(0.,0.,dist);
  vec3 color=vec3(0.);
  float alpha=isolated>.5?0.:1.;
  if(isolated<.5){
    vec3 gd=viewToGal*ray;
    vec2 st=vec2(fract(.5-atan(gd.y,gd.x)/(2.*pi)),acos(clamp(gd.z,-1.,1.))/pi);
    color=max(vec3(0.),pow(texture2D(skyMap,st).rgb,vec3(1.16))*skyPower-.003);
    color+=sunImage(ray,sun,sunSize,flux,vec3(1.,.964,.89))+sunImage(ray,star,starSize,flux2,vec3(1.,.79,.61));
  }
  vec3 pole=vec3(viewToBody[0].y,viewToBody[1].y,viewToBody[2].y);
  bool earth=body>2.5&&body<3.5, saturn=body>5.5&&body<6.5;
  // Scale along the polar axis, then intersect a unit sphere in transformed space.
  float flatten=1./polarRatio-1.;
  vec3 eo=o+flatten*dot(o,pole)*pole,er=ray+flatten*dot(ray,pole)*pole;
  float erLength=length(er);vec3 unitRay=er/erLength;
  float impact=length(cross(eo,unitRay));
  float t=hit(eo,unitRay,1.)/erLength;
  if(t<1.e4){
    alpha=1.;
    vec3 point=o+ray*t;
    vec3 n=normalize(point+(1./(polarRatio*polarRatio)-1.)*dot(point,pole)*pole);
    vec3 g=normalize(viewToBody*n),eye=-ray;
    vec2 uv=sphereUV(g);uv.x=fract(uv.x+longitudeShift+surfaceParams.w*sin(g.y*19.));
    vec3 albedo=texture2D(surfaceMap,uv).rgb;
    float nv=max(dot(n,eye),0.);
    if(emissive>.5){
      float power=pow(albedo.r,1.85)*1.22*(.50+.50*sqrt(nv));
      gl_FragColor=vec4(clamp(sunTint*vec3(1.,.84+.16*nv,.74+.26*nv)*power,0.,1.),1.);return;
    }
    vec3 ns=n;float gloss=0.;
    if(surfaceParams.x>0.){
      vec3 material=texture2D(oceanMap,uv).rgb;
      vec3 east=cross(pole,n);east/=max(.001,length(east));
      ns=normalize(n+surfaceParams.x*((material.r-.502)*east+(material.g-.502)*cross(n,east)));
      gloss=material.b*surfaceParams.y;
    }
    vec3 reflectance=pow(albedo,vec3(2.15));
    float lit1=irradiance(ns,sun,flux,saturn?ringShadow(point,sun,pole):1.);
    float lit2=irradiance(ns,star,flux2,saturn?ringShadow(point,star,pole):1.);
    vec3 incoming=sunTint*lit1+secondTint*lit2;
    vec3 radiance=reflectance*(incoming+.00018);
    if(gloss>0.){
      vec3 h1=normalize(sun+eye),h2=normalize(star+eye);
      float sparkle1=flux*pow(max(0.,dot(ns,h1)),95.)*smoothstep(0.,.12,dot(n,sun));
      float sparkle2=flux2*pow(max(0.,dot(ns,h2)),95.)*smoothstep(0.,.12,dot(n,star));
      radiance+=gloss*(.09+.76*pow(1.-nv,4.))*(sparkle1*sunTint+sparkle2*secondTint);
    }
    if(surfaceParams.z>0.){
      vec2 cuv=vec2(fract(uv.x+cloudsDrift),uv.y);
      float cover=texture2D(cloudMap,cuv).r*surfaceParams.z;
      vec2 shift=vec2((viewToBody*sun).x,-(viewToBody*sun).y)*.003;
      float shadow=texture2D(cloudMap,vec2(fract(cuv.x+shift.x),clamp(cuv.y+shift.y,0.,1.))).r;
      radiance=mix(radiance*(1.-.24*shadow),vec3(.91,.95,1.)*incoming,cover);
    }
    float twilight=flux*smoothstep(-.19,.32,dot(n,sun))+flux2*smoothstep(-.19,.32,dot(n,star));
    if(earth){
      float water=texture2D(oceanMap,uv).r;
      vec3 h1=normalize(sun+eye),h2=normalize(star+eye);
      float spec=flux*pow(max(dot(h1,n),0.),145.)*smoothstep(0.,.11,dot(n,sun))+flux2*pow(max(dot(h2,n),0.),145.)*smoothstep(0.,.11,dot(n,star));
      float fres=.035+.63*pow(1.-nv,4.);
      float tc=hit(eo,unitRay,1.0018)/erLength;vec3 cp=o+ray*tc;vec3 nc=normalize(cp+(1./(polarRatio*polarRatio)-1.)*dot(cp,pole)*pole);
      float cloud=cloudAt(viewToBody*nc);
      float shadow=flux>.001?cloudAt(normalize(g+(viewToBody*sun)*.0028/max(.16,dot(n,sun)))):0.;
      radiance*=1.-.42*shadow;
      radiance+=water*spec*fres*vec3(1.35,1.23,.99);
      float clLit=irradiance(nc,sun,flux,1.)+irradiance(nc,star,flux2,1.);
      radiance=mix(radiance,vec3(.92,.96,1.)*(clLit+.00012),cloud*.96);
      vec3 cities=texture2D(nightMap,uv).rgb;
      float dark=1.-smoothstep(.003,.13,lum(incoming));
      radiance+=pow(cities,vec3(2.05))*.73*dark*(1.-.82*cloud);
    }
    float rim=pow(clamp(1.-nv,0.,1.),3.65);
    float glow=min(1.55,twilight)*rim*air;
    radiance+=airColor*(glow*.57+min(twilight,1.)*air*.009*pow(1.-nv,1.3));
    color=film(radiance);
  }else if(air>.0&&impact<1.026&&dot(o,ray)<0.){
    vec3 tangent=normalize(o-ray*dot(o,ray));
    float sunlight=flux*smoothstep(-.22,.39,dot(tangent,sun))+flux2*smoothstep(-.22,.39,dot(tangent,star));
    float halo=exp(-max(impact-1.,0.)/(.0036*max(.53,air)))*(1.-smoothstep(.014,.026,impact-1.));
    float dayEdge=dot(tangent,sun);float dusk=earth?pow(max(0.,dot(ray,sun)),13.)*(1.-smoothstep(.025,.19,abs(dayEdge)))*exp(-max(0.,impact-1.)/.0031)*min(1.,flux):0.;
    vec3 glowColor=film(airColor*min(1.5,sunlight)*halo*air*.51+vec3(.95,.27,.042)*dusk*.64)*(1.-smoothstep(.016,.026,impact-1.));
    if(isolated>.5){alpha=max(glowColor.r,max(glowColor.g,glowColor.b));color=glowColor/max(.0001,alpha);}
    else color+=glowColor;
  }
  if(saturn){
    float dn=dot(ray,pole);if(abs(dn)>.0001){float rt=-dot(o,pole)/dn;if(rt>0.&&rt<t){
      vec3 pt=o+rt*ray;vec4 ring=ringAt(length(pt));if(ring.a>.002){
        vec3 inPlane=viewToBody*pt;
        float markings=ringContrast(length(pt),normalize(inPlane.xz));
        float ir=flux*ringLight(pt,sun,pole,dn,ring.a,flatten)+flux2*ringLight(pt,star,pole,dn,ring.a,flatten);
        vec3 rc=film(pow(ring.rgb,vec3(2.1))*(ir*markings+.00018));
        float opacity=ringProfile>.5?1.-pow(max(0.,1.-ring.a),1./max(.02,abs(dn))):clamp(ring.a*(1.06+.12*(1.-abs(dn))),0.,1.);
        float coverage=alpha*(1.-opacity)+opacity;
        color=(color*alpha*(1.-opacity)+rc*opacity)/max(.0001,coverage);alpha=coverage;
      }
    }}
  }
  gl_FragColor=vec4(clamp(color,0.,1.),alpha);
}`;
function make(canvas,{cutout=false}={}){
  const gl=canvas.getContext("webgl",{alpha:cutout,premultipliedAlpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:"high-performance"});
  if(!gl)return null;
  const shader=(kind,src)=>{const sh=gl.createShader(kind);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh};
  const pg=gl.createProgram();gl.attachShader(pg,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(pg,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(pg);if(!gl.getProgramParameter(pg,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(pg));gl.useProgram(pg);
  const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);const a=gl.getAttribLocation(pg,"point");gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
  const aniso=gl.getExtension("EXT_texture_filter_anisotropic")||gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
  const names=["surfaceMap","nightMap","cloudMap","oceanMap","skyMap","ringMap"], textures=new Map(), u={};
  for(const n of "sunTint secondTint surfaceParams emissive ringSin ringCos ringProfile tanHalfFov isolated polarRatio longitudeShift size focus dist tilt body air flux flux2 sunSize starSize skyPower cloudsDrift sun star airColor viewToBody viewToGal".split(" "))u[n]=gl.getUniformLocation(pg,n);
  const maxSize=gl.getParameter(gl.MAX_TEXTURE_SIZE);
  function upload(key,image){
    const old=textures.get(key);
    if(old?.image===image)return old.texture;
    const texture=old?.texture||gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    let source=image;
    const limit=Math.min(maxSize,8192);
    if(image&&image.naturalWidth>limit){
      source=document.createElement("canvas");source.width=limit;source.height=Math.round(limit*image.naturalHeight/image.naturalWidth);
      source.getContext("2d").drawImage(image,0,0,source.width,source.height);
    }
    const format=key==="earth-clouds"||key==="earth-ocean"?gl.LUMINANCE:gl.RGBA;
    if(source)gl.texImage2D(gl.TEXTURE_2D,0,format,format,gl.UNSIGNED_BYTE,source);
    else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
    const pow2=n=>n>0&&(n&(n-1))===0;
    const mip=source&&pow2(source.width)&&pow2(source.height);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,mip&&key!=="ring"?gl.REPEAT:gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,mip?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);
    if(mip){gl.generateMipmap(gl.TEXTURE_2D);if(aniso)gl.texParameterf(gl.TEXTURE_2D,aniso.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));}
    textures.set(key,{image,texture});return texture;
  }
  const dummy=upload("empty",null);names.forEach((n,i)=>gl.uniform1i(gl.getUniformLocation(pg,n),i));
  return function draw(s,assets){gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(u.size,canvas.width,canvas.height);gl.uniform2fv(u.focus,s.focus);
    ["dist","tilt","body","air","flux","flux2","sunSize","starSize","skyPower","cloudsDrift"].forEach(k=>gl.uniform1f(u[k],s[k]));
    ["sun","star","airColor"].forEach(k=>gl.uniform3fv(u[k],s[k]));["viewToBody","viewToGal"].forEach(k=>gl.uniformMatrix3fv(u[k],false,s[k]));
    gl.uniform1f(u.ringProfile,s.ringProfile??0);gl.uniform1f(u.tanHalfFov,s.tanHalfFov??.54);gl.uniform1f(u.isolated,cutout?1:0);
    gl.uniform1f(u.polarRatio,s.polarRatio??1);gl.uniform1f(u.longitudeShift,s.longitudeShift??0);
    if(s.body===6){const phase=s.ringPhase??SaturnRings.frame(0);gl.uniform4fv(u.ringSin,phase.s);gl.uniform4fv(u.ringCos,phase.c);}
    gl.uniform3fv(u.sunTint,s.sunTint??[1,.973,.94]);gl.uniform3fv(u.secondTint,s.secondTint??[1,.82,.65]);
    gl.uniform4fv(u.surfaceParams,s.surfaceParams??[0,0,0,0]);gl.uniform1f(u.emissive,s.emissive?1:0);
    const earth=s.body===3;
    const keys=[s.id,earth?"earth-night":null,earth?"earth-clouds":s.cloudKey,earth?"earth-ocean":s.materialKey,cutout?null:"sky",s.body===6?"ring":null];
    for(const [key,v] of textures)if(key!=="empty"&&!keys.includes(key)){gl.deleteTexture(v.texture);textures.delete(key);}
    keys.forEach((key,i)=>{gl.activeTexture(gl.TEXTURE0+i);const im=key&&assets.get(key);gl.bindTexture(gl.TEXTURE_2D,im?upload(key,im):dummy);});
    gl.drawArrays(gl.TRIANGLES,0,3);
  };
}
return {make};
})();
