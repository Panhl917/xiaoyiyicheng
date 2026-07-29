# 小议议程 - 后端容器镜像（用于微信云托管 CloudBase）
FROM python:3.11-slim

# Whisper 需要 ffmpeg 做音频解码；curl 用于健康检查
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先固定 setuptools<81：81 起删除了 pkg_resources，而 openai-whisper 的
# setup.py 依赖它，构建隔离环境会装到最新版导致构建失败。
# 用 --no-build-isolation 让 whisper 复用下面这个版本的 setuptools 来构建。
RUN pip install --no-cache-dir --upgrade "pip" "setuptools==80.9.0" "wheel"

# 先装依赖，利用 Docker 构建缓存
COPY requirements.txt .
RUN pip install --no-cache-dir --no-build-isolation -r requirements.txt

# 再拷贝业务代码（.dockerignore 已排除 .env / data / 缓存）
COPY . .

# 平台会通过环境变量 PORT 注入端口（config.py 已读取），此处声明用于文档/本地调试
EXPOSE 8000

# 启动 FastAPI（uvicorn 由 main.py 内部调用）
CMD ["python", "main.py"]
