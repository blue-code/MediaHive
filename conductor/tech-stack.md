# 기술 스택 (Tech Stack)

## 백엔드 (Backend)
- **런타임:** Node.js
- **프레임워크:** Express.js
- **언어:** JavaScript (CommonJS)
- **인증:** JWT (JSON Web Tokens)
- **보안:** PBKDF2 패스워드 해싱 (Node.js 내장 crypto)

## 프론트엔드 (Frontend)
- **방식:** 서버 측 정적 파일 서빙 (Vanilla JS/HTML/CSS)
- **UI 라이브러리:** 없음 (기본 웹 표준 활용)

## 데이터 스토리지 (Data Storage)
- **메타데이터:** 로컬 JSON 파일 기반 (NoSQL 스타일)
- **미디어 파일:** 로컬 파일 시스템 직접 액세스

## 미디어 처리 서비스 (Media Processing)
- **비디오 트랜스코딩:** `ffmpeg` (Thumbnail generation, iOS friendly stream)
- **압축 해제:** 외부 바이너리 활용 (`unzip`, `7z`, `bsdtar`, `unrar` 등)

## 개발 및 운영 (DevOps & Tools)
- **설정 관리:** `dotenv` (.env 활용)
- **로깅:** `morgan` (HTTP request logger)
- **파일 업로드:** `multer`
- **테스트:** `jest`, `supertest`
