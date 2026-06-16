FROM python:3.12-slim

WORKDIR /app

# language-tool-python requires a JRE
RUN apt-get update \
    && apt-get install -y --no-install-recommends default-jre-headless \
    && rm -rf /var/lib/apt/lists/*

# Piper TTS (offline, CPU, no API key) for Explore narration — /tts endpoint.
# Self-contained release tarball (binary + onnxruntime/espeak libs) extracts to
# /opt/piper. Voice: en_GB-jenny_dioco-medium (clear UK female). LD_LIBRARY_PATH
# is set per-subprocess in main.py, not globally, to avoid clashing with Python.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && mkdir -p /opt/piper/voices \
    && curl -fsSL https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz -o /tmp/piper.tar.gz \
    && tar -xzf /tmp/piper.tar.gz -C /opt \
    && rm /tmp/piper.tar.gz \
    && curl -fsSL https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/jenny_dioco/medium/en_GB-jenny_dioco-medium.onnx -o /opt/piper/voices/en_GB-jenny_dioco-medium.onnx \
    && curl -fsSL https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/jenny_dioco/medium/en_GB-jenny_dioco-medium.onnx.json -o /opt/piper/voices/en_GB-jenny_dioco-medium.onnx.json \
    && apt-get purge -y curl \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Fall back to 8000 if PORT not set.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
