"""
可扩展的LLM提供商和模型配置
"""
import os
from typing import Dict, Any
from pydantic import BaseModel
from enum import Enum


class LLMProvider(str, Enum):
    """LLM提供商枚举"""
    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    ZHIPU = "zhipu"


class LLMConfig(BaseModel):
    """LLM配置模型"""
    provider: LLMProvider
    name: str # 显示名称
    base_url: str
    api_key: str
    model: str
    max_tokens: int = 4096
    headers: Dict[str, str] = {}
    cost_per_call: float = 0.0  # 单次调用消耗


# 从环境变量读取 (无硬编码默认值)
ZHIPU_KEY = os.getenv("ZHIPU_API_KEY", "")
DEEPSEEK_KEY = os.getenv("DEEPSEEK_API_KEY", "")
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
CLAUDE_KEY = os.getenv("CLAUDE_API_KEY", "")

# 默认LLM配置
DEFAULT_LLM_CONFIGS: Dict[str, LLMConfig] = {
    "default": LLMConfig(
        provider=LLMProvider.ZHIPU,
        name="ZhipuAI GLM-4",
        base_url=os.getenv("ZHIPU_BASE_URL", "https://demo.awa1.fun/v1/messages"),
        api_key=ZHIPU_KEY,
        model=os.getenv("ZHIPU_MODEL", "ZhipuAI/GLM-4.7"),
        max_tokens=204800,
        cost_per_call=0.001,
        headers={
            "anthropic-version": "2023-06-01"
        }
    ),
    "deepseek": LLMConfig(
        provider=LLMProvider.OPENAI,
        name="DeepSeek R1",
        base_url=os.getenv("DEEPSEEK_BASE_URL", "https://ai.zzhdsgsss.xyz/v1/chat/completions"),
        api_key=DEEPSEEK_KEY,
        model=os.getenv("DEEPSEEK_MODEL", "deepseek-ai/DeepSeek-R1-0528-fast"),
        max_tokens=65536,
        cost_per_call=0.01
    ),
    "gemini": LLMConfig(
        provider=LLMProvider.OPENAI,
        name="Gemini 3 Pro",
        base_url=os.getenv("GEMINI_BASE_URL", "https://gyapi.zxiaoruan.cn/v1/chat/completions"),
        api_key=GEMINI_KEY,
        model=os.getenv("GEMINI_MODEL", "gemini-3-pro"),
        max_tokens=4096,
        cost_per_call=1.0
    ),
    "claude": LLMConfig(
        provider=LLMProvider.OPENAI,
        name="Claude Sonnet 4.5",
        base_url=os.getenv("CLAUDE_BASE_URL", "https://gyapi.zxiaoruan.cn/v1/chat/completions"),
        api_key=CLAUDE_KEY,
        model=os.getenv("CLAUDE_MODEL", "claude-sonnet-4-5-20250929"),
        max_tokens=8192,
        cost_per_call=0.5
    ),
}

def get_llm_config(config_name: str = "default") -> LLMConfig:
    """获取LLM配置"""
    if config_name not in DEFAULT_LLM_CONFIGS:
        raise ValueError(f"Unknown LLM config: {config_name}")
    return DEFAULT_LLM_CONFIGS[config_name]


def get_available_models() -> list[dict]:
    """获取所有可用的模型简要信息"""
    return [
        {"key": key, "name": config.name}
        for key, config in DEFAULT_LLM_CONFIGS.items()
    ]
