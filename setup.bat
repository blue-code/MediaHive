@echo off
echo Setting up MediaHive...

echo [1/3] Installing Node.js dependencies...
call npm install

echo [2/3] Installing Python dependencies for Kokoro TTS...
pip install kokoro-onnx soundfile

if not exist "public_library" mkdir "public_library"
if not exist "scripts" mkdir "scripts"

echo.
echo [3/3] IMPORTANT: Manual Download Required
echo Please download the following files and place them in the project root:
echo 1. kokoro-v0_19.onnx
echo 2. voices.bin (Korean support version)
echo.
echo Setup complete.
pause