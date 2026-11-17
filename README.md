# 태양계 실험실 · Orbit Lab

태양을 없애거나 질량을 바꾸면 지구의 궤도는 어떻게 달라질까요? 태양계의 조건을 바꿔 원래 궤도와 실험 궤도를 비교하는 한국어 웹 시뮬레이션입니다.

**[태양계 실험실 열기](https://chadchad99.github.io/orbit-lab/)** · [기본 관측소 열기](https://chadchad99.github.io/orbit-lab/observatory/)

첫 화면에서 **은하 궤적**이 자동 재생됩니다. 재생 버튼 옆 **배속**에서 0.25배부터 90배까지 조절할 수 있습니다. 1배속은 실제 1초에 시뮬레이션 1일이며, 첫 화면은 3배속입니다. 태양과 여덟 행성이 우리은하 안을 이동한 지난 365일의 자취에 맞춰 시야가 조절됩니다. 관측 시간은 730일을 지나서도 마지막 위치와 속도에서 계속 이어집니다. 태양이나 행성을 선택해 가까이 볼 수 있고, 지구 곁에서는 달도 관찰할 수 있습니다. **코로나** 버튼은 궤도 시계와 독립적으로 태양 가장자리의 관측 영상을 멈추거나 재생합니다. 전체 지도에서는 흑점을 강조하고 코로나의 높이를 2.35배로 표시합니다.

은하 궤적과 전체 지도에서 ESO의 은하수 사진과 히파르코스 별을 같은 하늘 방향에 겹쳐 봅니다. 화성과 목성 사이에는 JPL 목록에서 뽑은 소행성 1,024개의 위치를 날짜에 따라 계산합니다. 세레스나 베스타의 이름을 누르면 궤도를 볼 수 있습니다. **태양계 밖 → 별하늘 → 궁수자리 A***에서 은하 중심의 방향과 EHT가 관측한 전파 고리를 확인할 수 있습니다. [ESO 은하수 사진](https://www.eso.org/public/images/eso0932a/) · [EHT Collaboration 관측](https://www.eso.org/public/images/eso2208-eht-mwa/)

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
