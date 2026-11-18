(() => {
  "use strict";
  const M=GravityLab,S=OrbitMapSpace;
  const bodies=LabInitial.bodies,names=[...bodies.map(b=>b.name),"동반성"];
  const mint="#a7d8cf",coral="#eda98a",tau=Math.PI*2,clamp=S.clamp;
  const font='"Lab Korean","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  const orbits=bodies.slice(1,9).map((_,i)=>M.initialEllipse(i+1));
  const trailColors=["221,198,157","149,157,168","208,188,159","148,187,213","210,165,141","206,195,180","208,197,171","155,195,197","150,177,210","192,191,187","224,190,151"];
  function createMap(canvas,stars,onPick,onChange){
    const ctx=canvas.getContext("2d");
    let glideTime=0,glideOffset=0,cruiseTime=0,scope="wide";
    let w=0,h=0,dpr=1,zoom=1,yaw=0,pitch=0,dirty=true,hits=[],hover=0,galacticWide=false;
    const galacticPoses=new Map();
    let changeover=null;
    function finishChangeover(){
      changeover?.remove();changeover=null;
    }
    function fadePreviousView(duration=240){
      finishChangeover();
      if(!w||matchMedia("(prefers-reduced-motion: reduce)").matches||!canvas.animate)return;
      const frame=document.createElement("canvas");
      frame.className="camera-changeover";frame.setAttribute("aria-hidden","true");
      frame.width=canvas.width;frame.height=canvas.height;
      const context=frame.getContext("2d",{alpha:false});
      context.drawImage(stars,0,0,frame.width,frame.height);context.drawImage(canvas,0,0);
      canvas.after(frame);changeover=frame;
      requestAnimationFrame(()=>{
        if(changeover!==frame)return;
        const fade=frame.animate([{opacity:1},{opacity:0}],{duration,easing:"ease-out",fill:"forwards"});
        fade.onfinish=()=>{if(changeover===frame)finishChangeover();};
      });
    }
    const ringPaths=new Map();
    LabFullLayer.load(invalidate);
    const pointers=new Map();let gesture=null;
    function invalidate(){dirty=true;}
    const sky=createMapSky(stars,invalidate),materials=createMapMaterials(invalidate),solar=createSolarOptics(invalidate);
    function change(){dirty=true;onChange(zoom);}
    function movePitch(delta){
      const low=scope==="sun"?-4:galacticWide?-1.4:-1.45,high=scope==="sun"?4:galacticWide?1.4:1.75;
      pitch=clamp(pitch+delta,low,high);
    }
    function zoomBy(mult){finishChangeover();zoom=clamp(zoom*mult,.45,12);change();}
    function reset(){finishChangeover();zoom=1;yaw=pitch=glideOffset=glideTime=cruiseTime=0;lastGlide=null;hover=0;change();}
    function switchGalacticCamera(from,to){
      fadePreviousView();
      if(from!==null)galacticPoses.set(from,{zoom,yaw,pitch,cruiseTime});
      const pose=galacticPoses.get(to);
      zoom=pose?.zoom??1;yaw=pose?.yaw??0;pitch=pose?.pitch??0;cruiseTime=pose?.cruiseTime??0;
      hover=0;lastGlide=null;change();
    }
    function resize(){
      const r=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);
      if(r.width<1||r.height<1||(r.width===w&&r.height===h&&ratio===dpr))return;
      w=r.width;h=r.height;dpr=ratio;
      canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);dirty=true;
    }
    new ResizeObserver(resize).observe(canvas);
    function panels(split){
      if(!split)return [{x:0,y:0,w,h,layer:"both"}];
      if(w<630)return [{x:0,y:0,w,h:h/2,layer:"base"},{x:0,y:h/2,w,h:h/2,layer:"test"}];
      return [{x:0,y:0,w:w/2,h,layer:"base"},{x:w/2,y:0,w:w/2,h,layer:"test"}];
    }
    function inPanel(p,q,margin=0){return q.x>=p.x+margin&&q.x<=p.x+p.w-margin&&q.y>=p.y+margin&&q.y<=p.y+p.h-margin;}
    function curve(camera,points,color,width,dash=[]){
      if(points.length<2)return;
      ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);
      let previous=points[0],a=camera.project(previous);
      for(let i=1;i<points.length;i++){
        const point=points[i],b=camera.project(point);
        if(a.inFront&&b.inFront){if(i===1)ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}
        else if(a.inFront!==b.inFront){
          const u=(camera.near-a.z)/(b.z-a.z);
          const edge=camera.project(previous.map((x,j)=>x+(point[j]-x)*u));
          if(a.inFront){if(i===1)ctx.moveTo(a.x,a.y);ctx.lineTo(edge.x,edge.y);}
          else{ctx.moveTo(edge.x,edge.y);ctx.lineTo(b.x,b.y);}
        }
        previous=point;a=b;
      }
      ctx.stroke();ctx.setLineDash([]);
    }
    function timePoints(s,run,id,start,end,count){
      const out=[];
      for(let i=0;i<=count;i++)out.push(S.world(s,run,id,start+(end-start)*i/count));
      return out;
    }
    const trailCache=new WeakMap();
    function cachedTrails(c,s,run){
      const bucket=Math.floor(s.day/2)*2,key=[bucket,S.compressed(s),...c.right,...c.up].join('|');
      let entry=trailCache.get(run);
      const {dot}=OrbitFrames;
      if(!entry||entry.key!==key){
        const snapshot={...s,day:bucket},paths=[];
        for(const id of run.active){
          const oldest=id===M.COMPANION?Math.max(0,bucket-365):bucket-365;
          const start=Math.ceil(oldest/2)*2;
          let lines=[],path,end,chunk=-1;
          for(let t=start;t<=bucket;t+=2){
            const v=S.world(snapshot,run,id,t),xy=[dot(v,c.right),-dot(v,c.up)],section=Math.min(5,Math.floor((t-start)/62));
            if(section!==chunk){path=new Path2D();lines.push(path);path.moveTo(...(end||xy));chunk=section;}
            path.lineTo(...xy);end=xy;
          }
          if(end)paths.push({id,lines,end});
        }
        entry={key,paths};trailCache.set(run,entry);
      }
      const lag=(s.day-bucket)*S.speedInAU;
      const dx=-dot(S.direction,c.right)*lag,dy=dot(S.direction,c.up)*lag;
      ctx.save();ctx.translate(c.ox+dx*c.px,c.oy+dy*c.px);ctx.scale(c.px,c.px);
      for(const {id,lines,end} of entry.paths){
        const selected=id===s.trailBody;
        ctx.lineWidth=(selected?1.8:id===0?1.3:1.05)/c.px;
        const alpha=selected?.95:id===0?.65:.51;
        lines.forEach((line,j)=>{ctx.strokeStyle="rgba("+trailColors[id]+","+(alpha*(.29+.71*(j+1)/lines.length))+")";ctx.stroke(line);});
        const tip=S.world(s,run,id,s.day);ctx.beginPath();ctx.moveTo(...end);ctx.lineTo(dot(tip,c.right)-dx,-dot(tip,c.up)-dy);ctx.stroke();
      }
      ctx.restore();
    }
    function trailAges(p,c,s,run){
      const id=s.trailBody;
      if(!(c.overview||c.orthographic)||s.allFit||s.cleanView||!s.showPaths||!run.active.includes(id))return [];
      const at=day=>c.project(S.world(s,run,id,day));
      const current=at(s.day),notes=[],marked=[current],compact=p.w<550;
      ctx.save();ctx.lineJoin="round";ctx.lineWidth=1.4;ctx.strokeStyle="rgb("+trailColors[id]+")";
      for(const age of [365,180,90]){
        const day=s.day-age,q=at(day),ahead=at(day+1);
        if(!q.inFront||!inPanel(p,q,8)||marked.some(m=>Math.hypot(q.x-m.x,q.y-m.y)<(compact?34:43)))continue;
        const dx=ahead.x-q.x,dy=ahead.y-q.y,len=Math.hypot(dx,dy);
        if(len<.001)continue;
        const x=dx/len,y=dy/len;
        ctx.beginPath();ctx.moveTo(q.x-5*x+2.5*y,q.y-5*y-2.5*x);ctx.lineTo(q.x,q.y);
        ctx.lineTo(q.x-5*x-2.5*y,q.y-5*y+2.5*x);ctx.stroke();
        notes.push({...q,index:-5,radius:3,reach:4,note:"age",label:age+"일 전"});marked.push(q);
      }
      ctx.restore();return notes;
    }
    const cruisePaths=new WeakMap();
    function cruiseTrails(c,s,run){
      // Reuse world coordinates as the camera moves. A translation accounts
      // for the time since the epoch without shifting the trails off the planets.
      const epoch=Math.floor(s.day/2)*2, compressed=S.compressed(s);
      let cache=cruisePaths.get(run);
      if(!cache||cache.epoch!==epoch||cache.compressed!==compressed){
        const frame={...s,day:epoch},paths=[];
        for(const id of run.active){
          const step=id===1?.5:id===2||id===M.EARTH||id===M.MOON?1:2;
          const start=id===M.COMPANION?Math.max(0,epoch-364):epoch-364;
          const points=[];
          for(let t=start;t<=epoch;t+=step)points.push(S.world(frame,run,id,t));
          paths.push({id,start,step,points});
        }
        cache={epoch,compressed,paths};cruisePaths.set(run,cache);
      }
      const lag=(s.day-epoch)*S.speedInAU,shift=S.direction.map(v=>v*lag);
      const atNow=v=>[v[0]-shift[0],v[1]-shift[1],v[2]-shift[2]];
      const shifted={near:c.near,project:v=>c.project(atNow(v))};
      for(const {id,start,step,points} of cache.paths){
        const rgb=trailColors[id],selected=id===(c.overview?s.trailBody:s.watch);
        const oldest=id===M.COMPANION?Math.max(0,s.day-365):s.day-365;
        const firstSample=Math.max(0,Math.ceil((oldest-start)/step)),chunk=18/step;
        if(firstSample<points.length&&oldest<start+firstSample*step){
          curve(c,[S.world(s,run,id,oldest),atNow(points[firstSample])],"rgba("+rgb+",.08)",1);
        }
        for(let first=firstSample;first<points.length-1;first+=chunk){
          const last=Math.min(first+chunk,points.length-1);
          const age=s.day-(start+(first+last)*step/2);
          const depth=shifted.project(points[(first+last)>>1]).z;
          const proximity=clamp(c.dist/Math.max(c.near,depth),.34,1.55);
          const nearFade=clamp((depth-c.near)/(c.dist*.30),0,1);
          const brightness=c.overview?.24+.57*(1-age/365):.09+.70*(1-age/365)**1.25;
          const opacity=Math.min(.95,brightness*Math.sqrt(proximity)*(selected?1.18:id===0?.98:.88))*nearFade;
          curve(shifted,points.slice(first,last+1),"rgba("+rgb+","+opacity+")",(selected?(c.overview?1.9:1.55):1.18)*Math.sqrt(proximity));
        }
        const tip=S.world(s,run,id,s.day),end=atNow(points[points.length-1]);
        curve(c,[end,tip],"rgba("+rgb+",.78)",selected?1.32:1.04);
      }
    }
    function galacticTrails(p,c,s,run,testView){
      if(c.cruising||c.overview)cruiseTrails(c,s,run);
      else if(c.orthographic)cachedTrails(c,s,run);
      else for(const id of run.active){
        const from=id===M.COMPANION?Math.max(0,s.day-365):s.day-365;
        if(s.day-from<.01)continue;
        const points=timePoints(s,run,id,from,s.day,168);
        for(let j=0;j<7;j++){
          const weight=(id===s.watch?.61:id===0?.40:.36)*(.23+.77*(j+1)/7);
          curve(c,points.slice(j*24,j*24+25),"rgba("+trailColors[id]+","+weight+")",id===s.watch?1.22:.82);
        }
      }
      if(testView&&s.applied&&s.kind==="vanish"&&s.day<365){
        curve(c,timePoints(s,s.base,0,s.day-365,0,70),"rgba(218,196,159,.26)",.82);
      }
      if(s.applied&&p.layer==="both"&&s.test!==s.base){
        const start=Math.max(0,s.day-365);
        if(s.day>start)curve(c,timePoints(s,s.base,s.watch,start,s.day,90),mint,1.1,[4,4]);
      }
      if(s.applied)prediction(c,s,run,testView?coral:mint,false);
    }
    function prediction(c,s,run,color,dashed){
      const end=s.day+90;
      if(end<=s.day)return;
      const points=timePoints(s,run,s.watch,s.day,end,96);
      ctx.save();ctx.globalAlpha=.69;curve(c,points,color,1.16,dashed?[4,4]:[]);
      const tip=c.project(points.at(-1));
      if(tip.inFront){ctx.fillStyle=color;ctx.beginPath();ctx.arc(tip.x,tip.y,1.55,0,tau);ctx.fill();}
      ctx.restore();
    }
    function solarTrails(p,c,s,run){
      if(s.scope==="wide"){
        const key=[p.x,p.y,p.w,p.h,zoom,yaw,pitch,s.watch,s.actualSize,s.linearDistances,s.allFit].join('/');
        let paths=ringPaths.get(key);
        if(!paths){paths=[];for(let i=1;i<=orbits.length;i++){
          const projected=orbits[i-1].map(c.project);
          for(let j=0;j<8;j++){
            const first=j*30,path=new Path2D();path.moveTo(projected[first].x,projected[first].y);
            for(let k=first+1;k<=first+30;k++)path.lineTo(projected[k].x,projected[k].y);
            const alpha=(i===s.watch?.32:.14)*clamp(c.dist/Math.max(c.near,projected[first+15].z),.42,1.32);
            paths.push([path,"rgba(168,187,201,"+alpha+")",i===s.watch?.91:.70]);
          }
        }if(ringPaths.size>=4)ringPaths.delete(ringPaths.keys().next().value);ringPaths.set(key,paths);}
        for(const [path,stroke,width] of paths){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke(path);}
      }else{
      for(let i=1;i<=orbits.length;i++){
        const ring=orbits[i-1];
        for(let j=0;j<8;j++){
          const part=ring.slice(j*30,j*30+31),mid=c.project(part[15]);
          const fade=clamp(c.dist/Math.max(c.near,mid.z),.42,1.32);
          const alpha=(i===s.watch?.32:.14)*fade;
          curve(c,part,"rgba(168,187,201,"+alpha+")",i===s.watch?.91:.70);
        }
      }
      }
      if(!s.applied)return;
      const representations=p.layer==="both"?[{path:s.test,color:coral,base:false},{path:s.base,color:mint,base:true}]:[{path:run,color:p.layer==="base"?mint:coral,base:p.layer==="base"}];
      representations.forEach(({path,color,base})=>{
        if(s.day>0)curve(c,timePoints(s,path,s.watch,Math.max(0,s.day-365),s.day,140),color,1.52,base?[5,3]:[]);
        prediction(c,s,path,color,base);
      });
    }
    function visualBody(index,position,c,p,s){
      const q=c.project(position);
      const physical=r=>r/M.AU*q.scale,real=s.actualSize||s.scope==="near"||s.scope==="sun";
      const isStar=index===0||index===M.COMPANION;
      const layout=clamp(Math.min(p.w/850,p.h/445),.66,1.30);
      const enlarged=(isStar?18.8:20*(S.radii[index]/69911)**.53)*layout*clamp(c.dist/Math.max(c.near,q.z),.25,2.8)*zoom**.36;
      const distanceInRadii=c.dist*M.AU/S.radii[index];
      const lunarSize=Math.min(p.w,p.h)*.115*(S.radii[index]/S.radii[M.EARTH])*zoom;
      const shortSide=c.overviewShortSide??Math.min(p.w,p.h);
      const wideSize=index===0?(c.orthographic||c.overview?clamp(shortSide*.061,17,43):clamp(shortSide*.077+3,18,60)):
        isStar?clamp(shortSide*.053,14,46):clamp(shortSide*.039,11,32)*(S.radii[index]/S.radii[5])**.49;
      const travelScale=c.cruising?clamp(c.dist/Math.max(c.near,q.z),.24,3.4)*(isStar?.78:1.2):c.overview?clamp(c.dist/q.z,.48,1.65):1;
      const radius=s.scope==="wide"&&!s.actualSize?Math.max(physical(S.radii[index]),wideSize*(c.overviewScale??1)*zoom**.37*travelScale):s.scope==="lunar"&&!s.actualSize?Math.max(physical(S.radii[index]),lunarSize):index===c.closeBody?c.focal/Math.sqrt(distanceInRadii**2-1):
        real?physical(S.radii[index]):Math.max(physical(S.radii[index]),enlarged*(s.displayScale??1.8));
      const solidReach=radius*(index===6?2.3:1);
      const reach=index===0&&s.scope==="wide"&&!s.actualSize?radius*1.48:solidReach;
      return {...q,position,index,radius,reach,diam:Math.max(3,solidReach*2)};
    }
    function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
    function labels(p,c,s,disks){
      if(!s.showNames||s.cleanView)return;
      const compact=p.w<550,overview=c.overview||c.orthographic;
      const boxes=[{x:p.x,y:p.y,w:116,h:p.layer==="both"?39:65},{x:p.x,y:p.y+p.h-31,w:116,h:31},{x:p.x+p.w-247,y:p.y+p.h-45,w:247,h:45}];
      const inset=document.getElementById("galaxy-inset");
      if(overview&&inset.offsetWidth)boxes.push({x:inset.offsetLeft-3,y:inset.offsetTop-3,w:inset.offsetWidth+6,h:inset.offsetHeight+6});
      const bodiesInView=disks.filter(q=>q.inFront&&inPanel(p,q));
      const blocked=bodiesInView.filter(q=>!q.note).map(q=>{
        const halfHeight=q.index===0?q.reach:q.radius;
        return {x:q.x-q.reach-3,y:q.y-halfHeight-3,w:q.reach*2+6,h:halfHeight*2+6};
      });
      const selectedId=overview?s.trailBody:s.watch;
      const priority=q=>q.note?(q.note==="age"?-.5:q.note==='small'?-1:-2):q.index===selectedId?100:q.index===hover?99:q.ghost?90:q.index===0?60:q.radius;
      const order=bodiesInView.toSorted?bodiesInView.toSorted((a,b)=>priority(b)-priority(a)):bodiesInView.slice().sort((a,b)=>priority(b)-priority(a));
      for(const q of order){
        if(q.index===c.closeBody)continue;
        const selected=q.index===selectedId,shade=q.note==="age"?"#c2d5df":q.note==='small'?'#c7bba4':q.note==='sky'?'#a1b5c8':selected?"#e9e9e3":q.ghost?mint:"#b3bbbf",special=selected||q.index===hover||q.ghost;
        if(q.note!=="age"&&(!overview||q.note)&&!special&&q.index!==0&&bodiesInView.some(o=>o!==q&&priority(o)>priority(q)&&Math.hypot(q.x-o.x,q.y-o.y)<(q.note?o.reach+6:compact?33:37)))continue;
        const name=q.label??names[q.index],size=q.note?(compact?9:10):compact?10:12;
        ctx.font=(selected?"600 ":"460 ")+size+"px "+font;ctx.textBaseline="middle";
        const width=ctx.measureText(name).width+5,height=size+5;
        const gap=q.reach+(special?12:5);
        const offsets=[[1,-.4],[-1,-.4],[1,.65],[-1,.65],[0,-1],[0,1]];
        let chosen;
        for(const extra of (special||overview?[0,9,18,28,43,60]:[0,10])){
          for(const [dx,dy] of offsets){
            const x=q.x+dx*(gap+extra)+(dx===-1?-width:dx===0?-width/2:0);
            const y=q.y+dy*(q.radius+extra+8)-height/2;
            const box={x,y,w:width,h:height};
            if(x<p.x+4||x+width>p.x+p.w-4||y<p.y+4||y+height>p.y+p.h-4)continue;
            if(boxes.some(o=>overlap(o,box))||blocked.some(o=>overlap(o,box)))continue;
            chosen=box;break;
          }
          if(chosen)break;
        }
        if(!chosen)continue;
        if(special||overview&&Math.hypot(q.x-(chosen.x+width/2),q.y-(chosen.y+height/2))>q.radius+25){
          const tx=clamp(q.x,chosen.x,chosen.x+width),ty=clamp(q.y,chosen.y,chosen.y+height),angle=Math.atan2(ty-q.y,tx-q.x);
          ctx.lineWidth=.68;ctx.strokeStyle=q.ghost?"#93c8ba96":"#b1c3c48c";ctx.beginPath();
          ctx.moveTo(q.x+Math.cos(angle)*(q.radius+1.7),q.y+Math.sin(angle)*(q.radius+1.7));ctx.lineTo(tx,ty);ctx.stroke();
        }
        ctx.shadowColor="#010204";ctx.shadowBlur=3;ctx.fillStyle=shade;ctx.fillText(name,chosen.x+2,chosen.y+height*.5);ctx.shadowBlur=0;
        boxes.push(chosen);
        if(q.target)hits.push({index:q.target,panel:p,box:chosen});
        else if(q.index>0&&q.index<M.COMPANION)hits.push({index:q.index,panel:p,box:chosen});
      }
    }
    function scaleBar(p,c){
      const target=Math.min(67,p.w*.15),desired=target/c.px,exponent=10**Math.floor(Math.log10(desired));
      const unit=([1,2,5].filter(x=>x*exponent<=desired).at(-1)||1)*exponent;
      const x=p.x+15,y=p.y+p.h-14,l=unit*c.px;
      const text=unit<.005?Math.round(unit*M.AU).toLocaleString("ko-KR")+" km":Number(unit.toPrecision(3))+" AU";
      ctx.strokeStyle="#91a1a48a";ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x,y-3);ctx.lineTo(x,y);ctx.lineTo(x+l,y);ctx.lineTo(x+l,y-3);ctx.stroke();
      ctx.font='9px "IBM Plex Mono",monospace';ctx.fillStyle="#b0babc";ctx.textBaseline="bottom";ctx.fillText(text,x,y-5);
    }
    function catalogPoints(p,c,s,testView){
      const catalog=s.catalog;
      const notes=[];
      if(!catalog||s.scope!=="wide"||s.actualSize||s.applied&&testView)return notes;
      const region=catalog.marker?.region,origin=S.world(s,c.run,0,s.day),sun=c.project(origin);
      const screen=v=>c.project(LabFullLayer.galLocation(s,c.run,v,origin));
      const scale=Math.max(.58,Math.min(1.35,(c.overviewScale??1)*zoom**.28));
      ctx.save();ctx.fillStyle=region?'#e7d7b7':'#d8cbb8';
      for(const b of catalog.smallBodies(region||'belt',s.day)){
        if(!b.from||!b.to)continue;
        const v=b.position,q=screen(v);if(!q.inFront||!inPanel(p,q))continue;
        const r=Math.hypot(...v),phase=(1-OrbitFrames.dot(v,c.front)/r)*.5;
        const light=clamp(phase*(2.7/r)**2,.07,1);
        const width=(region?1.55:1.02+.64*light)*scale;
        ctx.globalAlpha=((region?.62:.22)+light*(region?.34:.50))*(c.cruising&&!region?.36:1);
        ctx.fillRect(q.x-width/2,q.y-width/2,width,width);
      }
      ctx.globalAlpha=1;
      for(const b of catalog.smallBodies('named',s.day)){
        if(!b.from||!b.to)continue;
        const q=screen(b.position);if(!q.inFront||!inPanel(p,q,3))continue;
        const radius=(b.id==='ceres'?3.4:2.6)*scale,angle=Math.atan2(sun.y-q.y,sun.x-q.x);
        const dx=Math.cos(angle)*radius,dy=Math.sin(angle)*radius;
        const shade=ctx.createLinearGradient(q.x+dx,q.y+dy,q.x-dx,q.y-dy);
        shade.addColorStop(0,'#efe2c7');shade.addColorStop(.52,'#ad9d89');shade.addColorStop(.76,'#655e57');shade.addColorStop(1,'#25262b');
        ctx.fillStyle=shade;ctx.beginPath();ctx.ellipse(q.x,q.y,radius,radius*(b.id==='ceres'?.94:.79),angle,0,tau);ctx.fill();
        notes.push({...q,radius,reach:radius,index:-4,label:b.label,note:'small',target:{domain:'small',id:b.id}});
      }
      ctx.restore();return notes;
    }
    function catalogMark(p,c,s,run,testView){
      const chosen=s.catalog?.marker;if(!chosen||s.scope!=="wide"||chosen.region||s.applied&&testView)return;
      const source=chosen.orbit;let target,radius=5;
      if(source){
        target=CatalogOrbits.position(source,LabInitial.jd+s.day);if(!target)return;
        if(s.showPaths){const line=CatalogOrbits.curve(source,Math.max(48,Math.hypot(...target)*1.1));curve(c,line.map(v=>LabFullLayer.galLocation(s,run,v)),"rgba(242,195,126,.68)",1.1,[3,4]);}target=LabFullLayer.galLocation(s,run,target);
      }else{const index=bodies.findIndex(b=>b.id===chosen.host);if(index<0)return;target=S.world(s,run,index,s.day);radius=visualBody(index,target,c,p,s).radius+4;}
      const q=c.project(target);if(!q.inFront)return;
      const visible=inPanel(p,q,8),x=clamp(q.x,p.x+9,p.x+p.w-9),y=clamp(q.y,p.y+15,p.y+p.h-15);
      ctx.save();ctx.strokeStyle="#f3ca86";ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.beginPath();ctx.arc(x,y,visible?radius:5,0,tau);ctx.stroke();ctx.setLineDash([]);
      if(source&&visible&&!chosen.parentOnly){ctx.fillStyle="#ffe4b0";ctx.beginPath();ctx.arc(x,y,2.3,0,tau);ctx.fill();}
      const label=chosen.label+(chosen.parentOnly?" · 중심 천체":"")+(visible?"":" · 화면 밖");ctx.font="550 11px "+font;ctx.textBaseline="middle";
      const width=ctx.measureText(label).width,tx=clamp(x+Math.min(radius,45)+8,p.x+4,p.x+p.w-width-5),ty=clamp(y-13,p.y+17,p.y+p.h-19);
      ctx.fillStyle="#0c1119e6";ctx.fillRect(tx-3,ty-8,width+6,16);ctx.fillStyle="#ffdc9f";ctx.fillText(label,tx,ty);ctx.restore();
    }
    function drawPanel({pane:p,camera:c,run,testView},s,skyNotes){
      ctx.save();ctx.beginPath();ctx.rect(p.x,p.y,p.w,p.h);ctx.clip();
      const world=(index)=>S.world(s,run,index,s.day);
      const populations=s.scope==="wide"&&!s.cleanView&&!(s.applied&&testView);
      if(populations&&!c.cruising)LabFullLayer.density(ctx,p,c,s,run);
      const smallNotes=s.cleanView?[]:catalogPoints(p,c,s,testView);
      if(s.showPaths){
        if(s.scope==="lunar")curve(c,timePoints(s,run,M.MOON,s.day-27.32,s.day,144),"rgba(183,197,202,.52)",1.2);
        else if(s.reference==="galaxy")galacticTrails(p,c,s,run,testView);else solarTrails(p,c,s,run);
      }
      const ageNotes=trailAges(p,c,s,run);
      const black=s.applied&&testView&&s.kind==="black",vanished=s.applied&&testView&&s.kind==="vanish";
      const lights={physicalSun:M.read(run,0,s.day),physicalCompanion:M.read(run,M.COMPANION,s.day),primary:!black&&!vanished,secondary:s.applied&&testView&&s.kind==="binary"};
      if(s.scope==="sun"&&s.sunBand==="granules"&&!black&&!vanished){
        solar.granules(ctx,p,zoom,yaw,pitch);
        if(p.layer!=="both"){ctx.fillStyle="#fff";ctx.font="12px sans-serif";ctx.fillText(p.layer==="base"?"원래 태양계":"실험 태양계",p.x+15,p.y+p.h-39);}
        ctx.restore();return;
      }
      const ids=s.scope==="lunar"?[M.EARTH,M.MOON]:run.active;
      const list=ids.map(i=>visualBody(i,world(i),c,p,s)).filter(q=>q.inFront&&inPanel(p,q,-(q.index===0?Math.max(q.reach,3.2*q.radius):q.reach)));
      if(s.scope!=="lunar"&&s.scope!=="near"&&s.scope!=="sun"&&!s.actualSize){
        const earth=list.find(q=>q.index===M.EARTH),moon=list.find(q=>q.index===M.MOON);
        if(earth&&moon){
          const dx=moon.x-earth.x,dy=moon.y-earth.y,gap=Math.hypot(dx,dy);
          const scale=c.overviewScale??1;
          moon.reach=moon.radius=Math.max(1.7*scale,earth.radius*S.radii[M.MOON]/S.radii[M.EARTH]);moon.diam=2*moon.radius;
          const leg=earth.radius+moon.radius+3*scale;
          if(gap<leg){const angle=Math.atan2(dy,dx);moon.x=earth.x+leg*Math.cos(angle);moon.y=earth.y+leg*Math.sin(angle);}
        }
      }
      if(populations&&(!c.cruising||s.cruiseSatellites&&!s.cleanView)){
        LabFullLayer.satellites(ctx,p,c,c.cruising?{...s,showSatellites:true}:s,run,list,hits);
      }
      list.sort((a,b)=>b.z-a.z);
      for(const q of list){
        if(q.index===0&&black){
          q.label="블랙홀";q.radius=s.actualSize||s.scope==="near"||s.scope==="sun"?2.95/GravityLab.AU*q.scale:Math.min(3,q.radius);
          q.reach=q.radius;q.diam=Math.max(3,q.radius*2);
          if(q.radius>.18){ctx.fillStyle="#010102";ctx.beginPath();ctx.arc(q.x,q.y,q.radius,0,tau);ctx.fill();}
        }else if(q.index===0||q.index===M.COMPANION){
          solar.disk(ctx,q,c,s,q.index===M.COMPANION);
          if(q.index===0)hits.push({index:0,panel:p,circle:q});
        }
        else{materials.planet(ctx,q,c,lights,dpr);hits.push({index:q.index,panel:p,circle:q});}
      }
      if(vanished&&s.showNames){
        const o=c.project(S.world(s,run,0,0));if(o.inFront)list.push({...o,index:-2,radius:1,reach:2,diam:3,label:"태양이 있던 자리"});
      }
      if(p.layer==="both"&&s.applied&&s.showPaths){
        const ref=c.project(S.world(s,s.base,s.watch,s.day)),test=c.project(world(s.watch));
        if(ref.inFront&&test.inFront&&Math.hypot(ref.x-test.x,ref.y-test.y)>17&&inPanel(p,ref,4)){
          ctx.beginPath();ctx.arc(ref.x,ref.y,3,0,tau);ctx.strokeStyle=mint;ctx.lineWidth=1;ctx.stroke();
          list.push({...ref,index:-1,diam:6,reach:3,radius:3,label:"원래 "+names[s.watch],ghost:true});
        }
      }
      const notes=s.scope==="wide"?[...ageNotes,...smallNotes,...skyNotes]:[];
      labels(p,c,s,list.concat(notes));if(!s.cleanView){catalogMark(p,c,s,run,testView);if(!S.compressed(s))scaleBar(p,c);}
      if(p.layer!=="both"){
        ctx.font="550 11px "+font;ctx.textBaseline="top";ctx.fillStyle=p.layer==="base"?mint:coral;
        ctx.fillText(p.layer==="base"?"원래 태양계":"실험 태양계",p.x+14,p.y+((p.x===0&&p.y===0)?43:13));
      }
      ctx.restore();
    }
    function galacticExposure(c,s,run,testView){
      if(s.starExposure)return .98;
      const experiment=s.applied&&testView;
      const lights=experiment&&s.kind==="binary"?[0,M.COMPANION]:experiment&&(s.kind==="black"||s.kind==="vanish")?[]:[0];
      let glare=0;
      for(const id of lights){
        const q=c.project(S.world(s,run,id,s.day)),p=c.pane;
        if(!q.inFront)continue;
        const edge=Math.max(Math.abs((q.x-p.x)/p.w-.5),Math.abs((q.y-p.y)/p.h-.5))*2;
        const weight=clamp((1.42-edge)/.62,0,1);
        glare+=weight*weight*(3-2*weight);
      }
      return Math.round(64*(.86/(1+1.05*glare)))/64;
    }
    function draw(s){
      resize();if(!w||!h)return;scope=s.scope;galacticWide=scope==="wide"&&s.reference==="galaxy"&&!s.fixedCamera;
      hits=[];ctx.clearRect(0,0,w,h);
      const range=s.flyby?null:S.systemFrame(s);
      const views=panels(s.split).map(pane=>{
        const testView=pane.layer!=="base",run=s.applied&&testView?s.test:s.base;
        const dark=s.applied&&testView&&(s.kind==="black"||s.kind==="vanish");
        const camera=S.camera(pane,s,run,range,zoom,yaw+(s.scope==="near"?glideOffset:0),pitch,cruiseTime);
        let exposure=camera.surveySky?galacticExposure(camera,s,run,testView):dark?1.05:s.scope==="sun"?.035:s.scope==="near"?.14:s.scope==="lunar"?.25:s.scope==="wide"?.90:.52;
        if(s.flyby&&!dark)exposure*=.43;
        return {pane,run,testView,showSurvey:s.scope==="wide"&&s.allFit,camera,exposure};
      });
      const notes=sky(w,h,dpr,views);views.forEach((view,i)=>drawPanel(view,s,notes[i]||[]));
      if(s.split){
        const q=views[1].pane;ctx.strokeStyle="#61707380";ctx.lineWidth=1;ctx.beginPath();
        if(q.x){ctx.moveTo(q.x,0);ctx.lineTo(q.x,h);}else{ctx.moveTo(0,q.y);ctx.lineTo(w,q.y);}ctx.stroke();
      }
      dirty=false;
    }
    let lastGlide=null;
    function advanceCamera(s,now){
      const cruise=S.cruising(s);
      if((s.scope!=="near"&&!cruise)||!s.glide||gesture){lastGlide=null;return;}
      if(lastGlide===null){lastGlide=now;return;}
      if(now-lastGlide<(cruise?32:50))return;
      const elapsed=Math.min(.16,(now-lastGlide)/1000);
      if(cruise)cruiseTime+=elapsed;
      else{glideTime+=elapsed;glideOffset=.19*Math.sin(glideTime*.044);}
      lastGlide=now;dirty=true;
    }
    function coords(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
    canvas.addEventListener("pointerleave",()=>{if(hover){hover=0;dirty=true;}});
    function hit(p,touch){
      const matches=hits.filter(h=>inPanel(h.panel,p));
      const disks=matches.filter(h=>h.circle).map(h=>({id:h.index,d:Math.hypot(p.x-h.circle.x,p.y-h.circle.y),r:h.circle.diam/2}));
      const nearest=disks.filter(v=>v.d<Math.max(touch?12:7,v.r+(touch?5:2))).sort((a,b)=>a.d-b.d)[0];
      if(nearest)return nearest.id;
      const label=matches.find(h=>h.box&&p.x>=h.box.x&&p.x<=h.box.x+h.box.w&&p.y>=h.box.y&&p.y<=h.box.y+h.box.h);return label?.index??null;
    }
    const gap=()=>{const [a,b]=pointers.values();return Math.hypot(a.x-b.x,a.y-b.y)};
    canvas.addEventListener("pointerdown",e=>{
      if(e.button!==0)return;finishChangeover();const p=coords(e);pointers.set(e.pointerId,p);canvas.setPointerCapture(e.pointerId);
      if(pointers.size===1)gesture={start:p,last:p,moved:false,pinch:false};
      else if(pointers.size===2){gesture.pinch=true;gesture.gap=gap();gesture.zoom=zoom}
    });
    canvas.addEventListener("pointermove",e=>{
      const p=coords(e);
      if(!pointers.has(e.pointerId)){const id=hit(p,false);canvas.classList.toggle("hover",id!==null);if(hover!==id){hover=id;dirty=true;}return}
      pointers.set(e.pointerId,p);
      if(pointers.size===2){zoom=clamp(gesture.zoom*gap()/Math.max(1,gesture.gap),.45,12);change()}
      else if(pointers.size===1&&!gesture.pinch){
        if(Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)>3)gesture.moved=true;
        if(gesture.moved){yaw+=(p.x-gesture.last.x)*(scope==="sun"?5/w:-.006);movePitch((p.y-gesture.last.y)*(scope==="sun"?5/h:.004));canvas.classList.add("drag");change()}
      }
      gesture.last=p;
    });
    function finish(e,cancel){
      if(!pointers.has(e.pointerId))return;
      const p=coords(e);
      if(!cancel&&!gesture.moved&&!gesture.pinch&&Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)<6){
        const id=hit(p,e.pointerType==="touch");if(id!==null||galacticWide)onPick(id);
      }
      pointers.delete(e.pointerId);if(!pointers.size){gesture=null;canvas.classList.remove("drag")}
      if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    }
    canvas.addEventListener("pointerup",e=>finish(e,false));canvas.addEventListener("pointercancel",e=>finish(e,true));canvas.addEventListener("lostpointercapture",e=>finish(e,true));
    canvas.addEventListener("wheel",e=>{e.preventDefault();const d=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?h:1);zoomBy(Math.exp(-clamp(d,-300,300)*.0018))},{passive:false});
    canvas.addEventListener("keydown",e=>{
      if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","-","+","=","Home"].includes(e.key))return;
      e.preventDefault();finishChangeover();
      if(e.key==="ArrowLeft"||e.key==="ArrowRight"){yaw+=e.key==="ArrowLeft"?-.12:.12;change()}
      if(e.key==="ArrowUp"||e.key==="ArrowDown"){movePitch(e.key==="ArrowUp"?.07:-.07);change();}
      if(e.key==="-"||e.key==="+"||e.key==="=")zoomBy(e.key==="-"?.8:1.25);
      if(e.key==="Home")reset();
    });
    function focusSunspot(uv){
      zoom=2.8;
      // Place the observed active region on the optical axis.
      const radius=Math.min(w,h)*.43*zoom;
      yaw=-(uv[0]-.5)*radius/.386595/(w*.2);pitch=-(uv[1]-.5)*radius/.386595/(h*.2);change();
    }
    return {draw,invalidate,advanceCamera,advanceSun:solar.advance,focusSunspot,needsRender:()=>dirty,reset,zoomBy,switchGalacticCamera,fadePreviousView,prepare:materials.prepare};
  }
  globalThis.createLabMap=createMap;
})();
