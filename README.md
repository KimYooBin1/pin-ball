# Pin Ball Prank Roulette

물리 기반 핀볼 연출로 당첨자를 뽑는 웹 프로젝트입니다.  
기본 구조는 `Marble Roulette` 스타일의 추첨 사이트를 기반으로 하고 있으며, 현재 프로젝트에는 `PRANK MODE`가 적용되어 있습니다.

## 소개

이 프로젝트는 이름을 입력하면 각 참가자가 공으로 생성되고, 공이 핀볼 맵을 따라 떨어지면서 순위가 결정되는 추첨 사이트입니다.

현재 구현된 주요 특징:

- 전체 화면 Canvas 기반 핀볼 추첨
- Box2D-WASM 물리 엔진 사용
- 여러 개의 핀볼 맵 선택 가능
- 실시간 순위 패널과 미니맵 제공
- 우승 순위 선택 지원
  - 1등
  - 꼴등
  - 직접 입력한 n등
- 자동 녹화 옵션 지원
- 한/영 다국어 지원

## PRANK MODE

이 프로젝트는 장난용 연출이 포함된 버전입니다.

규칙:

- 사이트 좌측 상단에 `PRANK MODE` 배지가 표시됩니다.
- 공지 모달에도 조작 사이트임이 안내됩니다.
- 첫 번째로 입력된 참가자는 우승 대상에서 제외됩니다.
- 제외 대상 공은 게임 도중 자연스럽게 화면 밖으로 배출되는 드레인 연출이 적용됩니다.
- 우승 판정은 전체 공이 아니라, 제외 대상이 빠진 공들만 기준으로 계산됩니다.

즉, 겉보기에는 일반적인 핀볼 추첨처럼 보이지만, 룰 자체는 명시적으로 공개된 프랭크 모드입니다.

## 기술 스택

- TypeScript
- Parcel
- SCSS
- Canvas 2D API
- box2d-wasm
- Workbox

## 프로젝트 구조

```text
.
├── assets/          # 스타일, 이미지, 아이콘, 정적 리소스
├── docs/            # 개발 문서
├── scripts/         # 빌드 보조 스크립트
├── src/
│   ├── data/        # 상수, 맵, 다국어 데이터
│   ├── misc/        # 부가 페이지/데이터
│   ├── types/       # 타입 정의
│   ├── utils/       # 유틸리티
│   ├── marble.ts    # 공 객체와 드레인 연출
│   ├── roulette.ts  # 게임 메인 로직
│   ├── rankRenderer.ts
│   ├── rouletteRenderer.ts
│   └── physics-box2d.ts
├── index.html       # 메인 페이지
└── README.md
```

## 로컬 실행

### 1. 의존성 설치

`npm` 또는 `yarn` 중 편한 쪽을 사용하면 됩니다.

```bash
npm install
```

또는

```bash
yarn
```

### 2. 개발 서버 실행

```bash
npm run dev
```

또는

```bash
yarn dev
```

기본 개발 서버 포트는 `1235`입니다.

## 빌드

```bash
npm run build
```

또는

```bash
yarn build
```

빌드 결과물은 `dist/`에 생성됩니다.

## 배포

GitHub Actions 워크플로가 포함되어 있어 `main` 브랜치에 푸시하면 GitHub Pages 배포를 수행하도록 구성되어 있습니다.

관련 파일:

- `.github/workflows/deploy.yml`

## 문서

추가 분석 문서는 아래 파일에 정리되어 있습니다.

- `docs/pinball-site-dev-doc.md`

## 주의사항

- 현재 프로젝트는 장난용 룰이 포함된 버전입니다.
- 사이트 내에서 `PRANK MODE`를 명시적으로 안내하도록 구성되어 있습니다.
- 원본 기반 구조를 유지하고 있으므로, 브랜딩/문구/배포 경로는 필요에 따라 추가 정리할 수 있습니다.

## 라이선스

기본 저장소 구성은 MIT 라이선스를 따릅니다. 자세한 내용은 `LICENSE` 파일을 확인하세요.
