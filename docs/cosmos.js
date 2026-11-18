// The sky is a direction on the celestial sphere; the two spatial maps use distances in light-years.
globalThis.CosmicSky = (()=>{
  const r=Math.PI/180,c=Math.cos,s=Math.sin,eps=23.439291*r,src='assets/catalog/cosmos/';
  const photo=new Map();
  function vec(ra,dec){const a=ra*r,d=dec*r;return[c(d)*c(a),c(d)*s(a),s(d)];}
  function ecl(p){return[p[0],p[1]*c(eps)+p[2]*s(eps),-p[1]*s(eps)+p[2]*c(eps)];}
  function camera(ra,dec,focal){const a=ra*r,d=dec*r;return {front:ecl(vec(ra,dec)).map(x=>-x),right:ecl([s(a),-c(a),0]),up:ecl([-s(d)*c(a),-s(d)*s(a),c(d)]),focal,skyFocal:focal,principal:[.5,.49]};}
  const dot=(v,w)=>v[0]*w[0]+v[1]*w[1]+v[2]*w[2];
  function screen(pane,cam,v){const depth=-dot(v,cam.front);if(depth<=.005)return null;const f=(cam.skyFocal||cam.focal)/depth;return[pane.x+pane.w*cam.principal[0]+f*dot(v,cam.right),pane.y+pane.h*cam.principal[1]-f*dot(v,cam.up)];}
  function getImage(file,ready){if(!file)return null;if(!photo.has(file)){const im=new Image();im.decoding='async';im.onload=()=>{for(const fn of photo.get(file).ready)fn();photo.get(file).ready.clear();};photo.set(file,{im,ready:new Set()});im.src=LabMedia.file(src+file);}const cell=photo.get(file);if(!cell.im.complete&&ready)cell.ready.add(ready);return cell.im.naturalWidth?cell.im:null;}
  function color(bv){return bv==null?'#d9e4ef':bv<.05?'#bbd4ff':bv<.48?'#d6e5ff':bv<.8?'#f4eee2':bv<1.22?'#f3d9b7':'#ecc49d';}
  function stellarMotion(ra,dec,muEast,muNorth){
    const a=ra*r,d=dec*r,k=r/3600000;
    return ecl([(-s(a)*muEast-c(a)*s(d)*muNorth)*k,
      (c(a)*muEast-s(a)*s(d)*muNorth)*k,c(d)*muNorth*k]);
  }
  const starSprites=new Map();
  function starSprite(tint){
    if(starSprites.has(tint))return starSprites.get(tint);
    const im=document.createElement('canvas');im.width=im.height=48;
    const g=im.getContext('2d'),glow=g.createRadialGradient(24,24,0,24,24,24);
    for(const [radius,colour] of [[0,'#ffffff'],[.13,'#fffffff5'],[.25,tint+'cf'],[.43,tint+'53'],[.68,tint+'19'],[1,tint+'00']])glow.addColorStop(radius,colour);
    g.fillStyle=glow;g.fillRect(0,0,48,48);starSprites.set(tint,im);return im;
  }
  function note(xy,id,label,reach){
    return {x:xy[0],y:xy[1],reach,radius:2,index:-3,inFront:true,label,note:'sky',target:{domain:'sky',id}};
  }
  function dotStars(ctx,p,cam,stars,light=1,annotations){
    const scale=Math.max(.69,Math.min(1,cam.overviewScale??1));
    const survey=cam.surveySky;
    // Expose each catalogue point at screen resolution. Zoom changes the
    // angular separation of stars while the brightest cores stay compact.
    const limitingMag=survey?7.45+2.5*Math.log10(Math.max(.001,light*light)):Infinity;
    for(const star of stars){
      if(star.mag>limitingMag+.5)continue;
      const xy=screen(p,cam,star.v);
      if(!xy||xy[0]<p.x||xy[0]>p.x+p.w||xy[1]<p.y||xy[1]>p.y+p.h)continue;
      const flux=Math.min(1.9,10**(-.14*(star.mag-2))),power=Math.min(1,flux);
      const catalogGain=cam.photographic ? .53 : 1;
      const response=survey?Math.sqrt(light)*Math.min(1,limitingMag+.5-star.mag)*catalogGain:light;
      if(survey){
        const power=10**(-.4*(star.mag-2)),core=Math.min(1.8,.51+.32*Math.sqrt(power));
        if(star.mag<2.6){
          const halo=(2.3+core*2.5)*scale;
          ctx.globalAlpha=.55*response;
          ctx.drawImage(starSprite(star.color),xy[0]-halo,xy[1]-halo,2*halo,2*halo);
        }
        ctx.fillStyle=star.color;ctx.globalAlpha=response*Math.min(1,.11+.86*Math.sqrt(power));
        ctx.beginPath();ctx.arc(xy[0],xy[1],core*scale,0,2*Math.PI);ctx.fill();
      }else if(star.mag<4){
        const width=(3.2+6.8*flux)*scale;
        ctx.globalAlpha=response*(.64+.36*power);
        ctx.drawImage(starSprite(star.color),xy[0]-width/2,xy[1]-width/2,width,width);
      }else{
        const width=(.61+.79*flux)*scale;
        ctx.globalAlpha=response*(.19+.78*power);ctx.fillStyle=star.color;
        ctx.fillRect(xy[0]-width/2,xy[1]-width/2,width,width);
      }
      if(annotations&&star.label&&star.mag<2.1&&annotations.length<(p.w<550?1:2)&&
          !annotations.some(a=>Math.hypot(a.x-xy[0],a.y-xy[1])<p.w*.18))annotations.push(note(xy,star.id,star.label,4));
    }
    ctx.globalAlpha=1;
  }
  const galaxyNames={m31:'안드로메다은하',m33:'삼각형자리은하',lmc:'대마젤란은하',smc:'소마젤란은하'};
  function loadStamps(){
    return Promise.all(['cosmos/skystamps.json','cosmos/orbit-galaxies.json'].map(path=>
      LabCatalog.load(path).then(data=>(data.stamps||[]).map(g=>data.skyAtlas?{...g,atlas:data.skyAtlas}:g)).catch(()=>[]))).then(groups=>groups.flat());
  }
  const stampAxes=new WeakMap();
  function axesFor(g){
    if(!stampAxes.has(g)){
      const a=g.raDeg*r,d=g.decDeg*r;
      stampAxes.set(g,{v:ecl(vec(g.raDeg,g.decDeg)),east:ecl([-s(a),c(a),0]),north:ecl([-s(d)*c(a),-s(d)*s(a),c(d)])});
    }
    return stampAxes.get(g);
  }
  function stamps(ctx,p,cam,list,ready,annotations,light=1,emphasize=false){
    const focal=cam.skyFocal||cam.focal,[cx,cy]=cam.principal;
    const corner=Math.hypot(p.w*Math.max(cx,1-cx),p.h*Math.max(cy,1-cy));
    const viewAngle=Math.atan2(corner+65,focal),candidates=[];
    for(const g of list){
      if(!g.file)continue;
      const {v,east,north}=axesFor(g),depth=-dot(v,cam.front);
      const radius=Math.hypot(g.widthDeg,g.heightDeg)*r/2;
      if(depth<=.005||depth<Math.cos(Math.min(Math.PI,viewAngle+radius)))continue;
      const scale=focal/depth,tx=dot(v,cam.right)/depth,ty=dot(v,cam.up)/depth;
      const x=p.x+p.w*cx+focal*tx,y=p.y+p.h*cy-focal*ty;
      const major=g.majorArcmin??Math.max(g.widthDeg,g.heightDeg)*38;
      const apparentMajor=scale*major*r/60;
      // Preserve differences between angular sizes, including while zooming.
      // Nearby extended galaxies already have their true outlines in the optical mosaic.
      const boost=emphasize&&g.survey ? 1+12/(1+apparentMajor/10) : 1;
      const width=2*Math.tan(g.widthDeg*r/2)*scale*boost,height=2*Math.tan(g.heightDeg*r/2)*scale*boost;
      const ax=-(dot(east,cam.right)+tx*dot(east,cam.front))*width;
      const ay=(dot(east,cam.up)+ty*dot(east,cam.front))*width;
      const bx=-(dot(north,cam.right)+tx*dot(north,cam.front))*height;
      const by=(dot(north,cam.up)+ty*dot(north,cam.front))*height;
      const ex=(Math.abs(ax)+Math.abs(bx))*.5,ey=(Math.abs(ay)+Math.abs(by))*.5;
      if(x+ex<p.x||y+ey<p.y||x-ex>p.x+p.w||y-ey>p.y+p.h)continue;
      // ESO already photographed the four extended Local Group galaxies.
      // Blend in finer structure only when the mosaic's native pixels are enlarged.
      const detail=cam.photographic&&!g.survey?Math.max(0,Math.min(1,(scale-1150)/2050)):1;
      if(detail>0){
        const atlas=g.atlas,im=getImage(atlas?.file||g.file,ready);
        if(im){
          ctx.save();ctx.globalCompositeOperation='screen';
          const exposure=cam.photographic?light:Math.sqrt(light);
          const strength=g.survey ? (emphasize ? .81 : .53) : (cam.photographic ? .37 : .59);
          ctx.globalAlpha=Math.min(1,exposure*detail*strength);
          ctx.transform(ax,ay,bx,by,x,y);
          if(atlas){
            const side=atlas.tilePixels,column=g.skyTile%atlas.columns,row=Math.floor(g.skyTile/atlas.columns);
            ctx.drawImage(im,column*side,row*side,side,side,-.5,-.5,1,1);
          }else ctx.drawImage(im,-.5,-.5,1,1);
          ctx.restore();
        }
      }
      if(!annotations)continue;
      const name=g.nameKo||galaxyNames[g.id];if(!name)continue;
      const reach=Math.max(4,apparentMajor*boost*.40);
      const item=note([x,y],g.id,name,reach);
      Object.assign(item,{galaxy:true,source:g.survey,pickRadius:Math.max(p.w<550?12:8,Math.min(32,reach+3)),hideLabel:true});
      annotations.push(item);
      if(x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h&&(emphasize||!g.survey))
        candidates.push({item,mag:g.magnitude??3});
    }
    // Reserve enough space between galaxy names for the nearby planet labels.
    const shown=[];
    for(const {item} of candidates.sort((a,b)=>a.mag-b.mag)){
      if(shown.length>=(p.w<550?2:4))break;
      if(shown.some(o=>Math.hypot(o.x-item.x,o.y-item.y)<Math.min(110,p.w*.17)))continue;
      item.hideLabel=false;shown.push(item);
    }
  }
  function observerKey(cam){
    const eye=cam.cruising?cam.eye.map(v=>Math.round(v*2)):[];
    return [Math.floor((cam.day??0)/32),cam.closeBody??0,cam.run?.kind,...eye].join('/');
  }
  function setupBackdrop(changed){
    let stars=[],galaxies=[],centre=null,survey=null,reading=false,lastObserver='';
    const bump=()=>changed();
    LabCatalog.load('cosmos/stars.json').then(d=>{
      stars=d.rows.map(row=>{
        const base=ecl(vec(row[1],row[2]));
        return {base,v:base.slice(),perAU:row[5]>0?1/(row[5]*63241.077):0,
          mag:row[3],color:color(row[4]),id:'hip'+row[0],label:d.meta.koreanNamesByHip[row[0]]};
      });
      lastObserver='';bump();
      return LabCatalog.load('cosmos/starmotion.json.gz').then(m=>{
        const speeds=new Map(m.rows.map(row=>[row[0],row]));
        for(let i=0;i<stars.length;i++){
          const row=d.rows[i],motion=speeds.get(row[0]);
          if(motion)stars[i].drift=stellarMotion(row[1],row[2],motion[1],motion[2]);
        }
        lastObserver='';bump();
      });
    }).catch(()=>{});
    LabCatalog.load('cosmos/galaxies.json').then(d=>{const g=d.galaxies.find(x=>x.kindCode==='galactic-center');if(g)centre=ecl(vec(g.raDeg,g.decDeg));bump();}).catch(()=>{});
    loadStamps().then(data=>{galaxies=data;bump();}).catch(()=>{});
    return(ctx,p,cam,showSurvey,exposure,emphasize)=>{
      const annotations=[],light=Math.min(1,exposure*1.15);
      const day=cam.day??0,target=cam.closeBody??0;
      // Catalogue proper motions already include the Sun's motion. Apply only
      // the local offset of the travelling camera, in AU, for annual parallax.
      const localEye=cam.cruising?cam.eye:null;
      const observer=observerKey(cam);
      if(observer!==lastObserver){
        lastObserver=observer;
        const years=(LabInitial.jd-2451545+day)/365.25;
        const eye=localEye??(target&&cam.run?GravityLab.read(cam.run,target,day):[0,0,0]);
        for(const star of stars)for(let i=0;i<3;i++)
          star.v[i]=star.base[i]+(star.drift?.[i]??0)*years-eye[i]*star.perAU;
      }
      ctx.save();ctx.beginPath();ctx.rect(p.x,p.y,p.w,p.h);ctx.clip();
      if(showSurvey&&!reading){reading=true;LabCatalog.load('cosmos/redshift.json.gz').then(d=>{survey=d.rows.map(row=>ecl(vec(row[1],row[2])));bump();}).catch(()=>{reading=false;});}
      if(showSurvey&&survey){ctx.fillStyle='rgba(162,183,190,.47)';for(const v of survey){const point=screen(p,cam,v);if(point&&point[0]>=p.x&&point[0]<=p.x+p.w&&point[1]>=p.y&&point[1]<=p.y+p.h)ctx.fillRect(point[0],point[1],.9,.9);}}
      stamps(ctx,p,cam,cam.surveySky?galaxies:galaxies.filter(g=>!g.survey),bump,annotations,light,emphasize);
      const starNotes=[];dotStars(ctx,p,cam,stars,light,starNotes);annotations.push(...starNotes);
      ctx.restore();
      const gc=centre&&screen(p,cam,centre);
      if(gc)annotations.push(note(gc,'milky-way','궁수자리 A* 방향',4));
      return annotations;
    };
  }
  return {vec,ecl,camera,screen,color,stellarMotion,dotStars,stamps,loadStamps,getImage,observerKey,setupBackdrop,src};
})();

globalThis.createCosmosViewer=function(){
  const S=CosmicSky,D=LabCatalog,id=k=>document.getElementById(k),dialog=id('cosmos-view'),canvas=id('cosmos-map'),ctx=canvas.getContext('2d'),sky=id('cosmos-sky'),select=id('cosmos-target'),rad=Math.PI/180;
  const f=v=>Number(v).toLocaleString('ko-KR',{maximumFractionDigits:v<20?2:0});
  const names={sky:'별하늘',near:'태양 이웃',milky:'우리은하',galaxies:'이웃 은하',survey:'은하 전천 분포'};
  let mode='sky',rev=0,selection='',ra=34,dec=32,yaw=-.75,pitch=.42,zoom=1,pan=[0,0],points=[],hits=[],stars,nearby,galaxies,milky,stampList=[],motions={},survey,skyPaint,raf=0,tracks=true,skyStars=[],traceSpan=1;
  const selected=()=>points.find(x=>x.id===selection);
  const redraw=()=>{if(dialog.open&&!raf)raf=requestAnimationFrame(()=>{raf=0;draw();});};
  function info(){const obj=selected(),name=id('cosmos-object'),details=id('cosmos-detail'),link=id('cosmos-source'),im=id('cosmos-photo');im.hidden=true;delete im.dataset.band;
    if(mode==='milky'){name.textContent=selection==='gc'?'은하 중심':'우리은하 속 태양계';details.textContent='은하 중심에서 약 26,600광년 · '+(tracks?'태양의 약 2억 2천만 년 공전 궤도 근사':'가이아 관측 기반 정면 재구성');link.textContent='ESA/Gaia/DPAC · Stefan Payne-Wardenaar · CC BY-SA 3.0 IGO ↗';link.href=milky?.source?.url||'https://www.esa.int/media/the-best-milky-way-map-by-gaia';return;}
    link.textContent='관측 자료 ↗';if(mode==='survey'){name.textContent='2MASS 적색편이 조사';details.textContent=(survey?f(survey.count):'')+'개 은하의 전천 분포'+(tracks?' · 청색은 접근, 따뜻한 색은 후퇴, 회색은 속도 미측정':'')+' · 은하면 주변 조사 공백';link.href=survey?.source||'https://heasarc.gsfc.nasa.gov/W3Browse/catalog/twomassrsc.html';return;}
    if(!obj){name.textContent=mode==='sky'?'히파르코스 별하늘':'가까운 천체';details.textContent=mode==='sky'?'실제 별 '+f(stars?.rows.length||0)+'개의 방향과 밝기 · ESO 은하수 전천 관측': '관측 대상을 선택하세요.';link.href='https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/hipparcos.html';return;}
    name.textContent=obj.name;let extra='';if(mode==='galaxies'&&tracks){const motion=motions[obj.id];extra=motion?.status==='full'?' · 입체 운동 방향 (100만 년, 길이 ×100)':motion?.radialKmS!=null?' · 시선속도 방향만 표시 (점선, 길이 ×100)':' · 공간 운동 자료 부족';}
    details.textContent=(obj.id==='sun'?'태양계의 기준점':obj.dist!=null?'태양에서 '+f(obj.dist)+'광년':'거리 미확정')+(obj.mag!=null?' · 겉보기등급 '+f(obj.mag):'')+extra;
    if(obj.skyNote)details.textContent+=' · '+obj.skyNote;
    if(obj.radio){link.textContent='EHT Collaboration · 전파 관측 원본 ↗';im.dataset.band='radio';}
    if(obj.angular){
      details.textContent='하늘에서 긴 쪽 지름 '+f(obj.angular)+'각분 · '+(obj.band||'V')+'등급 '+f(obj.mag);
      link.textContent=obj.credit+' ↗';
    }
    link.href=obj.source||(mode==='near'?'https://doi.org/10.26093/cds/vizier.36500201':'https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/hipparcos.html');if(obj.photo){im.hidden=false;im.src=LabMedia.file(S.src+obj.photo);im.alt=obj.alt||obj.name+' 관측 사진';im.title=obj.credit||'';}
  }
  function useTarget(value,aim){selection=value;select.value=value;const obj=selected();if(aim&&obj&&['sky','survey'].includes(mode)&&obj.ra!=null){ra=obj.ra;dec=obj.dec;}info();redraw();}
  async function change(value,target){const token=++rev;mode=value;zoom=1;pan=[0,0];selection='';hits=[];points=[];select.replaceChildren();id('cosmos-title').textContent=names[mode];id('cosmos-object').textContent='관측 자료를 여는 중…';id('cosmos-detail').textContent='';id('cosmos-photo').hidden=true;
    for(const b of id('cosmos-scales').children)b.setAttribute('aria-pressed',String(b.dataset.scale===mode));id('cosmos-tracks').hidden=!['milky','galaxies','survey'].includes(mode);id('cosmos-tracks').textContent=mode==='survey'?'시선속도 색':'궤적 표시';id('cosmos-tracks').setAttribute('aria-pressed',String(tracks));sky.hidden=mode!=='sky';redraw();
    try{if(value==='sky'||value==='survey'){
        const [a,g,st]=await Promise.all([D.load('cosmos/stars.json'),D.load('cosmos/galaxies.json'),S.loadStamps()]);if(token!==rev)return;stars=a;galaxies=g;stampList=st;
        if(!skyStars.length)skyStars=stars.rows.map(r=>({v:S.ecl(S.vec(r[1],r[2])),mag:r[3],color:S.color(r[4])}));points=stars.rows.filter(r=>r[6]).map(r=>({id:'hip'+r[0],name:stars.meta.koreanNamesByHip[r[0]]||r[6],ra:r[1],dec:r[2],dist:r[5],mag:r[3]}));const external=g.galaxies.filter(x=>x.photo).map(x=>({id:x.id,name:x.skyNameKo||x.nameKo,ra:x.raDeg,dec:x.decDeg,dist:x.distanceLy,photo:x.photo,source:x.imageSource,credit:x.credit,radio:x.kindCode==='galactic-center',alt:x.photoAltKo,skyNote:x.skyNoteKo}));for(const image of stampList.filter(x=>x.survey)){
          external.push({id:image.id,name:image.nameKo,ra:image.raDeg,dec:image.decDeg,mag:image.magnitude,
            photo:image.file,source:image.source,credit:image.credit,angular:image.majorArcmin,band:image.magnitudeBand});
        }
        points.unshift(...external);if(value==='survey'){survey=await D.load('cosmos/redshift.json.gz');if(token!==rev)return;}ra=value==='survey'?180:32;dec=value==='survey'?0:32;
      }else if(value==='near'){const n=await D.load('cosmos/nearby.json');if(token!==rev)return;nearby=n;points=n.rows.map(r=>({id:r[0],name:n.meta.koreanNamesById[r[0]]||r[1],dist:r[4],v:r.slice(5,8),mag:r[8]}));}
      else if(value==='milky'){milky=await D.load('cosmos/milkyway.json');if(token!==rev)return;points=[{id:'sun',name:'태양계 위치'},{id:'gc',name:'은하 중심'}];}
      else{const [g,m]=await Promise.all([D.load('cosmos/galaxies.json'),D.load('cosmos/motion.json')]);if(token!==rev)return;galaxies=g;motions=m.objects||{};points=g.galaxies.map(x=>({id:x.id,name:x.nameKo,dist:x.distanceLy,v:S.vec(x.raDeg,x.decDeg).map(v=>v*x.distanceLy),ra:x.raDeg,dec:x.decDeg,photo:x.photo,credit:x.credit,source:x.imageSource||x.source,radio:x.kindCode==='galactic-center',alt:x.photoAltKo}));}
      select.replaceChildren(...(['sky','survey'].includes(value)?[new Option('전체 별하늘','')]:[]),...points.map(p=>new Option(p.name,p.id)));useTarget(target??(value==='near'||value==='milky'?'sun':value==='galaxies'?'m31':''),!!target);
    }catch{if(token===rev){id('cosmos-object').textContent='자료를 불러오지 못했습니다';id('cosmos-detail').textContent='같은 거리 규모를 다시 눌러 주세요.';}}
  }
  const pointer=(w,h,v,span,center=[0,0,0])=>{const x=v[0]-center[0],y=v[1]-center[1],z=v[2]-center[2],co=Math.cos(yaw),si=Math.sin(yaw),a=x*co-y*si,b=x*si+y*co,scale=Math.min(w,h)*.43*zoom/span;return [w*.5+a*scale,h*.51+(b*Math.sin(pitch)-z*Math.cos(pitch))*scale,scale];};
  function disk(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  function label(x,y,text,active=false){ctx.fillStyle=active?'#ffe3ae':'#bdd0d9';ctx.shadowColor='#04070b';ctx.shadowBlur=4;ctx.font=(active?'600 ':'500 ')+'11px sans-serif';ctx.fillText(text,x+7,y-6);ctx.shadowBlur=0;}
  // Hammer equal-area projection shows the entire survey, including the Galactic-plane mask.
  function drawSurvey(w,h){
    if(!survey)return;
    const rx=Math.min(w*.465,(h*.72-90))*zoom,ry=rx*.50,cx=w*.5,cy=h*.51;
    const mid=ra*rad,latitude=dec*rad,cs=Math.cos(latitude),sn=Math.sin(latitude);
    const skyPoint=(raDeg,decDeg)=>{
      const lon=raDeg*rad-mid,lat=decDeg*rad,l=Math.cos(lat);
      const x=l*Math.cos(lon),y=l*Math.sin(lon),z=Math.sin(lat);
      const phi=Math.asin(Math.max(-1,Math.min(1,z*cs-x*sn))),lam=Math.atan2(y,x*cs+z*sn),c=Math.cos(phi),k=Math.sqrt(1+c*Math.cos(lam/2));
      return [cx-rx*c*Math.sin(lam/2)/k,cy-ry*Math.sin(phi)/k];
    };
    ctx.strokeStyle='#40515e';ctx.lineWidth=.8;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.stroke();
    const size=Math.max(.72,Math.min(1.5,w/800));
    for(const r of survey.rows){const xy=skyPoint(r[1],r[2]),v=r[3];ctx.fillStyle=!tracks?'#a1b9c3a0':v==null?'#73838f':v<0?'#77bdff':v<5000?'#cfdbc2':v<10000?'#dab180':'#c97d65';ctx.fillRect(xy[0],xy[1],size,size);}
    const target=selected();if(target){const xy=skyPoint(target.ra,target.dec);ctx.strokeStyle='#fff0b8';ctx.beginPath();ctx.arc(...xy,4,0,Math.PI*2);ctx.stroke();label(...xy,target.name,true);}
  }
  function draw(){if(!dialog.open)return;const w=dialog.clientWidth,h=dialog.clientHeight;if(!w||!h)return;const dpr=Math.min(window.devicePixelRatio||1,1.6);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);hits=[];const pane={x:0,y:0,w,h};
    if(mode==='survey'){drawSurvey(w,h);return;}
    if(mode==='sky'){if(!stars)return;const focal=Math.min(w,h)*.78*zoom,cam=S.camera(ra,dec,focal);skyPaint??=createMapSky(sky,redraw,false);skyPaint(w,h,dpr,[{pane,camera:cam,exposure:mode==='sky'?.82:.25}]);
      if(mode==='sky'){S.stamps(ctx,pane,{...cam,photographic:true},stampList.filter(g=>!g.survey||g.id===selection),redraw);S.dotStars(ctx,pane,cam,skyStars,.93);}
      for(const p of points){const xy=S.screen(pane,cam,S.ecl(S.vec(p.ra,p.dec)));if(!xy||xy[0]<0||xy[1]<0||xy[0]>w||xy[1]>h)continue;hits.push([xy[0],xy[1],p.id]);if(p.radio&&p.id===selection){
          ctx.save();ctx.translate(...xy);ctx.strokeStyle='#bbd5e6';ctx.lineWidth=1;ctx.beginPath();
          for(let i=0;i<4;i++){ctx.moveTo(5,0);ctx.lineTo(12,0);ctx.rotate(Math.PI/2);}ctx.stroke();ctx.restore();
          label(xy[0]+9,xy[1]-5,'궁수자리 A* 방향',true);
        }else if(p.id===selection||(!selection&&(p.mag<.75||p.id==='m31'||p.id==='m33')))label(...xy,p.name,p.id===selection);}
    }else if(mode==='milky'&&milky){const im=S.getImage('milkyway.webp',redraw);const side=Math.min(w,h)*.96*zoom,x=(w-side)/2+pan[0],y=(h-side)/2+pan[1];if(im)ctx.drawImage(im,x,y,side,side);const sun=milky.coordinates.sun,gc=milky.coordinates.galacticCenter,sx=x+sun.x*side,sy=y+sun.y*side,gx=x+gc.x*side,gy=y+gc.y*side;if(tracks){ctx.save();ctx.setLineDash([5,4]);ctx.strokeStyle='#edc384b8';ctx.lineWidth=1.15;ctx.beginPath();ctx.arc(gx,gy,Math.hypot(sx-gx,sy-gy),0,Math.PI*2);ctx.stroke();ctx.restore();}disk(sx,sy,4,'#fff0bd');disk(gx,gy,3,'#e7daae');label(sx,sy,'태양계',selection==='sun');label(gx,gy,'은하 중심',selection==='gc');hits.push([sx,sy,'sun'],[gx,gy,'gc']);
    }else if((mode==='near'||mode==='galaxies')&&points.length){const gal=mode==='galaxies',span=gal?Math.max(...points.map(p=>p.dist))*.68:34,center=gal?(points.find(p=>p.id==='m31')?.v||[0,0,0]).map(x=>x*.48):[0,0,0];
      const placed=points.map(p=>({p,xy:pointer(w,h,p.v,span,center)}));for(const {p,xy} of placed){const x=xy[0],y=xy[1],active=p.id===selection;if(x<0||y<0||x>w||y>h)continue;hits.push([x,y,p.id]);const motion=motions[p.id];if(gal&&tracks&&motion?.radialKmS!=null){
          const a=p.ra*rad,d=p.dec*rad,u=S.vec(p.ra,p.dec),east=[-Math.sin(a),Math.cos(a),0],north=[-Math.cos(a)*Math.sin(d),-Math.sin(a)*Math.sin(d),Math.cos(d)],factor=4.74047*motion.distanceKpc;
          const vel=u.map((axis,i)=>motion.radialKmS*axis+factor*(east[i]*(motion.muRaStarMasYr||0)+north[i]*(motion.muDecMasYr||0)));
          const end=pointer(w,h,p.v.map((v,i)=>v+vel[i]*3.33564*100*traceSpan),span,center);
          const angle=Math.atan2(end[1]-y,end[0]-x);ctx.save();ctx.strokeStyle=active?'#ffdaa1':'#c9aa80';ctx.lineWidth=active?1.8:1.15;
          if(motion.status==='radial-only')ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(...end.slice(0,2));ctx.stroke();
          ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(end[0]-4*Math.cos(angle-.45),end[1]-4*Math.sin(angle-.45));ctx.lineTo(end[0],end[1]);ctx.lineTo(end[0]-4*Math.cos(angle+.45),end[1]-4*Math.sin(angle+.45));ctx.stroke();ctx.restore();
        }
        disk(x,y,active?4:gal?2.5:p.id==='sun'?3.8:1.65,active||p.id==='sun'?'#ffe4a6':gal?'#a7d4cf':'#d0dfec');}
      for(const {p,xy} of placed){if(p.id===selection||p.id==='sun'||gal&&['milky-way','m31','m33','lmc'].includes(p.id)||!gal&&['sirius-a','barnards-star'].includes(p.id))label(xy[0],xy[1],p.name,p.id===selection);}
      const unit=gal?500000:5,pix=unit*Math.min(w,h)*.43*zoom/span;ctx.fillStyle='#8aa9b6';ctx.fillRect(20,h*.69,pix,1);ctx.font='10px sans-serif';ctx.fillText(f(unit)+' 광년',20,h*.69-5);
    }}
  function magnify(v){zoom=Math.max(.32,Math.min(45,zoom*v));redraw();}let gesture=null;const touches=new Map();const gap=()=>{const v=[...touches.values()];return Math.hypot(v[1][0]-v[0][0],v[1][1]-v[0][1]);};
  canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);touches.set(e.pointerId,[e.clientX,e.clientY]);gesture={x:e.clientX,y:e.clientY,travel:0,pinch:touches.size>1,start:touches.size>1?gap():0,z:zoom};};canvas.onpointermove=e=>{if(!gesture||!touches.has(e.pointerId))return;touches.set(e.pointerId,[e.clientX,e.clientY]);if(touches.size>1){zoom=Math.max(.32,Math.min(45,gesture.z*gap()/Math.max(1,gesture.start)));redraw();return;}const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;gesture.travel+=Math.abs(dx)+Math.abs(dy);gesture.x=e.clientX;gesture.y=e.clientY;if(mode==='sky'||mode==='survey'){ra+=dx*.12/zoom;dec=Math.max(-88,Math.min(88,dec+dy*.12/zoom));}else if(mode==='milky'){pan[0]+=dx;pan[1]+=dy;}else{yaw+=dx*.007;pitch+=dy*.007;}redraw();};canvas.onpointerup=e=>{touches.delete(e.pointerId);if(gesture&&!gesture.pinch&&gesture.travel<5){const b=canvas.getBoundingClientRect(),hit=hits.map(a=>[Math.hypot(e.clientX-b.left-a[0],e.clientY-b.top-a[1]),a[2]]).sort((a,b)=>a[0]-b[0])[0];if(hit?.[0]<15)useTarget(hit[1],false);}gesture=null;};canvas.onpointercancel=e=>{touches.delete(e.pointerId);gesture=null;};canvas.addEventListener('wheel',e=>{e.preventDefault();magnify(Math.exp(-e.deltaY*.0016));},{passive:false});canvas.onkeydown=e=>{if(['+','=','-'].includes(e.key)){e.preventDefault();magnify(e.key==='-'?.8:1.25);}else if(e.key.startsWith('Arrow')){e.preventDefault();const x=(e.key==='ArrowRight')-(e.key==='ArrowLeft'),y=(e.key==='ArrowDown')-(e.key==='ArrowUp');ra+=4*x;dec=Math.min(88,Math.max(-88,dec+4*y));yaw+=x*.10;pitch+=y*.10;pan[0]+=x*15;pan[1]+=y*15;redraw();}};
  for(const b of id('cosmos-scales').children)b.onclick=()=>change(b.dataset.scale);id('cosmos-plus').onclick=()=>magnify(1.3);id('cosmos-minus').onclick=()=>magnify(1/1.3);select.onchange=()=>useTarget(select.value,true);id('galaxy-inset-image').src=LabMedia.file(S.src+'milkyway.webp');id('galaxy-inset').onclick=()=>{dialog.showModal();change('milky');};id('cosmos-open').onclick=()=>openSky();id('cosmos-close').onclick=()=>dialog.close();id('cosmos-tracks').onclick=()=>{tracks=!tracks;id('cosmos-tracks').setAttribute('aria-pressed',String(tracks));info();redraw();};dialog.addEventListener('close',()=>{rev++;cancelAnimationFrame(raf);raf=0;touches.clear();gesture=null;});new ResizeObserver(redraw).observe(dialog);
  function openSky(target){if(!dialog.open)dialog.showModal();return change('sky',target);}
  return {openSky};
};
