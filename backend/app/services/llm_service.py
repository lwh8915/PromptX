"""
LLM 服务模块
用于调用大模型 API 进行提示词修改
完全仿照 NovelBot backend/app/api/chat.py 实现
"""
import httpx
import json
from ..core.llm_config import get_llm_config, LLMProvider

async def modify_prompt_with_ai(content: str, suggestion: str, model_key: str = "default") -> str:
    """
    使用 AI 修改提示词
    
    Args:
        content: 原始提示词内容
        suggestion: 用户的修改建议
        model_key: 模型配置键名 (default, deepseek, gemini, claude)
    
    Returns:
        修改后的提示词内容
    """
    try:
        config = get_llm_config(model_key)
    except ValueError:
        config = get_llm_config("default")
    
    # 构造系统提示词 - 强调只输出结果
    system_prompt = """你是一个提示词优化专家。
重要规则：
1. 只输出修改后的提示词本身
2. 不要添加任何解释、分析、思考过程或说明文字
3. 不要使用 markdown 代码块包裹
4. 直接以提示词内容开头"""
    
    # 将系统提示词合并到 User 消息中（仿照 NovelBot）
    user_content = f"""{system_prompt}

---

当前提示词:
{content}

修改要求: {suggestion}

现在直接输出修改后的提示词:"""

    # 构建消息列表（仿照 NovelBot）
    llm_messages = [
        {"role": "user", "content": user_content}
    ]

    # 根据提供商类型设置正确的认证头和请求格式（完全仿照 NovelBot chapters.py）
    if config.provider == LLMProvider.OPENAI:
        # OpenAI兼容API使用Bearer token
        headers = {
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json",
            **config.headers
        }
    else:
        # Anthropic/Zhipu使用x-api-key + anthropic-version (完全仿照 NovelBot)
        headers = {
            "x-api-key": config.api_key,
            "anthropic-version": "2023-06-01",  # 必须！NovelBot 硬编码此值
            "Content-Type": "application/json"
        }
    
    # 判断是否使用流式（ZHIPU/ANTHROPIC 不支持流式，返回 400）
    use_stream = config.provider == LLMProvider.OPENAI
    
    # 使用与提供商一致的格式
    payload = {
        "model": config.model,
        "messages": llm_messages,
        "max_tokens": config.max_tokens,
    }
    
    # 只有 OpenAI 兼容 API 才加 stream 和 temperature
    if use_stream:
        payload["stream"] = True
        payload["temperature"] = 0.7
        payload["top_p"] = 1
    
    print(f"[LLM Service] 调用LLM: {config.base_url}")
    print(f"[LLM Service] Model: {config.model}")
    print(f"[LLM Service] Provider: {config.provider}, Stream: {use_stream}")
    
    full_content = ""
    
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            if use_stream:
                # 流式请求（OpenAI 兼容）
                async with client.stream(
                    "POST",
                    config.base_url,
                    headers=headers,
                    json=payload
                ) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        error_msg = f"API错误: {response.status_code} - {error_text.decode()[:200]}"
                        print(f"[LLM Service] {error_msg}")
                        raise ValueError(error_msg)
                    
                    print(f"[LLM Service] 开始接收流式响应...")
                    
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        
                        if line.startswith("data: "):
                            data_str = line[6:]
                            if data_str.strip() == "[DONE]":
                                break
                            
                            try:
                                data = json.loads(data_str)
                                
                                # OpenAI格式
                                if "choices" in data and len(data["choices"]) > 0:
                                    delta = data["choices"][0].get("delta", {})
                                    # 跳过 reasoning_content (DeepSeek R1)
                                    if "reasoning_content" in delta:
                                        continue
                                    text = delta.get("content", "")
                                    if text:
                                        full_content += text
                                        
                            except json.JSONDecodeError:
                                continue
                    
                    print(f"[LLM Service] 流式响应完成, 总长度: {len(full_content)}")
            else:
                # 非流式请求（ZHIPU/ANTHROPIC）
                response = await client.post(
                    config.base_url,
                    headers=headers,
                    json=payload
                )
                
                if response.status_code != 200:
                    error_msg = f"API错误: {response.status_code} - {response.text[:200]}"
                    print(f"[LLM Service] {error_msg}")
                    raise ValueError(error_msg)
                
                data = response.json()
                print(f"[LLM Service] 非流式响应: {str(data)[:200]}")
                
                # 解析 Anthropic 格式响应
                if "content" in data and isinstance(data["content"], list):
                    for block in data["content"]:
                        if block.get("type") == "text":
                            full_content += block.get("text", "")
                # 解析 OpenAI 格式响应
                elif "choices" in data and len(data["choices"]) > 0:
                    message = data["choices"][0].get("message", {})
                    full_content = message.get("content", "")
                else:
                    print(f"[LLM Service] 未知响应格式: {data}")
                    raise ValueError(f"未知的API响应格式")
                
                print(f"[LLM Service] 非流式响应完成, 总长度: {len(full_content)}")
                
    except httpx.TimeoutException:
        raise ValueError("LLM API 请求超时")
    except httpx.ConnectError as e:
        raise ValueError(f"无法连接到 LLM API: {e}")
    except Exception as e:
        print(f"[LLM Service] 异常: {e}")
        raise
    
    if not full_content:
        raise ValueError("LLM 未返回任何内容")
    
    return full_content.strip()
