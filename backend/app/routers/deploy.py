from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, status
from pydantic import BaseModel
from app.services.auth import get_current_user
import docker
import os
import logging

router = APIRouter(prefix="/deploy", tags=["Deploy"])

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DeployResponse(BaseModel):
    message: str
    status: str

def run_deploy_task(webhook_url: str | None = None, webhook_token: str | None = None):
    """后台执行部署任务"""
    try:
        logger.info("开始执行一键发布任务...")
        
        # 连接到宿主机 Docker
        client = docker.from_env()
        
        # 项目根目录（通过 docker-compose 挂载的 /workspace）
        workspace_path = "/workspace"
        
        # 1. 构建后端镜像
        logger.info("正在构建后端镜像...")
        backend_image, _ = client.images.build(
            path=workspace_path,
            dockerfile="backend/Dockerfile",
            tag="lwh2460731039/promptx-backend:latest",
            rm=True
        )
        logger.info("后端镜像构建成功")
        
        # 2. 推送后端镜像
        logger.info("正在推送后端镜像...")
        client.images.push("lwh2460731039/promptx-backend:latest")
        logger.info("后端镜像推送成功")
        
        # 3. 构建前端镜像
        logger.info("正在构建前端镜像...")
        frontend_image, _ = client.images.build(
            path=os.path.join(workspace_path, "frontend"), # 前端上下文通常在 frontend 目录
            dockerfile="Dockerfile", # 相对于 path
            tag="lwh2460731039/promptx-frontend:latest",
            rm=True
        )
        logger.info("前端镜像构建成功")
        
        # 4. 推送前端镜像
        logger.info("正在推送前端镜像...")
        client.images.push("lwh2460731039/promptx-frontend:latest")
        logger.info("前端镜像推送成功")
        
        # 5. 触发 Webhook (如果我们有配置)
        if webhook_url:
            logger.info(f"正在触发 Webhook: {webhook_url}")
            import requests # 需确保安装 requests，或使用 httpx
            headers = {}
            if webhook_token:
                headers["Authorization"] = f"Bearer {webhook_token}"
            
            try:
                # Watchtower HTTP API 只需要简单的 GET/POST
                resp = requests.post(webhook_url, headers=headers, timeout=10)
                if resp.status_code == 200:
                    logger.info("✅ Webhook 触发成功，服务器正在更新...")
                else:
                    logger.warning(f"⚠️ Webhook 返回状态码: {resp.status_code}, 内容: {resp.text}")
            except Exception as we:
                logger.error(f"❌ Webhook 触发失败: {str(we)}")
        
        logger.info("✅ 一键发布任务全部完成！")
        
    except Exception as e:
        logger.error(f"❌ 部署任务失败: {str(e)}")
        # 这里可以添加发送邮件通知等逻辑

class DeployRequest(BaseModel):
    webhook_url: str | None = None
    webhook_token: str | None = None

@router.post("", response_model=DeployResponse)
async def trigger_deploy(
    request: DeployRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    触发一键发布流程
    - webhook_url: 可选，部署完成后调用的 URL (例如 Watchtower API)
    - webhook_token: 可选，Webhook 鉴权 Token
    """
    
    # 这里可以添加更严格的权限控制，例如只允许管理员
    # if current_user.get("role") != "admin": ...
    
    background_tasks.add_task(
        run_deploy_task, 
        webhook_url=request.webhook_url, 
        webhook_token=request.webhook_token
    )
    
    return DeployResponse(
        message="部署任务已在后台启动，请留意 Docker Hub 更新及 Webhook 触发状态。",
        status="processing"
    )
