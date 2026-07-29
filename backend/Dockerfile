# 小议议程 - 后端容器镜像（用于微信云托管 CloudBase）
FROM python:3.11-slim

# Whisper 需要 ffmpeg 做音频解码；curl 用于健康检查
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 升级 pip/setuptools/wheel。faster-whisper 及其依赖均为预编译 wheel，
# 不再需要 torch / 源码构建，镜像更小、构建更快、避免 OOM。
RUN pip install --no-cache-dir --upgrade "pip" "setuptools" "wheel"

# 先装依赖，利用 Docker 构建缓存
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 再拷贝业务代码（.dockerignore 已排除 .env / data / 缓存）
COPY . .

# 平台会通过环境变量 PORT 注入端口（config.py 已读取），此处声明用于文档/本地调试
EXPOSE 8000

# 启动 FastAPI（uvicorn 由 main.py 内部调用）
CMD ["python", "main.py"]
