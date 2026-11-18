// Local camera paths in units of the target's equatorial radius.
globalThis.OrbitFlyby=(()=>{
  "use strict";
  const {dot,cross,norm,comb}=OrbitFrames;
  const {clamp,subtract,radii,world}=OrbitMapSpace,M=GravityLab;
  const shots=[
    {body:6,title:"토성의 고리",duration:21,closest:3.55,reach:3.15,phase:1.38,latitude:.39,roll:-.27},
    {body:3,title:"지구의 낮과 밤",duration:20,closest:1.64,reach:1.93,phase:1.42,latitude:.15,roll:.19},
    {body:M.MOON,title:"달 너머의 지구",duration:19,closest:1.52,reach:2.00,roll:-.19},
    {body:5,title:"목성의 구름띠",duration:20,closest:1.78,reach:1.95,phase:1.39,latitude:-.12,roll:-.12}
  ];
  function tangent(v,pole){
    const flat=comb(v,pole,1,-dot(v,pole));
    return Math.hypot(...flat)>1e-6?norm(flat):norm(cross(pole,Math.abs(pole[0])<.8?[1,0,0]:[0,1,0]));
  }
  function pose(p,s,run){
    const {shot,progress,yaw,pitch}=s.flyby,id=shot.body;
    const center=world(s,run,id,s.day),sun=norm(subtract(world(s,run,0,s.day),center));
    const pole=OrbitFrames.frames[id].slice(3,6);
    const pass=progress*2-1,along=shot.reach*pass,range=Math.hypot(shot.closest,along);
    const swing=Math.atan2(along,shot.closest);
    let front,right,up;
    if(id===M.MOON){
      // Put the real Earth just above the lunar limb. Its direction and
      // apparent size come from the same ephemeris as the rest of the map.
      const earth=norm(subtract(world(s,run,M.EARTH,s.day),center)),side=tangent(sun,earth);
      const az=.38*swing+yaw,across=comb(side,cross(earth,side),Math.cos(az),Math.sin(az));
      const limb=Math.asin(1/range)+.092+.035*pass+pitch;
      front=norm(comb(earth,across,-Math.cos(limb),Math.sin(limb)));
      up=tangent(earth,front);right=norm(cross(up,front));
    }else{
      const noon=tangent(sun,pole),east=cross(pole,noon),az=shot.phase+.92*swing+yaw;
      const sign=id===6&&dot(sun,pole)<0?-1:1;
      const latitude=sign*(shot.latitude+.10*pass)+pitch;
      const horizon=comb(noon,east,Math.cos(az),Math.sin(az));
      front=norm(comb(horizon,pole,Math.cos(latitude),Math.sin(latitude)));
      right=norm(cross(pole,front));up=cross(front,right);
    }
    const bank=shot.roll+.055*swing;
    right=comb(right,up,Math.cos(bank),Math.sin(bank));up=cross(front,right);
    const narrow=p.w<p.h;
    const focal=Math.min(p.h*(id===M.MOON?.79:.94),p.w*(narrow?.78:1.02));
    const lunarCenter=.35+focal/(p.h*Math.sqrt(range*range-1));
    const principal=[(narrow?.50:.57)-pass*(narrow?.025:.075),id===M.MOON?lunarCenter:id===6?.48:.52+.07*(1-pass*pass)];
    return {center,front,right,up,focal,principal,dist:range*radii[id]/M.AU};
  }

  function create(map,onOpen,onClose){
    const get=id=>document.getElementById(id);
    const dialog=get("flyby-view"),windowButton=get("flyby-window"),controls=get("flyby-controls");
    const title=get("flyby-title"),altitude=get("flyby-altitude"),status=get("flyby-status"),play=get("flyby-play");
    const frameInterval=1000/30;
    const reduced=matchMedia("(prefers-reduced-motion: reduce)");
    let index=0,seconds=0,day=0,yaw=0,pitch=0,playing=false,cut=false,last=null,nextFrame=0,reported=-Infinity;
    let idle,drag=null,skipClick=false,unavailableSince=null;
    function showControls(show){
      clearTimeout(idle);dialog.classList.toggle("hud-hidden",!show);controls.inert=!show;
      windowButton.setAttribute("aria-label",show?"조작 숨기기":"조작 표시");
      if(show&&playing&&!reduced.matches){
        idle=setTimeout(()=>{
          if(!dialog.open||cut||controls.contains(document.activeElement)&&document.activeElement.matches(":focus-visible"))return;
          if(controls.contains(document.activeElement))windowButton.focus({preventScroll:true});
          showControls(false);
        },4600);
      }
    }
    function setPlaying(value){
      playing=value;last=null;
      play.setAttribute("aria-label",value?"탐사 비행 일시 정지":"탐사 비행 재생");
      play.querySelector("use").setAttribute("href",value?"#i-pause":"#i-play");showControls(true);
    }
    function select(next){
      index=(next+shots.length)%shots.length;seconds=yaw=pitch=0;last=null;reported=-Infinity;
      cut=true;unavailableSince=null;title.textContent=shots[index].title;altitude.textContent="";status.textContent="";
      map.prepare(shots[index].body);map.invalidate();
    }
    function open(epoch){
      if(dialog.open)return;
      onOpen();day=epoch;nextFrame=0;select(0);
      dialog.showModal();windowButton.focus({preventScroll:true});setPlaying(!reduced.matches);
    }
    function render(now,base){
      const shot=shots[index];
      if(cut){
        const ready=map.prepare(shot.body);
        if(ready!=="ready"){
          const failed=ready==="unavailable";
          const message=failed?"관측 이미지를 열 수 없습니다. 다음 천체를 선택해 주세요.":"관측 이미지 불러오는 중";
          if(status.textContent!==message)status.textContent=message;
          if(failed&&unavailableSince===null){unavailableSince=now;showControls(true);}
          if(playing&&unavailableSince!==null&&now-unavailableSince>5000)select(index+1);
          last=null;return;
        }
        map.fadePreviousView(650);cut=false;status.textContent="";
        if(!dialog.classList.contains("hud-hidden"))showControls(true);
        map.prepare(shots[(index+1)%shots.length].body);
      }
      const dt=last===null?0:Math.max(0,Math.min(.25,(now-last)/1000));last=now;
      if(playing){seconds+=dt;day+=dt*.03;}
      if(seconds>=shot.duration){select(index+1);return;}
      if(!map.needsRender()&&(!playing||now+1<nextFrame))return;
      const flyby={shot,progress:seconds/shot.duration,yaw,pitch};
      map.draw({...base,flyby,day,watch:shot.body,scope:"near",reference:"galaxy",fixedCamera:false,
        split:false,actualSize:true,cleanView:true,showPaths:false,showNames:false,allFit:false});
      if(now+1>=nextFrame)nextFrame=(now-nextFrame<frameInterval?nextFrame:now)+frameInterval;
      if(now-reported>220){
        const range=Math.hypot(shot.closest,shot.reach*(2*flyby.progress-1));
        altitude.textContent=Math.round((range-1)*radii[shot.body]).toLocaleString("ko-KR")+" km";
        reported=now;
      }
    }
    function close(){if(dialog.open)dialog.close();}
    dialog.addEventListener("close",()=>{if(!dialog.open){clearTimeout(idle);last=null;drag=null;skipClick=false;onClose();}});
    get("flyby-exit").onclick=close;
    get("flyby-prev").onclick=()=>{select(index-1);showControls(true);};
    get("flyby-next").onclick=()=>{select(index+1);showControls(true);};
    play.onclick=()=>setPlaying(!playing);
    windowButton.onclick=()=>{if(skipClick){skipClick=false;return;}showControls(dialog.classList.contains("hud-hidden"));};
    windowButton.addEventListener("pointerdown",e=>{
      if(!e.isPrimary||e.button!==0)return;
      skipClick=false;drag={id:e.pointerId,x:e.clientX,y:e.clientY,yaw,pitch};
      windowButton.setPointerCapture(e.pointerId);
    });
    windowButton.addEventListener("pointermove",e=>{
      if(!drag||e.pointerId!==drag.id)return;
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(Math.hypot(dx,dy)<5&&!skipClick)return;
      skipClick=true;yaw=clamp(drag.yaw-dx*.0035,-.7,.7);pitch=clamp(drag.pitch+dy*.0025,-.26,.26);map.invalidate();
    });
    windowButton.addEventListener("lostpointercapture",()=>{drag=null;});
    dialog.addEventListener("pointermove",e=>{
      if(e.pointerType==="mouse"&&!drag&&playing)showControls(true);
    });
    dialog.addEventListener("keydown",e=>{
      if(e.key==="Escape")return;
      if(e.key==="Tab"&&dialog.classList.contains("hud-hidden"))showControls(true);
      if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();select(index+(e.key==="ArrowRight"?1:-1));showControls(true);}
      if(e.code==="Space"&&e.target===windowButton){e.preventDefault();if(!e.repeat)setPlaying(!playing);}
      e.stopPropagation();
    });
    document.addEventListener("visibilitychange",()=>{last=null;});
    reduced.addEventListener("change",e=>{if(e.matches&&dialog.open)setPlaying(false);});
    return {open,close,render,get active(){return dialog.open;}};
  }
  return {pose,create};
})();
