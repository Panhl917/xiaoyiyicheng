"""小议议程 - FastAPI 后端入口"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import APP_NAME, APP_VERSION, HOST, PORT
from routers.recordings import router as recordings_router
from routers.transcribe import router as transcribe_router
from routers.summarize import router as summarize_router
from routers.mindmap import router as mindmap_router
from routers.knowledge import router as knowledge_router

app = FastAPI(title=APP_NAME, version=APP_VERSION)

# CORS - 允许小程序访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(recordings_router)
app.include_router(transcribe_router)
app.include_router(summarize_router)
app.include_router(mindmap_router)
app.include_router(knowledge_router)


@app.get("/")
async def root():
    return {"app": APP_NAME, "version": APP_VERSION, "status": "running"}


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
