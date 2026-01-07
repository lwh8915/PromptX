# 定义变量
$DOCKER_ID = "lwh2460731039"
$VERSION = "latest"

Write-Host "正在为 Docker Hub 打标签..."
docker tag promptx-backend:$VERSION $DOCKER_ID/promptx-backend:$VERSION
docker tag promptx-frontend:$VERSION $DOCKER_ID/promptx-frontend:$VERSION

Write-Host "正在推送 promptx-backend 到 Docker Hub..."
docker push $DOCKER_ID/promptx-backend:$VERSION

Write-Host "正在推送 promptx-frontend 到 Docker Hub..."
docker push $DOCKER_ID/promptx-frontend:$VERSION

Write-Host "✅ 推送完成！"
