# 태양계 실험실 · Orbit Lab

태양을 없애거나 질량을 바꾸면 지구의 궤도는 어떻게 달라질까요? 태양계의 조건을 바꿔 원래 궤도와 실험 궤도를 비교하는 한국어 웹 시뮬레이션입니다.

**[태양계 실험실 열기](https://chadchad99.github.io/orbit-lab/)** · [기본 관측소 열기](https://chadchad99.github.io/orbit-lab/observatory/)

첫 화면은 **은하 궤적 → 동행 비행**입니다. 태양계와 함께 이동하면서 지난 365일의 궤적을 원근감 있게 볼 수 있습니다. 햇빛이 시야에 들어오면 희미한 별이 어두워지고, **보기 설정 → 별빛 강조**를 켜면 은하수 사진이 더 선명해집니다. **화면만 보기**로 조작판과 이름을 숨기거나 **궤도 전경**으로 전체 경로를 한눈에 볼 수 있습니다. 기본 화면은 궤도 간격을 압축하고 천체를 확대합니다. **보기 설정 → 실제 비율**은 거리와 크기에 같은 축척을 사용합니다. [은하 궤적 동행 비행](https://chadchad99.github.io/orbit-lab/#map/galaxy/earth/cruise/play)

재생 버튼 옆 **배속**에서 0.03배부터 90배까지 조절할 수 있습니다. 1배속은 실제 1초에 시뮬레이션 1일이며, 첫 화면은 3배속입니다. 기기에서 동작 줄이기를 선택하면 일시 정지 상태로 시작합니다. [0.03배속으로 태양계 자전 보기](https://chadchad99.github.io/orbit-lab/?rate=0.03#map/galaxy/earth/wide/play)에서 지구의 대륙과 목성의 구름이 각 행성의 항성 자전 주기에 맞춰 돌아가는 모습을 볼 수 있습니다. 관측 시간은 730일을 지나서도 마지막 위치와 속도에서 계속 이어집니다. 태양이나 행성을 선택해 가까이 볼 수 있고, 지구 곁에서는 달도 관찰할 수 있습니다. **코로나** 버튼은 궤도 시계와 독립적으로 태양 가장자리의 관측 영상을 멈추거나 재생합니다. 궤도 전경에서는 흑점을 강조하고 코로나의 높이를 2.35배로 표시합니다.

[토성 고리 가까이 보기](https://chadchad99.github.io/orbit-lab/#map/galaxy/saturn/near/play)에서 0.03배속으로 안쪽과 바깥쪽 고리의 공전을 비교할 수 있습니다. 고리 위 네 구간의 명암은 입자의 움직임을 드러내기 위해 강조한 예시입니다.

은하 궤적에서는 Gaia DR2를 바탕으로 만든 NASA/SVS의 8,192 × 4,096 은하 지도를 카메라 방향에 맞춰 투영합니다. 먼 은하수 배경 위에 히파르코스 별을 밝기와 색에 따라 따로 그립니다. 태양 기준 지도와 우주 비행에서는 ESO의 은하수 사진을 사용합니다. 히파르코스 별 25,723개 중 측정값이 있는 25,713개에는 고유운동을 적용하고, 행성 곁에서는 거리가 알려진 별의 시차도 반영합니다. 화성과 목성 사이에는 JPL 목록에서 뽑은 소행성 1,024개의 위치를 날짜에 따라 계산합니다. 세레스나 베스타의 이름을 누르면 궤도를 볼 수 있습니다. **태양계 밖 → 별하늘 → 궁수자리 A***에서 은하 중심의 방향과 EHT가 관측한 전파 고리를 확인할 수 있습니다. [NASA/SVS · ESA/Gaia/DPAC 별 지도](https://svs.gsfc.nasa.gov/4851/) · [ESO 은하수 사진](https://www.eso.org/public/images/eso0932a/) · [EHT Collaboration 관측](https://www.eso.org/public/images/eso2208-eht-mwa/)

**다른 항성계**에서 [트라피스트-1](https://chadchad99.github.io/orbit-lab/#system/trappist-1), [케플러-90](https://chadchad99.github.io/orbit-lab/#system/kepler-90), [케플러-16](https://chadchad99.github.io/orbit-lab/#system/kepler-16)을 열 수 있습니다. 세 계 모두 은하 궤적으로 열립니다. 고유운동·시선속도와 태양의 은하 운동을 합쳐 최근 수일에서 수개월의 궤적을 계산합니다. **항성 기준**으로 바꾸면 같은 행성의 공전을 비교할 수 있습니다. 행성 이름을 누르면 확대할 때에만 고해상도 지형·구름 자료를 읽습니다. [트라피스트-1e의 가상 바다와 구름](https://chadchad99.github.io/orbit-lab/#system/trappist-1/e), [케플러-90h의 구름띠](https://chadchad99.github.io/orbit-lab/#system/kepler-90/h), [케플러-16b에서 본 두 별](https://chadchad99.github.io/orbit-lab/#system/kepler-16/b/sky)을 바로 열 수 있습니다. 행성 표면과 항성 활동은 상상도입니다. 별하늘의 방향과 겉보기 밝기는 각 항성계에서 거리가 알려진 히파르코스 별을 바라보는 기준입니다. 항성계와 주변 별의 상대 운동, 행성 곁에서의 시차를 재생 시각에 적용합니다. 전체 지도에서는 **카메라 선회**, [행성 곁에서는 자전 따라보기](https://chadchad99.github.io/orbit-lab/#system/trappist-1/e/spin)로 시점을 바꿀 수 있습니다. **모형과 관측 자료**에서 궤도 근사와 출처를 확인할 수 있습니다. [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/)

**블랙홀이 있는 항성계**도 같은 메뉴에서 열 수 있습니다. [가이아 BH1의 은하 궤적](https://chadchad99.github.io/orbit-lab/#system/gaia-bh1)에서 태양형 동반별이 약 185일에 한 번 공전하며 지구 쪽으로 다가오고 멀어지는 속도를 볼 수 있습니다. [백조자리 X-1의 블랙홀](https://chadchad99.github.io/orbit-lab/#system/cygnus-x1/BH)을 확대하면 청색 초거성의 항성풍이 공급하는 강착원반이 보입니다. 궤도는 관측에서 구한 두 천체의 질량과 궤도 요소로 계산합니다. 확대 화면의 원반은 구대칭 중력장을 통과하는 빛의 경로에 가시색을 입힌 모형이며, 가이아 BH1의 점선 기호는 블랙홀의 추정 위치를 표시합니다. [가이아 BH1의 궤도 연구](https://doi.org/10.1088/1538-3873/ad1ba7) · [백조자리 X-1의 궤도 연구](https://doi.org/10.1126/science.abb3363)

[A2 인쇄용 은하 궤적 이미지](https://github.com/chadchad99/orbit-lab/releases/download/downloads-2026-11-17/orbit-print-A2-600ppi.png)를 내려받을 수 있습니다.

## 내 컴퓨터에서 실행하기

저장소를 내려받고 저장소 폴더에서 다음 명령을 실행한 뒤 브라우저에서 `http://localhost:8000/`을 엽니다.

```sh
python3 -m http.server 8000 --directory docs
```

실험실을 인터넷 없이 열 수 있는 HTML 파일로 만들려면 다음 명령을 실행합니다. 저장소 폴더에 `태양계 실험실.html`이 생깁니다. 이 파일의 기본 관측소 링크는 온라인 관측소로 연결됩니다.

```sh
python3 scripts/pack-offline.py
```

## 배포와 관측 자료

GitHub Pages는 `main` 브랜치의 `docs/` 폴더를 배포합니다. 실험실의 시작 파일은 `docs/index.html`, 기본 관측소의 시작 파일은 `docs/observatory/index.html`입니다.

초기 위치와 속도는 NASA/JPL Horizons 자료를, 태양 표면과 코로나는 NASA/SDO 관측 자료를 사용합니다. 이미지별 출처와 가공 내역은 실험실의 **실험 안내 → 자료와 이미지 출처**에서 확인할 수 있습니다. [관측 이미지별 출처 파일](docs/assets/space/) · [글꼴 라이선스](docs/assets/fonts/)

전체 지도 오른쪽 위의 **천체 찾기**에서 행성·왜행성·고리, 자연위성, 소행성·혜성, 인공위성을 찾을 수 있습니다. 2026년 11월 17일에 수집한 JPL 소천체 1,585,109개와 자연위성 955개(별도 후보 38개), CelesTrak SATCAT 인공 물체 71,323개의 스냅샷입니다. 인공 물체에는 발사체와 잔해, 과거 기록도 포함됩니다. 각 화면에 궤도의 기준일과 자료 출처가 표시됩니다. 검색 색인과 궤도 자료는 필요할 때 나눠 읽습니다. [NASA/JPL](https://ssd.jpl.nasa.gov/) · [CelesTrak](https://celestrak.org/satcat/) · [GCAT](https://planet4589.org/space/gcat/)


**전부 맞춤**은 JPL 소행성·혜성 1,585,109개를 모두 집계한 공간 분포의 외곽까지 담습니다. 위성계의 점은 2026년 11월 16일 기준으로 위치가 수록된 자연위성 480개와 인공 물체 31,972개입니다. 각 위성계의 위치 자료 수와 전체 목록 수는 **천체 찾기**에서 확인할 수 있습니다. [JPL 위성](https://ssd.jpl.nasa.gov/sats/) · [CelesTrak 궤도 요소](https://celestrak.org/NORAD/elements/)

**태양계 밖**에서 히파르코스 별 25,723개, 태양 10파섹 이내의 별, 우리은하 속 태양계 위치, 이웃 은하의 측정 운동, 2MRS 은하 44,599개의 전천 분포를 살펴볼 수 있습니다. 이웃 은하 24개 중 22개에는 3차원 속도를, M32와 M110에는 측정한 시선속도를 표시합니다. 우리은하 정면도는 ESA/Gaia/DPAC 관측을 재구성한 Stefan Payne-Wardenaar의 작품입니다. [ESA](https://www.esa.int/media/the-best-milky-way-map-by-gaia) · [Hipparcos](https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/hipparcos.html) · [2MRS](https://heasarc.gsfc.nasa.gov/W3Browse/catalog/twomassrsc.html)
