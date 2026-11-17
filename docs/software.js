// CPU perspective renderer for devices that do not expose WebGL. Same camera and light vectors.
globalThis.OrbitSoftware={make(canvas,{cutout=false,maxMapWidth=2048}={}){
const ctx=canvas.getContext("2d",{alpha:cutout}),maps=new Map(),tau=2*Math.PI,limit=v=>Math.max(0,Math.min(1,v)),sm=(a,b,x)=>{const v=limit((x-a)/(b-a));return v*v*(3-2*v)};
const lin=Float32Array.from({length:256},(_,i)=>(i/255)**2.15),tone=Uint8Array.from({length:5001},(_,i)=>255*(1-Math.exp(-i/1000*1.34))**.46);
const film=x=>tone[Math.min(5000,Math.max(0,Math.round(x*1000)))],empty={w:1,h:1,d:new Uint8Array(4)};
function map(n,assets){const im=assets.get(n);if(!im)return empty;if(maps.get(n)?.image===im)return maps.get(n);const c=document.createElement("canvas");c.width=Math.min(im.naturalWidth,n==="sky"?3072:maxMapWidth);c.height=Math.max(1,Math.round(c.width*im.naturalHeight/im.naturalWidth));const cc=c.getContext("2d",{willReadFrequently:true});cc.drawImage(im,0,0,c.width,c.height);const m={image:im,w:c.width,h:c.height,d:cc.getImageData(0,0,c.width,c.height).data};maps.set(n,m);return m;}
const idx=(m,u,v)=>4*(Math.min(m.h-1,Math.max(0,Math.floor(v*m.h)))*m.w+Math.floor((u-Math.floor(u))*m.w));
let img;
return (s,assets)=>{
const w=canvas.width,h=canvas.height;if(!img||img.width!==w||img.height!==h)img=ctx.createImageData(w,h);
for(const key of maps.keys())if(!assets.has(key))maps.delete(key);
const a=img.data,base=map(s.id,assets),sky=map("sky",assets),cloud=map("earth-clouds",assets),ocean=map("earth-ocean",assets),night=map("earth-night",assets),ring=map("ring",assets);
const b=s.viewToBody,g=s.viewToGal,S=s.sun,T=s.star,E=s.body===3,R=s.body===6,d=s.dist,sy=h*(1-s.focus[1]),sx=w*s.focus[0],fac=2*(s.tanHalfFov??.54)/h,ct=Math.cos(s.tilt),st=Math.sin(s.tilt),sg=Array.from({length:256},(_,i)=>255*Math.max(0,(i/255)**1.16*s.skyPower-.003));
const flatten=1/(s.polarRatio??1)-1,normalFlatten=flatten*(flatten+2),ox=flatten*d*b[7]*b[1],oy=flatten*d*b[7]*b[4],oz=d*(1+flatten*b[7]*b[7]);
for(let y=0,pix=0;y<h;y++){const qy=(sy-y-.5)*fac;for(let x=0;x<w;x++,pix+=4){
 const qx=(x+.5-sx)*fac,k=1/Math.hypot(qx,qy,1),rx=qx*k,ry=(qy*ct+st)*k,rz=(qy*st-ct)*k;
 let imp2=d*d*(rx*rx+ry*ry),t=imp2<1?-d*rz-Math.sqrt(1-imp2):1e6;
 if(flatten){
   const shift=flatten*(rx*b[1]+ry*b[4]+rz*b[7]),ex=rx+shift*b[1],ey=ry+shift*b[4],ez=rz+shift*b[7],l2=ex*ex+ey*ey+ez*ez;
   const ax=oy*ez-oz*ey,ay=oz*ex-ox*ez,az=ox*ey-oy*ex;
   imp2=(ax*ax+ay*ay+az*az)/l2;
   t=imp2<1?-(ox*ex+oy*ey+oz*ez)/l2-Math.sqrt((1-imp2)/l2):1e6;
 }
 let r=0,gr=0,bl=0,alpha=1;
 if(t<1e5){
 const px=rx*t,py=ry*t,pz=d+rz*t,shift=normalFlatten*(px*b[1]+py*b[4]+pz*b[7]);
 let nx=px+shift*b[1],ny=py+shift*b[4],nz=pz+shift*b[7];
 if(flatten){const len=Math.hypot(nx,ny,nz);nx/=len;ny/=len;nz/=len;}
 const gx=b[0]*nx+b[3]*ny+b[6]*nz,gy=b[1]*nx+b[4]*ny+b[7]*nz,gz=b[2]*nx+b[5]*ny+b[8]*nz;
 const u=.5+Math.atan2(gx,gz)/tau+(s.longitudeShift??0),v=Math.acos(Math.max(-1,Math.min(1,gy)))/Math.PI,i=idx(base,u,v),nv=Math.max(0,-rx*nx-ry*ny-rz*nz);
 const ds=nx*S[0]+ny*S[1]+nz*S[2],dt=nx*T[0]+ny*T[1]+nz*T[2];
 let shade=1;if(R&&s.flux){const pd=S[0]*b[1]+S[1]*b[4]+S[2]*b[7],rt=-(nx*b[1]+ny*b[4]+nz*b[7])/pd;if(rt>0){const rr=Math.hypot(nx+rt*S[0],ny+rt*S[1],nz+rt*S[2]);if(rr>1.21&&rr<2.27)shade-=.89*ring.d[idx(ring,(rr-1.21)/1.06,.5)+3]/255;}}
 const f1=s.flux*(Math.max(ds,0)*shade+.009*sm(-.12,.48,ds)),f2=s.flux2*(Math.max(dt,0)+.009*sm(-.12,.48,dt));
 let cr=lin[base.d[i]]*(f1+f2+.00018),cg=lin[base.d[i+1]]*(f1*.973+.82*f2+.00018),cb=lin[base.d[i+2]]*(f1*.94+f2*.65+.00018);
 if(E){const c=sm(.022,.95,cloud.d[idx(cloud,u+s.cloudsDrift,v)]/255)*.96,light=f1+f2+.00012;
 const hs=Math.hypot(S[0]-rx,S[1]-ry,S[2]-rz)||1,hn=Math.max(0,(ds+nv)/hs),spec=(ocean.d[idx(ocean,u,v)]/255)*s.flux*(ds>0?Math.pow(hn,145):0)*(.035+.63*(1-nv)**4);
 cr=(cr*(1-.27*c)+spec*1.35)*(1-c)+c*.92*light;cg=(cg*(1-.27*c)+spec*1.23)*(1-c)+c*.96*light;cb=(cb*(1-.27*c)+spec*.99)*(1-c)+c*light;
 const ni=idx(night,u,v),nf=.73*(1-sm(.003,.13,light))*(1-.82*c);cr+=lin[night.d[ni]]*nf;cg+=lin[night.d[ni+1]]*nf;cb+=lin[night.d[ni+2]]*nf;}
 const rim=s.air*Math.min(1.55,s.flux*sm(-.19,.32,ds)+s.flux2*sm(-.19,.32,dt))*(.57*(1-nv)**3.65+.009*(1-nv)**1.3);
 r=film(cr+rim*s.airColor[0]);gr=film(cg+rim*s.airColor[1]);bl=film(cb+rim*s.airColor[2]);
 }else{alpha=cutout?0:1;if(!cutout){const gx=g[0]*rx+g[3]*ry+g[6]*rz,gy=g[1]*rx+g[4]*ry+g[7]*rz,gz=g[2]*rx+g[5]*ry+g[8]*rz;
 const i=idx(sky,.5-Math.atan2(gy,gx)/tau,Math.acos(Math.max(-1,Math.min(1,gz)))/Math.PI);r=sg[sky.d[i]];gr=sg[sky.d[i+1]];bl=sg[sky.d[i+2]];}
 if(s.air&&imp2<1.0527){const imp=Math.sqrt(imp2),tt=-d*rz,nx=rx*tt/imp,ny=ry*tt/imp,nz=(d+rz*tt)/imp,lit=s.flux*sm(-.22,.39,nx*S[0]+ny*S[1]+nz*S[2])+s.flux2*sm(-.22,.39,nx*T[0]+ny*T[1]+nz*T[2]),halo=s.air*.51*Math.min(1.5,lit)*Math.exp(-(imp-1)/(.0036*Math.max(.53,s.air)))*(1-sm(.014,.026,imp-1));const dusk=E?Math.pow(Math.max(0,rx*S[0]+ry*S[1]+rz*S[2]),13)*(1-sm(.025,.19,Math.abs(nx*S[0]+ny*S[1]+nz*S[2])))*Math.exp(-(imp-1)/.0031)*Math.min(1,s.flux)*.64:0;if(cutout){alpha=Math.min(1,Math.max(0,(halo+dusk)**.46));}
r+=film(halo*s.airColor[0]+.95*dusk);gr+=film(halo*s.airColor[1]+.27*dusk);bl+=film(halo*s.airColor[2]+.042*dusk);}
 if(!cutout)for(let j=0;j<(s.flux2?2:1);j++){const l=j?T:S,f=j?s.flux2:s.flux,ang=j?s.starSize:s.sunSize,co=rx*l[0]+ry*l[1]+rz*l[2];if(co>.986&&f>0){const th=Math.sqrt(Math.max(0,1-co*co)),v=255*((1-sm(Math.max(0,ang-.54/h),ang+.54/h,th))*2.8+.10*Math.exp(-th/Math.max(ang*4,.001))+.019*Math.exp(-th/Math.max(ang*16,.003)));r+=v;gr+=v*(j?.79:.96);bl+=v*(j?.61:.89);}}}
 if(R){const pd=b[1]*rx+b[4]*ry+b[7]*rz,rt=-d*b[7]/pd;if(rt>0&&rt<t){const px=rx*rt,py=ry*rt,pz=d+rz*rt,rad=Math.hypot(px,py,pz);if(rad>1.21&&rad<2.27){const i=idx(ring,(rad-1.21)/1.06,.5),a=s.ringProfile?1-(1-ring.d[i+3]/255)**(1/Math.max(.02,Math.abs(pd))):limit(ring.d[i+3]/255*(1.18-.12*Math.abs(pd))),shadow=l=>{const dl=px*l[0]+py*l[1]+pz*l[2];return dl<0&&rad*rad-dl*dl<1?.055:1},light=s.flux*shadow(S)*(.48+.52*Math.abs(S[0]*b[1]+S[1]*b[4]+S[2]*b[7]))+s.flux2*shadow(T)*.55+.00018;
 const coverage=alpha*(1-a)+a;
 if(coverage>0){r=(r*alpha*(1-a)+a*film(lin[ring.d[i]]*light))/coverage;gr=(gr*alpha*(1-a)+a*film(lin[ring.d[i+1]]*light))/coverage;bl=(bl*alpha*(1-a)+a*film(lin[ring.d[i+2]]*light))/coverage;}
 alpha=coverage;}}}
 a[pix]=r;a[pix+1]=gr;a[pix+2]=bl;a[pix+3]=Math.round(255*alpha);
}}
ctx.putImageData(img,0,0);
};
}};
