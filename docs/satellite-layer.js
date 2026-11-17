// Source-epoch populations. The star/planet integration keeps its own running clock.
globalThis.LabFullLayer=(()=>{
  "use strict";
  const S=OrbitMapSpace,{dot}=OrbitFrames,AU=GravityLab.AU;
  const ready=new Set(),systems=new Map(),sprites=new Map(),rasters=new Map(),hostPositions=new Map();
  let survey=null,volume=null,started=false;
  const major=new Map(LabInitial.bodies.map((v,i)=>[v.id,i]));
  const name=key=>LabCatalog.majors.find(p=>p.key===key)?.name||LabCatalog.named(systems.get(key)?.name||key);
  function notify(){for(const cb of ready)cb();}
  function load(onChange){
    if(onChange)ready.add(onChange);if(started)return;started=true;
    LabCatalog.load('small/density.json.gz').then(v=>{volume=v;notify();}).catch(()=>{});
    LabCatalog.load('satellite-sky.json.gz').then(v=>{
      survey=v;
      for(const g of v.groups){
        systems.set(g.key,g);
        const q=g.hostPositionKm?g.hostPositionKm.map(x=>x/AU):CatalogOrbits.position(CatalogOrbits.small(g.hostOrbit),v.jdTDB);
        if(q)hostPositions.set(g.key,q);
      }
      const select=document.getElementById('system-list');
      if(select){for(const g of v.groups)select.add(new Option(name(g.key)+' · '+g.points.length.toLocaleString('ko-KR'),g.key));}
      notify();
    }).catch(()=>{});
  }
  const orientation=c=>[...c.right,...c.up].map(v=>v.toFixed(3)).join('/');
  function remember(map,key,value,limit){if(map.size>=limit)map.delete(map.keys().next().value);map.set(key,value);return value;}
  function galLocation(s,run,heliocentric){
    if(s.reference!=='galaxy')return heliocentric;
    const sun=S.world(s,run,0,s.day),off=S.compressed(s)?S.radial(heliocentric):heliocentric;
    return [sun[0]+off[0],sun[1]+off[1],sun[2]+off[2]];
  }
  function density(ctx,p,c,s,run){
    if(!volume||s.actualSize||s.fixedCamera)return;
    // The precompressed grid is stored in J2000 ecliptic coordinates. Rasterize
    // every occupied voxel for the view, then transform the result as the camera follows.
    const ortho=!!c.orthographic,linear=!S.compressed(s),extent=linear?volume.bounds.maxDistanceAU:volume.bounds.fitRadius;
    const key=[orientation(c),linear,ortho,ortho?'':[p.w,p.h,c.px,c.dist,p.x,p.y].join('/')].join('|');
    let rec=rasters.get(key);
    if(!rec){
      const w=ortho?840:Math.ceil(p.w),h=ortho?840:Math.ceil(p.h),factor=(w-2)/(2*extent);
      const surface=document.createElement('canvas');surface.width=w;surface.height=h;
      const dst=surface.getContext('2d'),img=dst.createImageData(w,h),ast=new Float32Array(w*h),comet=new Float32Array(w*h);
      for(const cell of volume.cells){
        let v=[cell[0]*volume.step,cell[1]*volume.step,cell[2]*volume.step];if(linear)v=S.radial(v,true);
        let x,y;if(ortho){x=w*.5+dot(v,c.right)*factor;y=h*.5-dot(v,c.up)*factor;}
        else{const q=c.projectDisplay(v);x=q.x-p.x;y=q.y-p.y;}
        x=Math.floor(x);y=Math.floor(y);if(x>=0&&x<w&&y>=0&&y<h){ast[y*w+x]+=cell[3];comet[y*w+x]+=cell[4];}
      }
      // A survey cell is a volume, not a point. Smooth the projected counts at
      // roughly the width of a voxel to remove grid aliasing at grazing angles.
      const smooth=field=>{
        const window=Math.max(1,Math.min(9,Math.round(ortho?volume.step*factor:volume.step*c.px)));
        const tmp=new Float32Array(field.length),out=new Float32Array(field.length),unit=1/(2*window+1);
        for(let y=0;y<h;y++){let sum=0;const row=y*w;for(let x=-window;x<w;x++){
          if(x+window<w)sum+=field[row+x+window];if(x-window-1>=0)sum-=field[row+x-window-1];if(x>=0)tmp[row+x]=sum*unit;
        }}
        for(let x=0;x<w;x++){let sum=0;for(let y=-window;y<h;y++){
          if(y+window<h)sum+=tmp[(y+window)*w+x];if(y-window-1>=0)sum-=tmp[(y-window-1)*w+x];if(y>=0)out[y*w+x]=sum*unit;
        }}return out;
      };
      const a=smooth(ast),b=smooth(comet);
      for(let i=0;i<a.length;i++){
        const n=a[i]+b[i];if(n<=.004)continue;
        const j=i*4,isComet=b[i]>a[i];img.data[j]=isComet?125:181;img.data[j+1]=isComet?161:165;img.data[j+2]=isComet?173:145;
        img.data[j+3]=Math.round(Math.min(96,Math.log1p(n*1.5)*13));
      }
      dst.putImageData(img,0,0);rec=remember(rasters,key,{surface,factor},3);
    }
    ctx.save();ctx.globalAlpha=s.allFit?.85:.43;
    if(ortho){const center=c.project(S.world(s,run,0,s.day)),side=rec.surface.width/rec.factor*c.px;
      ctx.drawImage(rec.surface,center.x-side/2,center.y-side/2,side,side);
    }else ctx.drawImage(rec.surface,p.x,p.y,p.w,p.h);ctx.restore();
  }
  function sprite(group,c,radius,small){
    const key=[group.key,orientation(c),Math.round(radius)].join('|');if(sprites.has(key))return sprites.get(key);
    const points=group.points,localScale=group.key==='earth'?6378:Math.max(30,(S.radii[major.get(group.key)]||500));
    const reach=Math.ceil(radius+(small?7:group.key==='earth'?15:22));
    const side=reach*2+4,im=document.createElement('canvas');im.width=im.height=side*2;
    const ctx=im.getContext('2d');ctx.scale(2,2);const middle=side/2;
    let maxDist=1;for(const row of points)maxDist=Math.max(maxDist,Math.hypot(row[2],row[3],row[4]));
    const largest=Math.log1p(maxDist/localScale),dense=points.length>1000;
    for(const [kind,id,x,y,z] of points){
      if(group.key==='earth'&&kind==='moon')continue; // The Moon is integrated and drawn with the planets.
      const length=Math.hypot(x,y,z);if(!length)continue;
      const arm=reach*Math.log1p(length/localScale)/largest,k=arm/length;
      const px=middle+(x*c.right[0]+y*c.right[1]+z*c.right[2])*k,py=middle-(x*c.up[0]+y*c.up[1]+z*c.up[2])*k;
      const natural=kind==='moon'||kind==='candidate',d=natural?(small?1.25:1.48):dense?.57:1.35;
      ctx.fillStyle=natural?'rgba(220,208,185,.57)':kind==='payload'?(dense?'rgba(150,192,217,.065)':'#a4c8daaa'):'rgba(154,153,151,.11)';
      ctx.fillRect(px-d/2,py-d/2,d,d);
    }
    return remember(sprites,key,{im,side},110);
  }
  function satellites(ctx,p,c,s,run,disks,hits){
    if(!survey||!s.showSatellites||s.actualSize||s.fixedCamera)return;
    const known=new Map(disks.map(q=>[q.index,q]));
    for(const group of systems.values()){
      const idx=major.get(group.key);let body=known.get(idx);
      if(group.key==='sun'){
        for(const row of group.points){const q=c.project(galLocation(s,run,row.slice(2,5).map(x=>x/AU)));if(q.inFront){ctx.fillStyle='#99bbc5cb';ctx.fillRect(q.x-1,q.y-1,2,2);}}
        continue;
      }
      if(!group.points.length&&!s.allFit)continue;
      if(idx!=null&&!body)continue;
      if(!body){const host=hostPositions.get(group.key);if(!host)continue;const q=c.project(galLocation(s,run,host));if(!q.inFront)continue;body={...q,radius:group.group==='dwarf'?2.0:1};}
      if(body.x<p.x-25||body.y<p.y-25||body.x>p.x+p.w+25||body.y>p.y+p.h+25)continue;
      if(idx==null){ctx.fillStyle=group.points.length?'#c6ba9fbb':'#9eaaa955';ctx.fillRect(body.x-1,body.y-1,2,2);}
      if(!group.points.length)continue;
      const sp=sprite(group,c,Math.round(body.radius),idx==null),side=sp.side;
      ctx.drawImage(sp.im,body.x-side/2,body.y-side/2,side,side);
      if(idx!==undefined){const r=side*.48;hits.push({index:group.key,panel:p,box:{x:body.x-r,y:body.y-r,w:r*2,h:r*2}});}
    }
  }
  return {load,density,satellites,galLocation,name,group:k=>systems.get(k),get survey(){return survey;}};
})();
