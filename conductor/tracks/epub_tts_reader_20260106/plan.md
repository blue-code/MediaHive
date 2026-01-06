# Implementation Plan: 로그인 없는 EPUB 브라우징 및 TTS 지원 고급 리더 구현

## Phase 1: 비로그인 브라우징 및 EPUB 뷰어 기초 구현
- [x] Task: 공개 라이브러리 API 엔드포인트 구현 (Backend) 3af0f20
    - [ ] Sub-task: Write Tests for Public Library API (GET /api/public/library)
    - [ ] Sub-task: Implement Controller logic to list files from configured public dir
- [ ] Task: 공개 라이브러리 UI 구현 (Frontend)
    - [ ] Sub-task: Create Public Library Grid/List View Component
    - [ ] Sub-task: Integrate with Backend API
- [ ] Task: EPUB 뷰어 기본 기능 구현
    - [ ] Sub-task: Integrate ePub.js library
    - [ ] Sub-task: Create Reader Component with basic navigation (Prev/Next, TOC)
- [ ] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: 서버 측 TTS 엔진 연동
- [ ] Task: TTS 서비스 모듈 구현 (Backend)
    - [ ] Sub-task: Setup/Dockerize TTS Engine (Piper or Sherpa-ONNX)
    - [ ] Sub-task: Implement Service to request audio generation from text
    - [ ] Sub-task: Create API Endpoint (POST /api/tts/generate)
- [ ] Task: 뷰어-TTS 연동 (Frontend)
    - [ ] Sub-task: Extract text from current EPUB page/chapter
    - [ ] Sub-task: Send text to API and play received audio stream
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: 고급 리딩 경험 (하이라이팅 및 자동 넘김)
- [ ] Task: 텍스트-오디오 동기화 로직 구현
    - [ ] Sub-task: Implement mapping between audio timestamp and text position (if supported by TTS) or sentence-by-sentence playback strategy
- [ ] Task: UI 하이라이팅 및 자동 스크롤 구현
    - [ ] Sub-task: Apply CSS styling to active sentence
    - [ ] Sub-task: Implement auto-scroll/page-turn logic when active sentence changes
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)
