from .auth import router as auth_router
from .categories import router as categories_router
from .prompts import router as prompts_router

# 导出所有路由
auth = type('AuthModule', (), {'router': auth_router})()
categories = type('CategoriesModule', (), {'router': categories_router})()
prompts = type('PromptsModule', (), {'router': prompts_router})()
