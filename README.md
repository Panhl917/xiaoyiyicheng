# 小议议程

一个微信小程序 + Python 后端的会议纪要工具，支持**录音上传/实时录音**、**AI 语音转文字**、**智能摘要**、**可编辑思维导图**和**可编辑知识图谱**。

---

## 费用说明（几乎免费）

| 功能 | 方案 | 费用 |
|------|------|------|
| 语音转文字 | 本地 Whisper 模型 | **免费** |
| 摘要/知识提取 | DeepSeek API | **约 ¥0.01-0.03/次** |
| 后端部署 | Render 免费版 | **免费** |
| 小程序 | 微信小程序 | **免费** |

> DeepSeek API 充值 10 元可用非常久（约 ¥1/百万 token）。

---

## 项目结构

```
meeting-mini-app/
├── frontend/          # 微信小程序
│   ├── app.js         # 小程序入口
│   ├── app.json       # 全局配置
│   ├── app.wxss       # 全局样式
│   ├── pages/         # 页面
│   │   ├── index/     # 首页 - 会议列表
│   │   ├── record/    # 录音页
│   │   ├── detail/    # 会议详情
│   │   ├── mindmap/   # 思维导图
│   │   └── knowledge/ # 知识图谱
│   ├── components/    # Canvas 组件
│   └── utils/         # API 工具
├── backend/           # Python 后端
│   ├── main.py        # FastAPI 入口
│   ├── config.py      # 配置
│   ├── routers/       # API 路由
│   ├── services/      # 业务逻辑
│   └── data/          # 数据存储
└── .gitignore
```

---

## 快速开始

### 1. 后端启动

```bash
# 安装依赖
cd backend
pip install -r requirements.txt

# （可选）配置 DeepSeek API Key
# 复制 .env.example 为 .env，填入你的 Key
# 如果不配置，自动使用模拟数据
cp .env.example .env

# 启动后端
python main.py
```

后端启动后访问 http://localhost:8000 看到 `{"status": "running"}` 即成功。

### 2. 获取 DeepSeek API Key（可选）

1. 访问 https://platform.deepseek.com/ 注册
2. 创建 API Key，充值 ¥10 可用很久
3. 填入 `backend/.env` 文件的 `DEEPSEEK_API_KEY`

### 3. 小程序运行

1. 打开 **微信开发者工具**
2. 点击「导入项目」
3. 选择 `meeting-mini-app/frontend` 目录
4. AppID 选择「测试号」或使用你自己的 AppID
5. 点击「编译」即可运行

### 4. 部署到免费云（可选）

推荐使用 Render 免费版部署后端：

1. 在 https://render.com 注册账号
2. 创建 Web Service，连接你的 Git 仓库
3. 选择 `backend/` 作为根目录
4. 启动命令: `python main.py`
5. 部署后获取 HTTPS 地址
6. 修改前端 `app.js` 中的 `apiBaseUrl` 为此地址

---

## 功能使用

### 首页
- 查看所有会议记录列表
- 点击右上角「新建录音」进入录音页
- 点击会议卡片进入详情页

### 录音页
- **实时录音**: 点击麦克风按钮开始录音
- **上传音频**: 切换到上传模式，选择本地音频文件
- 录音/上传后自动处理：转文字 → 生成摘要

### 会议详情页
- 查看和编辑原文稿
- 查看和编辑 AI 生成的摘要
- 编辑关键要点
- 点击按钮生成思维导图/知识图谱

### 思维导图
- **双击节点**: 编辑文字
- **拖拽画布**: 平移视图
- **底部工具栏**: 添加节点、重置视图
- 支持树形层次结构展示

### 知识图谱
- **双击节点**: 编辑节点
- **拖拽节点**: 移动位置
- **从一个节点拖到另一个**: 创建关系连线
- **长按空白处**: 添加新节点
- **底部工具栏**: 添加节点、重排布局
- 节点类型: 人员(红)、主题(蓝)、项目(绿)、时间(橙)、决策(紫)

---

## 技术栈

- **前端**: 微信小程序 (WXML/WXSS/JavaScript) + Canvas 2D
- **后端**: Python FastAPI
- **语音识别**: OpenAI Whisper (本地运行)
- **AI 处理**: DeepSeek API (超廉价)
- **数据存储**: 本地 JSON 文件

---

## 常见问题

**Q: 后端启动后小程序连不上？**
A: 确保小程序开发者工具中开启「不校验合法域名」，并在 `app.js` 中确认 `apiBaseUrl` 为 `http://localhost:8000`。

**Q: 语音转文字失败？**
A: 首次运行需要下载 Whisper 模型文件（约 1.5GB），请确保网络畅通。首次加载可能需要几分钟。

**Q: 不想安装 Whisper？**
A: 不配置 API Key 时，后端会自动使用模拟数据，可正常体验所有功能。
