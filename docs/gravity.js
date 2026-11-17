(() => {
  "use strict";
  const {bodies}=LabInitial;
  const AU=149597870.7, SECONDS=86400, DAYS=730;
  const GM_UNIT=SECONDS**2/AU**3;
  const N=bodies.length+1, STRIDE=N*6;
  const EARTH=bodies.findIndex(b=>b.id==="earth"), MOON=bodies.findIndex(b=>b.id==="moon"), COMPANION=bodies.length;
  const scenarios={
    vanish:{name:"태양 소멸",tag:"태양의 질량을 0으로",action:"태양 없애기",note:"태양이 사라져도 행성은 그 순간의 속도를 유지합니다. 행성끼리의 중력은 계속 작용합니다."},
    binary:{name:"두 번째 태양",tag:"동반성 추가",action:"두 번째 태양 추가",note:"태양에서 6 AU 떨어진 곳에 동반성을 추가합니다. 두 별과 행성은 서로의 중력을 받습니다.",slider:"동반성 질량",unit:"태양 질량",min:.25,max:1.5,step:.25,initial:.75},
    boost:{name:"지구 가속",tag:"공전 속도 변경",action:"지구 가속하기",note:"지구가 움직이던 방향으로 속도를 높입니다. 얼마나 빨라져야 태양을 벗어날까요?",slider:"지구의 초기 속력",unit:"기존 속력",min:1,max:1.8,step:.05,initial:1.5},
    mass:{name:"태양 질량 조절",tag:"중력의 세기 변경",action:"태양 질량 바꾸기",note:"행성들의 위치와 속도를 유지한 채 태양의 질량만 바꿉니다. 궤도의 모양을 비교해 보세요.",slider:"태양의 새 질량",unit:"기존 질량",min:.25,max:2,step:.25,initial:.5},
    black:{name:"블랙홀로 교체",tag:"태양과 같은 질량",action:"블랙홀로 교체하기",note:"태양 자리에 질량이 같은 블랙홀을 놓습니다. 멀리 도는 행성들의 두 경로를 겹쳐 보세요."}
  };
  const clamp=(x,lo,hi)=>Math.max(lo,Math.min(x,hi));

  function initialState(kind,value) {
    const mu=new Float64Array(N);
    const state=new Float64Array(STRIDE);
    bodies.forEach((b,i)=>{
      mu[i]=b.gm*GM_UNIT;
      state.set(b.p,i*6);
      state.set(b.v,i*6+3);
    });
    if(kind==="vanish")mu[0]=0;
    if(kind==="mass")mu[0]*=value;
    if(kind==="boost"){
      for(let k=3;k<6;k++)state[EARTH*6+k]=state[k]+(state[EARTH*6+k]-state[k])*value;
    }
    if(kind==="binary"){
      const radius=6, angle=7*Math.PI/6;
      mu[COMPANION]=mu[0]*value;
      // Nominal circular relative speed of the two stars at their initial separation.
      const speed=Math.sqrt((mu[0]+mu[COMPANION])/radius);
      state.set([radius*Math.cos(angle),radius*Math.sin(angle),0,-speed*Math.sin(angle),speed*Math.cos(angle),0],COMPANION*6);
    }
    return {mu,state};
  }

  function accelerations(state,mu,active,out) {
    out.fill(0);
    for(let a=0;a<active.length;a++){
      const i=active[a], pos=i*6, force=i*3;
      for(let b=a+1;b<active.length;b++){
        const j=active[b], other=j*6, pair=j*3;
        const dx=state[other]-state[pos],dy=state[other+1]-state[pos+1],dz=state[other+2]-state[pos+2];
        const r2=dx*dx+dy*dy+dz*dz;
        const invR3=1/(r2*Math.sqrt(r2));
        const ai=mu[j]*invR3,aj=mu[i]*invR3;
        out[force]+=dx*ai;out[force+1]+=dy*ai;out[force+2]+=dz*ai;
        out[pair]-=dx*aj;out[pair+1]-=dy*aj;out[pair+2]-=dz*aj;
      }
    }
  }

  // Kick–drift–kick leapfrog. Daily output samples are independent of animation speed.
  function solve(kind="control",value=1,days=DAYS,substeps=16,direction=1,seed=null) {
    const {mu,state}=initialState(kind,value);
    if(seed)state.set(seed);
    const active=Array.from(mu.keys()).filter(i=>mu[i]>0);
    const frames=new Float64Array((days+1)*STRIDE);
    const acc=new Float64Array(N*3);
    const h=direction/substeps, half=h/2;
    frames.set(state);
    accelerations(state,mu,active,acc);
    for(let day=1;day<=days;day++){
      for(let step=0;step<substeps;step++){
        for(const i of active){
          for(let k=0;k<3;k++){
            const p=i*6+k, v=p+3;
            state[v]+=acc[i*3+k]*half;
            state[p]+=state[v]*h;
          }
        }
        accelerations(state,mu,active,acc);
        for(const i of active){
          for(let k=0;k<3;k++)state[i*6+3+k]+=acc[i*3+k]*half;
        }
      }
      frames.set(state,day*STRIDE);
    }
    return {kind,value,mu,active,frames,days,direction};
  }

  // Keep the original 730-day experiment plus a rolling 1,024-day window. A sparse
  // state checkpoint permits older time-slider values to be reconstructed continuously.
  const BLOCK=32;
  function extension(run,idx){
    run.segments??=new Map();run.checkpoints??=new Map([[0,run.frames.slice(-STRIDE)]]);
    if(run.segments.has(idx))return run.segments.get(idx);
    let first=idx,seed;
    while(!seed){if(run.checkpoints.has(first))seed=run.checkpoints.get(first);else if(run.segments.has(first-1))seed=run.segments.get(first-1).slice(-STRIDE);else first--;}
    let frames;
    for(let n=first;n<=idx;n++){
      frames=solve(run.kind,run.value,BLOCK,16,1,seed).frames;seed=frames.slice(-STRIDE);run.segments.set(n,frames);
      if((n+1)%32===0)run.checkpoints.set(n+1,seed);
      if(run.segments.size>36)run.segments.delete(run.segments.keys().next().value);
    }
    return frames;
  }
  // Cubic Hermite interpolation preserves both the positions and velocities at each stored day.
  function read(run,body,day,out=new Float64Array(6)) {
    const sign=run.direction??1;
    let t=clamp(day*sign,0,run.days),frame=run.frames;
    if(sign>0&&day>run.days){const after=day-run.days,idx=Math.floor(after/BLOCK);frame=extension(run,idx);t=after-idx*BLOCK;}
    const whole=Math.floor(t),f=t-whole,a=whole*STRIDE+body*6;
    if(f===0){for(let k=0;k<6;k++)out[k]=frame[a+k];return out}
    const b=a+STRIDE, f2=f*f, f3=f2*f;
    for(let k=0;k<3;k++){
      const p0=frame[a+k],p1=frame[b+k],v0=sign*frame[a+k+3],v1=sign*frame[b+k+3];
      out[k]=(2*f3-3*f2+1)*p0+(f3-2*f2+f)*v0+(-2*f3+3*f2)*p1+(f3-f2)*v1;
      out[k+3]=sign*((6*f2-6*f)*p0+(3*f2-4*f+1)*v0+(-6*f2+6*f)*p1+(3*f2-2*f)*v1);
    }
    return out;
  }
  function distance(a,b) {return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])}
  function speed(state) {return Math.hypot(state[3],state[4],state[5])*AU/SECONDS}

  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm=v=>v.map(n=>n/Math.hypot(...v));
  function initialEllipse(index) {
    const b=bodies[index],p=b.p,v=b.v,mu=(bodies[0].gm+b.gm)*GM_UNIT;
    const h=cross(p,v),r=Math.hypot(...p);
    const eccentric=cross(v,h).map((x,k)=>x/mu-p[k]/r);
    const e=Math.hypot(...eccentric),xaxis=norm(eccentric),yaxis=cross(norm(h),xaxis);
    const latus=h.reduce((sum,c)=>sum+c*c,0)/mu;
    return Array.from({length:241},(_,i)=>{
      const theta=i*Math.PI/120,co=Math.cos(theta),si=Math.sin(theta);
      const radius=latus/(1+e*co);
      return xaxis.map((x,k)=>radius*(co*x+si*yaxis[k]));
    });
  }
  globalThis.GravityLab=Object.freeze({solve,read,distance,speed,initialEllipse,scenarios,AU,SECONDS,DAYS,N,STRIDE,EARTH,MOON,COMPANION});
})();
