"""小议议程 - 配置文件"""
import os
from dotenv import load_dotenv

load_dotenv()

# DeepSeek API 配置（超廉价，约¥1/百万token）
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
DEEPSEEK_MODEL = "deepseek-chat"

# Whisper 模型配置（本地运行，免费）
# 可选: tiny, base, small, medium, large
# tiny最快但准确率最低, medium平衡, large最准但需要更多内存
# 容器内默认 base：medium/large 在 1~2G 内存环境下极易 Segmentation fault
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")

# 数据存储路径
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
AUDIO_DIR = os.path.join(DATA_DIR, "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)

# 服务器配置（云托管/容器环境通过环境变量 PORT 注入，默认 8000）
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))

# 应用配置
APP_NAME = "小议议程"
APP_VERSION = "1.0.0"
