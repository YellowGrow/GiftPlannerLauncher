# 림버스 플랜 실행기 (Electron App)

림버스 컴퍼니 거울 던전 플랜을 오버레이로 표시하는 데스크톱 앱입니다.

## 기능

- 🎯 저장된 플랜 실행 및 표시
- 🔍 투명도 조절 (게임 위에 오버레이로 표시)
- 📌 항상 맨 위 고정
- 📋 클립보드에서 플랜 붙여넣기
- 💾 로컬 플랜 저장

## 설치 및 실행

### 개발 모드

```bash
# 의존성 설치
npm install

# 개발 모드 실행
npm start
```

### 빌드

```bash
# Windows 빌드
npm run build:win

# macOS 빌드
npm run build:mac

# Linux 빌드
npm run build:linux

# 모든 플랫폼 빌드
npm run build
```

빌드된 파일은 `dist/` 폴더에 생성됩니다.

## 사용 방법

### 웹에서 플랜 가져오기

1. 웹 사이트(LimbusGiftPlanner)에서 플랜을 저장
2. "실행" 버튼 클릭
3. Electron 앱이 자동으로 열리며 플랜 표시

### 수동으로 플랜 추가

1. 웹에서 플랜 데이터를 클립보드에 복사
2. 앱에서 "붙여넣기" 버튼 클릭

## 아이콘 추가

`assets/` 폴더에 아이콘 파일을 추가해주세요:

- `icon.png` - 256x256 PNG (Linux/일반용)
- `icon.ico` - Windows용 아이콘
- `icon.icns` - macOS용 아이콘

## 라이선스

MIT License
