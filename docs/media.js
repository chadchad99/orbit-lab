(() => {
  "use strict";
  const imageCredits=[
    ["태양","NASA/GSFC/SDO/AIA · 파장 17.1 nm의 극자외선을 금색으로 표현","https://sdo.gsfc.nasa.gov/assets/img/browse/2026/09/12/20260912_000722_1024_0171.jpg"],
    ["수성","NASA, Johns Hopkins University APL, Carnegie Institution of Washington","https://science.nasa.gov/photojournal/mercury-globe-0n-180e/"],
    ["금성","NASA/JPL-Caltech · 영상 처리 Kevin M. Gill","https://science.nasa.gov/photojournal/venus-from-mariner-10/"],
    ["지구","NASA/GSFC · Reto Stöckli, Robert Simmon · Blue Marble 합성 영상","https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/"],
    ["화성","NASA/JPL/USGS","https://science.nasa.gov/photojournal/global-color-views-of-mars/"],
    ["목성","NASA/JPL/University of Arizona","https://science.nasa.gov/photojournal/pj-high-resolution-globe-of-jupiter/"],
    ["토성","NASA/ESA/E. Karkoschka (University of Arizona)","https://science.nasa.gov/image-detail/hubble-saturn-visible-light/"],
    ["천왕성","NASA/JPL-Caltech","https://science.nasa.gov/photojournal/uranus-as-seen-by-nasas-voyager-2/"],
    ["해왕성","NASA/JPL · 보이저 2호 영상, 색 대비 강조","https://science.nasa.gov/photojournal/neptune-full-disk-view/"],
    ["블랙홀 시각화","NASA’s Goddard Space Flight Center/Jeremy Schnittman · 메뉴 이미지","https://svs.gsfc.nasa.gov/14146/"]
  ];
  const file=path=>globalThis.LabPacked?.[path]||path;
  globalThis.LabMedia={file,image:id=>file("assets/"+id+".webp"),credits:imageCredits};
})();
