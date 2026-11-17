# 태양계 실험실 · Orbit Lab

태양을 없애거나 질량을 바꾸면 지구의 궤도는 어떻게 달라질까요? 태양계의 조건을 바꾸고, 원래 궤도와 실험 궤도를 730일 동안 비교하는 한국어 웹 시뮬레이션입니다.

**[태양계 실험실 열기](https://9m4m47wtyc-cpu.github.io/orbit-lab/)** · [기본 관측소 열기](https://9m4m47wtyc-cpu.github.io/orbit-lab/observatory/)

첫 화면은 전체 궤도 지도입니다. 태양이나 행성을 선택해 가까이 볼 수 있고, 지구 곁에서는 달도 관찰할 수 있습니다. **코로나** 버튼은 궤도 시계와 독립적으로 태양 가장자리의 관측 영상을 멈추거나 재생합니다. 전체 지도에서는 흑점을 강조하고 코로나의 높이를 2.35배로 표시합니다.

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
