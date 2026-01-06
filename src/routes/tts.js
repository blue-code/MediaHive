const express = require("express");
const { spawn } = require("child_process");
const path = require("path");

const router = express.Router();

/**
 * Kokoro TTS 음성 생성 API
 */
router.post("/generate", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ message: "text is required" });

  // scripts/kokoro_bridge.py 를 실행하여 음성 생성
  const bridgeScript = path.join(__dirname, "..", "..", "scripts", "kokoro_bridge.py");
  
  // 윈도우 환경에서는 python 또는 py 명령어를 사용합니다.
  const pythonCmd = process.platform === "win32" ? "python" : "python3";

  const ttsProcess = spawn(pythonCmd, [
    bridgeScript,
    "--text", text,
    "--voice", "af_heart" // 한국어 ko_1 대신 검증된 기본 음성 사용
  ]);

  res.setHeader("Content-Type", "audio/wav");

  // 파이썬 스크립트의 stdout(WAV 데이터)을 브라우저로 직접 파이핑
  ttsProcess.stdout.pipe(res);

  ttsProcess.stderr.on("data", (data) => {
    console.error(`Kokoro Debug: ${data}`);
  });

  ttsProcess.on("error", (err) => {
    console.error("Kokoro bridge error:", err);
    if (!res.headersSent) {
      res.status(500).json({ 
        message: "TTS 엔진(Kokoro) 실행 실패. Python 환경과 모델 파일을 확인하세요.",
        error: err.message 
      });
    }
  });
});

module.exports = router;
