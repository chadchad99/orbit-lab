// Geometric heliocentric states, J2000 ecliptic. Positions in AU and velocities in AU/day.
// NASA/JPL Horizons DE441, targets 1–8, center 500@10. https://ssd-api.jpl.nasa.gov/doc/horizons.html
// DE440 GM in km³/s². Earth and Moon are separate; Mars and the outer giants use system GM.
// https://ssd.jpl.nasa.gov/astro_par.html
globalThis.LabInitial = {
  epoch: "2026-11-16",
  jd: 2461360.5,
  bodies: [
    {
      id: "sun", name: "태양", gm: 132712440041.27942,
      p: [0, 0, 0],
      v: [0, 0, 0]
    },
    {
      id: "mercury", name: "수성", gm: 22031.868551,
      p: [-0.1202483724974545, 0.2915861289934463, 0.03485837260570145],
      v: [-0.0316621707746715, -0.009676052616378068, 0.002113166229874615]
    },
    {
      id: "venus", name: "금성", gm: 324858.592,
      p: [0.2816895822905657, 0.6638940382368845, -0.007129681905025417],
      v: [-0.01868535961581674, 0.007807064953619504, 0.001185431608700232]
    },
    {
      id: "earth", name: "지구", gm: 403503.235625,
      p: [0.5916057593238063, 0.7926381477326159, -5.264719226721207e-05],
      v: [-0.01406707127122412, 0.01022567667970944, -5.681906339090664e-07]
    },
    {
      id: "mars", name: "화성", gm: 42828.375816,
      p: [-0.4839102245868017, 1.534726433764579, 0.04402764430895717],
      v: [-0.01281628852570848, -0.003019168760634874, 0.000250978588986387]
    },
    {
      id: "jupiter", name: "목성", gm: 126712764.1,
      p: [-3.748688173824737, 3.776574699495412, 0.06818408246328465],
      v: [-0.005447951796186429, -0.004968485112981039, 0.0001425334715304627]
    },
    {
      id: "saturn", name: "토성", gm: 37940584.8418,
      p: [9.193376334051754, 2.017433798690458, -0.4010877969030141],
      v: [-0.00150483589803893, 0.005434749359393365, -3.476088413404677e-05]
    },
    {
      id: "uranus", name: "천왕성", gm: 5794556.4,
      p: [8.768054409315186, 17.34236712053137, -0.04927924127318251],
      v: [-0.003544745703919309, 0.001588628272571266, 5.1882336785723e-05]
    },
    {
      id: "neptune", name: "해왕성", gm: 6836527.10058,
      p: [29.82934510079952, 1.525116416407856, -0.7188179496466199],
      v: [-0.0001862864115768503, 0.003150774164395904, -6.06590994243275e-05]
    }
  ]
};

// Split the Horizons Earth-Moon barycentre using the simultaneous geocentric 301 vector.
// Earth and Moon then receive independent accelerations in every experiment.
{
  const bodies=LabInitial.bodies,earth=bodies.find(body=>body.id==="earth");
  const moon={id:"moon",name:"달",gm:4902.800118};
  const relative={"p":[0.001612961766284849,-0.00215421091215328,-7.30155051653313e-05],"v":[0.0004373572704191297,0.0003477266525075235,4.726186366134889e-05]};
  const fraction=moon.gm/earth.gm;
  earth.gm=398600.435507;
  for(const k of ["p","v"]){
    earth[k]=earth[k].map((x,i)=>x-fraction*relative[k][i]);
    moon[k]=earth[k].map((x,i)=>x+relative[k][i]);
  }
  bodies.push(moon);
}
