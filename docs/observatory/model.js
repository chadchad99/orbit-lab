(() => {
  "use strict";

  // NASA/JPL Solar System Dynamics, Approximate Positions, Table 1 (J2000).
  // Each pair lists a, e, I, L, longitude of perihelion and longitude of node,
  // followed by their rates per Julian century.
  const elements = {
    mercury: [[.38709927,.20563593,7.00497902,252.25032350,77.45779628,48.33076593],[.00000037,.00001906,-.00594749,149472.67411175,.16047689,-.12534081]],
    venus:   [[.72333566,.00677672,3.39467605,181.97909950,131.60246718,76.67984255],[.00000390,-.00004107,-.00078890,58517.81538729,.00268329,-.27769418]],
    earth:   [[1.00000261,.01671123,-.00001531,100.46457166,102.93768193,0],[.00000562,-.00004392,-.01294668,35999.37244981,.32327364,0]],
    mars:    [[1.52371034,.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891],[.00001847,.00007882,-.00813131,19140.30268499,.44441088,-.29257343]],
    jupiter: [[5.20288700,.04838624,1.30439695,34.39644051,14.72847983,100.47390909],[-.00011607,-.00013253,-.00183714,3034.74612775,.21252668,.20469106]],
    saturn:  [[9.53667594,.05386179,2.48599187,49.95424423,92.59887831,113.66242448],[-.00125060,-.00050991,.00193609,1222.49362201,-.41897216,-.28867794]],
    uranus:  [[19.18916464,.04725744,.77263783,313.23810451,170.95427630,74.01692503],[-.00196176,-.00004397,-.00242939,428.48202785,.40805281,.04240589]],
    neptune: [[30.06992276,.00859048,1.77004347,-55.12002969,44.96476227,131.78422574],[.00026291,.00005105,.00035372,218.45945325,-.32241464,-.00508664]]
  };
  const bodies = [
    {id:"sun", name:"태양", en:"Sun", type:"항성", color:"#ffb94f", note:"중심부에서 수소가 헬륨으로 융합하며 빛과 열을 냅니다. 그 중력이 여덟 행성을 궤도에 붙잡아 둡니다.", extra:"태양은 기체와 플라스마로 이루어져 위도마다 자전 속도가 다릅니다. 적도에서는 약 25일, 극에서는 약 36일 만에 한 바퀴 돕니다.", url:"https://science.nasa.gov/sun/facts/"},
    {id:"mercury", name:"수성", en:"Mercury", type:"지구형 행성", color:"#c9b8a6", radius:2439.4, year:.2408467, spin:58.6462, note:"태양에서 가장 가까운 행성입니다. 표면에는 오래전 충돌로 생긴 크레이터가 빽빽합니다.", extra:"두 번 공전하는 동안 세 번 자전합니다. 수성에서 해가 한 번 뜬 뒤 다시 뜨기까지는 지구 시간으로 약 176일이 걸립니다.", url:"https://science.nasa.gov/mercury/facts/"},
    {id:"venus", name:"금성", en:"Venus", type:"지구형 행성", color:"#e2bb7f", radius:6051.8, year:.61519726, spin:-243.018, note:"두꺼운 이산화탄소 대기가 열을 가두어 태양계 행성 중 표면이 가장 뜨겁습니다.", extra:"대부분의 행성과 반대 방향으로 천천히 자전합니다. 별을 기준으로 한 번 자전하는 데 걸리는 시간이 공전 주기보다 깁니다.", url:"https://science.nasa.gov/venus/venus-facts/"},
    {id:"earth", name:"지구", en:"Earth", type:"지구형 행성", color:"#78b6ed", radius:6371.0084, year:1.0000174, spin:.99726968, note:"표면의 약 71%를 바다가 덮고 있습니다. 푸른 바다 위로 흰 구름이 대기의 흐름을 드러냅니다.", extra:"자전축이 공전 궤도면의 수직 방향에서 약 23.4° 기울어져 있습니다. 공전하는 동안 위도별로 받는 햇빛의 양이 달라져 계절이 바뀝니다.", url:"https://science.nasa.gov/earth/facts/"},
    {id:"mars", name:"화성", en:"Mars", type:"지구형 행성", color:"#e08f72", radius:3389.5, year:1.8808476, spin:1.02595676, note:"표면의 암석과 먼지에 섞인 철이 산화하면서 붉은빛을 냅니다. 극지에는 얼음이 남아 있습니다.", extra:"위성 포보스와 데이모스가 화성 주위를 돕니다. 화성은 지구보다 조금 더 긴 시간에 한 번 자전하지만, 한 해는 지구의 거의 두 배입니다.", url:"https://science.nasa.gov/mars/facts/"},
    {id:"jupiter", name:"목성", en:"Jupiter", type:"가스 거대 행성", color:"#d4b194", radius:69911, year:11.862615, spin:.41354, note:"태양계에서 가장 큰 행성입니다. 줄무늬 구름 사이로 거대한 폭풍인 대적점이 소용돌이칩니다.", extra:"밝은 구름 띠와 어두운 구름 띠에서는 바람이 서로 다른 방향으로 붑니다. 이 거대한 행성은 약 10시간 만에 한 바퀴 자전합니다.", url:"https://science.nasa.gov/jupiter/jupiter-facts/"},
    {id:"saturn", name:"토성", en:"Saturn", type:"가스 거대 행성", color:"#ddc68f", radius:58232, year:29.447498, spin:.44401, note:"얼음과 암석 조각이 토성을 돌며 넓고 얇은 고리를 이룹니다. 고리 사이에는 뚜렷한 틈이 보입니다.", extra:"고리 안쪽의 입자는 바깥쪽 입자보다 빨리 공전합니다. 같은 원리로 태양에 가까운 행성도 먼 행성보다 짧은 주기로 태양을 돕니다.", url:"https://science.nasa.gov/saturn/facts/"},
    {id:"uranus", name:"천왕성", en:"Uranus", type:"얼음 거대 행성", color:"#8dd4de", radius:25362, year:84.016846, spin:-.71833, note:"자전축이 약 98° 기울어져 있어 옆으로 누운 듯 자전합니다. 대기 속 메테인은 붉은빛을 흡수합니다.", extra:"공전 궤도를 한 바퀴 도는 데 지구 시간으로 약 84년이 걸립니다. 크게 기울어진 자전축 때문에 극지방의 낮과 밤은 수십 년 동안 이어집니다.", url:"https://science.nasa.gov/uranus/facts/"},
    {id:"neptune", name:"해왕성", en:"Neptune", type:"얼음 거대 행성", color:"#81a5ee", radius:24622, year:164.79132, spin:.67125, note:"여덟 행성 중 태양에서 가장 멀리 있습니다. 차갑고 푸른 대기에서는 매우 빠른 바람이 붑니다.", extra:"천왕성 궤도에서 관측된 작은 어긋남을 바탕으로 위치를 예측한 뒤, 1846년 망원경으로 발견했습니다. 태양을 한 바퀴 도는 데 약 165년이 걸립니다.", url:"https://science.nasa.gov/neptune/neptune-facts/"}
  ];
  const RAD = Math.PI / 180;
  const DAY = 86400000;
  const MIN = Date.UTC(1800, 0, 1);
  const MAX = Date.UTC(2050, 11, 31, 23, 59, 59, 999);
  const AU_KM = 149597870.7;

  // Browser dates are UTC. UTC is used as an approximation of TDB for this map.
  function orbitAt(id, time) {
    const centuries = (time / DAY + 2440587.5 - 2451545) / 36525;
    const [base, rates] = elements[id];
    const [a,e,i,L,peri,node] = base.map((v,k) => v + rates[k] * centuries);
    const w = (peri - node) * RAD;
    const cosW = Math.cos(w), sinW = Math.sin(w);
    const cosN = Math.cos(node * RAD), sinN = Math.sin(node * RAD);
    const cosI = Math.cos(i * RAD), sinI = Math.sin(i * RAD);
    const u = [cosW*cosN - sinW*sinN*cosI, cosW*sinN + sinW*cosN*cosI, sinW*sinI];
    const v = [-sinW*cosN - cosW*sinN*cosI, -sinW*sinN + cosW*cosN*cosI, cosW*sinI];
    const mean = Math.atan2(Math.sin((L-peri)*RAD),Math.cos((L-peri)*RAD));
    let anomaly = mean;
    for (let k=0;k<12;k++) {
      const correction = (anomaly - e*Math.sin(anomaly) - mean)/(1-e*Math.cos(anomaly));
      anomaly -= correction;
      if (Math.abs(correction) < 1e-12) break;
    }
    return {a,e,i,u,v,minor:a*Math.sqrt(1-e*e),anomaly};
  }

  function point(orbit, anomaly = orbit.anomaly) {
    const x = orbit.a * (Math.cos(anomaly)-orbit.e);
    const y = orbit.minor * Math.sin(anomaly);
    return orbit.u.map((axis,k) => axis*x + orbit.v[k]*y);
  }

  function periodText(body) {
    return body.year < 2 ? (body.year*365.25).toFixed(2) + "일" : body.year.toFixed(2) + "년";
  }
  function spinText(body) {
    const days = Math.abs(body.spin);
    const minutes = Math.round(days*1440);
    const value = days >= 2 ? days.toFixed(2)+"일" : Math.floor(minutes/60)+"시간 "+(minutes%60)+"분";
    return body.spin < 0 ? value+" · 역행" : value;
  }
  globalThis.OrbitModel = Object.freeze({bodies,orbitAt,point,periodText,spinText,DAY,MIN,MAX,AU_KM});
})();
