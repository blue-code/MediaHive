import sys
import argparse
import io
import wave
from kokoro_onnx import Kokoro
import soundfile as sf

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    parser.add_argument("--voice", default="ko_1")
    parser.add_argument("--model", default="kokoro-v0_19.onnx")
    parser.add_argument("--voices", default="voices.bin")
    args = parser.parse_args()

    try:
        # 모델 로드 (루트 폴더에 파일이 있어야 함)
        kokoro = Kokoro(args.model, args.voices)
        
        # 음성 생성
        samples, sample_rate = kokoro.create(
            args.text, 
            voice=args.voice, 
            speed=1.0, 
            lang="ko"
        )

        # 메모리 버퍼에 WAV 형식으로 저장
        buffer = io.BytesIO()
        sf.write(buffer, samples, sample_rate, format='WAV', subtype='PCM_16')
        
        # stdout으로 바이너리 데이터 출력
        sys.stdout.buffer.write(buffer.getvalue())
        sys.stdout.buffer.flush()

    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
