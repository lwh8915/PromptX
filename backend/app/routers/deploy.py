from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, status
from pydantic import BaseModel
from app.services.auth import get_current_user
import docker
import os
import logging

router = APIRouter(tags=["Deploy"])

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
        
        # Docker Hub 认证配置 (从环境变量读取)
        docker_username = os.getenv("DOCKER_HUB_USERNAME", "lwh2460731039")
        docker_password = os.getenv("DOCKER_HUB_PASSWORD", "")
        
        # 登录 Docker Hub (如果提供了密码)
        if docker_password:
            logger.info("正在登录 Docker Hub...")
            try:
                client.login(username=docker_username, password=docker_password)
                logger.info("Docker Hub 登录成功")
            except Exception as e:
                logger.warning(f"Docker Hub 登录失败: {e}，尝试继续推送...")
        
        auth_config = {"username": docker_username, "password": docker_password} if docker_password else None
        
        # 项目根目录（通过 docker-compose 挂载的 /workspace）
        workspace_path = "/workspace"
        
        # 1. 构建后端镜像
        logger.info("正在构建后端镜像...")
        backend_image, _ = client.images.build(
            path=os.path.join(workspace_path, "backend"),  # 上下文为 backend 目录
            dockerfile="Dockerfile",  # 相对于 path
            tag="lwh2460731039/promptx-backend:latest",
            rm=True
        )
        logger.info("后端镜像构建成功")
        
        # 2. 推送后端镜像
        logger.info("正在推送后端镜像...")
        pushed_layers = 0
        for line in client.images.push("lwh2460731039/promptx-backend:latest", stream=True, decode=True, auth_config=auth_config):
            if "error" in line:
                raise Exception(f"推送失败: {line['error']}")
            status = line.get("status", "")
            # 只记录完成状态
            if status in ["Pushed", "Layer already exists"]:
                pushed_layers += 1
                logger.info(f"  后端层 {pushed_layers}: {status}")
        logger.info(f"后端镜像推送成功 (共 {pushed_layers} 层)")
        
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
        pushed_layers = 0
        for line in client.images.push("lwh2460731039/promptx-frontend:latest", stream=True, decode=True, auth_config=auth_config):
            if "error" in line:
                raise Exception(f"推送失败: {line['error']}")
            status = line.get("status", "")
            # 只记录完成状态
            if status in ["Pushed", "Layer already exists"]:
                pushed_layers += 1
                logger.info(f"  前端层 {pushed_layers}: {status}")
        logger.info(f"前端镜像推送成功 (共 {pushed_layers} 层)")
        
        # 5. 触发 Webhook (如果我们有配置)
        if webhook_url:
            logger.info(f"正在触发 Webhook: {webhook_url}")
            import requests # 需确保安装 requests，或使用 httpx
            
            # 如果是调用 /trigger-update 端点，发送 deploy_key
            deploy_key = os.getenv("DEPLOY_API_KEY", "")
            
            try:
                # 发送 JSON body 包含 deploy_key
                resp = requests.post(
                    webhook_url, 
                    json={"deploy_key": deploy_key},
                    headers={"Content-Type": "application/json"},
                    timeout=30
                )
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


class TriggerUpdateRequest(BaseModel):
    """触发更新请求 (供部署服务器接收)"""
    deploy_key: str  # 部署密钥 (必需)


@router.post("/trigger-update", response_model=DeployResponse)
async def trigger_update(request: TriggerUpdateRequest):
    """
    触发 Watchtower 更新 (部署服务器端点)
    
    此端点供开发机在推送镜像后调用，部署服务器后端会在内网调用 Watchtower
    使用 deploy_key 验证，不需要用户登录
    
    流程:
    1. 开发机推送镜像到 Docker Hub
    2. 开发机调用部署服务器的 /api/deploy/trigger-update (带 deploy_key)
    3. 部署服务器后端在内网调用 Watchtower (http://watchtower:8080/v1/update)
    """
    import httpx
    from fastapi import HTTPException
    
    # 验证部署密钥
    expected_key = os.getenv("DEPLOY_API_KEY", "")
    if request.deploy_key != expected_key:
        logger.warning("❌ 部署密钥验证失败")
        raise HTTPException(status_code=403, detail="无效的部署密钥")
    
    # 从环境变量读取 Watchtower 配置 (内网地址)
    watchtower_url = os.getenv("WATCHTOWER_URL", "http://watchtower:8080/v1/update")
    watchtower_token = os.getenv("WATCHTOWER_TOKEN", "")
    
    logger.info(f"正在触发内网 Watchtower 更新: {watchtower_url}")
    
    try:
        headers = {}
        if watchtower_token:
            headers["Authorization"] = f"Bearer {watchtower_token}"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(watchtower_url, headers=headers)
            
            if resp.status_code == 200:
                logger.info("✅ Watchtower 更新触发成功！")
                return DeployResponse(
                    message="Watchtower 更新已触发，容器正在拉取最新镜像...",
                    status="success"
                )
            else:
                logger.warning(f"⚠️ Watchtower 返回: {resp.status_code} - {resp.text}")
                return DeployResponse(
                    message=f"Watchtower 返回状态码: {resp.status_code}",
                    status="warning"
                )
                
    except Exception as e:
        logger.error(f"❌ 触发 Watchtower 失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Watchtower 调用失败: {str(e)}"
        )
