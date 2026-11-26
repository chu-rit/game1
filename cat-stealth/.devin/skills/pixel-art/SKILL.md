---
name: pixel-art
description: 이 게임용 도트 스프라이트를 코드로 제작 — 픽셀맵 소스 → PNG → assets.js base64 임베드
allowed-tools:
  - read
  - write
  - edit
  - exec
  - grep
  - glob
---

# 픽셀 아트 제작 (cat-stealth)

이 게임의 스프라이트는 두 갈래예요 — 어느 쪽인지 먼저 확인하세요.

## 에셋 경로

| 대상 | 방식 | 위치 |
|------|------|------|
| 맵 타일 (숲 81종·실내·특수) | base64 PNG 임베드 | `js/assets.js` `TILESPR[키]` |
| 고양이 스프라이트 | base64 PNG 임베드 | `js/assets.js` `CATSPR[타입][포즈][방향]` |
| 사람·먹이·이모트·효과 | **코드 절차적 그리기** | `js/assets.js`·`js/view.js`의 `pf()`·`dith()` 계열 |

## 크기 규약

- 타일: **40×40** (특수 타일은 위로 솟은 오브젝트라 40×39~49 높이 허용)
- 고양이 프레임: **64×64** — `CATVIS`가 방향별 visible 기준점을 정해요
- 아이템/픽업: 게임 내 ~0.7배로 그려지는 작은 아이콘

## 제작 절차

1. `tools/px/<name>.js` 픽셀맵 소스 작성 — `w`, `h`, `pal`(문자→#hex, `null`=투명), `rows`(h줄, 각 w글자)
2. 렌더: `node tools/px.js tools/px/<name>.js` → 같은 이름 `.png` 생성
3. **반드시 PNG를 read 도구로 직접 보고** 형태·명암 확인 → 소스 수정 → 반복
4. 확정되면 `node tools/px.js --b64 tools/px/<name>.js` 출력을 `TILESPR`/`CATSPR`에 붙여넣기
5. `index.html`·`editor.html`의 `?v=` 캐시 버전 올리기

## 스타일 규칙 (기존 에셋과 어울리게)

- 외곽선은 어두운 단색(K 계열), 내부는 2~3톤 셰이딩 — 그라데이션 금지
- 광원은 위쪽: 상단 밝게·하단 어둡게
- 바닥 타일은 이음새가 안 보이게 모서리를 단순하게 (span2/block2 타일은 이어지는 면의 무늬 연결)
- 색은 기존 팔레트에서 가져와요 — 숲=짙은 녹갈색 계열, 크림 배경 UI톤과 맞추기
- 1픽셀 디테일이 게임 표시 크기(40px 타일)에서 읽히는지 스크린샷으로 최종 확인

## 팁

- `--view` 옵션은 콘솔에 픽셀맵을 2배 확대 출력 — 빠른 형태 확인용
- 콤마 없는 문자열 rows라 편집이 쉬워요 — 한 줄씩 고치며 확인
- 애니메이션 프레임은 공통 몸통을 변수로 뽑아 rows를 조합해 생성하면 일관성 유지
- 고양이 프레임은 `CATSPR[t][pose][dir]` 키 구조 — pose: idle/idle2/walk1/walk2/eat, dir: 0↑ 1→ 2↓ 3←
