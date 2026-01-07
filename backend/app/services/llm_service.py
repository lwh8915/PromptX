"""
LLM 服务模块
用于调用大模型 API 进行提示词修改
参考 NovelBot backend/app/api/chat.py 实现
"""
import httpx
import json
from ..config import get_settings


async def modify_prompt_with_ai(content: str, suggestion: str) -> str:
    """
    使用 AI 修改提示词
    
    Args:
        content: 原始提示词内容
        suggestion: 用户的修改建议
    
    Returns:
        修改后的提示词内容
    """
    settings = get_settings()
    
    if not settings.llm_base_url or not settings.llm_api_key:
        raise ValueError("LLM API 未配置，请设置 LLM_BASE_URL 和 LLM_API_KEY 环境变量")
    
    # 构造系统提示词
    system_prompt = """你是一个专业的提示词优化专家。你的任务是根据用户的修改建议，对给定的提示词进行优化。
请直接输出优化后的提示词内容，不要添加任何解释或说明。"""
    
    # 仿照 NovelBot 逻辑：将系统提示词合并到 User 消息中，不使用 System Role
    user_content = f"""{system_prompt}

---

用户问题：
当前提示词:
{content}

请按照以下建议修改提示词:
{suggestion}

请直接输出修改后的完整提示词内容:"""

    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json"
    }
    
    # 获取 max_tokens
    max_tokens = 4096
    if hasattr(settings, 'llm_max_tokens') and settings.llm_max_tokens:
        max_tokens = settings.llm_max_tokens

    payload = {
        "model": settings.llm_model,
        "messages": [
            {"role": "user", "content": user_content}
        ],
        "stream": False,  # 尝试请求非流式
        "max_tokens": max_tokens,
        "temperature": 0.7
    }
    
    print(f"LLM REQUEST URL: {settings.llm_base_url}")
    
    async with httpx.AsyncClient(timeout=300.0) as client:
        # 注意: 如果代理强制流式，这里虽然请求 stream=False，但可能返回 stream
        # 为了兼容性，我们先发起普通请求，但做好解析流式响应的准备
        request = client.build_request("POST", settings.llm_base_url, headers=headers, json=payload)
        response = await client.send(request, stream=True)
        
        if response.status_code != 200:
            await response.read() # 读取错误信息
            error_detail = response.text
            print(f"LLM API Error (HTTP {response.status_code}): {error_detail}")
            raise ValueError(f"LLM API 返回错误 (HTTP {response.status_code}): {error_detail}")
        
        # 尝试读取第一块数据来判断是否为流式
        # 这种方式有点 hacky，但能兼容强制流式的代理
        content_buffer = ""
        is_stream = False
        
        # 读取响应头 Content-Type
        content_type = response.headers.get("Content-Type", "")
        if "text/event-stream" in content_type:
            is_stream = True
        
        if is_stream:
            print("Detected SSE Stream response (forced by proxy)")
            async for line in response.aiter_lines():
                if not line:
                    continue
                if line.startswith("data: "):
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        data = json.loads(data_str)
                        if "choices" in data and len(data["choices"]) > 0:
                            delta = data["choices"][0].get("delta", {})
                            # 过滤 reasoning_content (DeepSeek R1/CoT)，只取 content
                            chunk = delta.get("content", "")
                            if chunk:
                                content_buffer += chunk
                    except json.JSONDecodeError:
                        continue
            
            return content_buffer.strip()
            
        else:
            # 普通 JSON 响应
            # 读取全部内容
            response_text = ""
            async for chunk in response.aiter_text():
                response_text += chunk
            
            try:
                # 某些代理可能会返回 data: {...} 开头的 SSE 文本但 Content-Type 没写对
                # 所以我们先尝试当 JSON 解析
                data = json.loads(response_text)
                
                # OpenAI 格式
                if "choices" in data and len(data["choices"]) > 0:
                    message = data["choices"][0].get("message", {})
                    return message.get("content", "").strip()
                elif "content" in data and isinstance(data["content"], list):
                     # Anthropic 格式兼容
                    return data["content"][0].get("text", "").strip()
                else:
                    # 可能是其他格式，或者空的
                    print(f"Unexpected JSON: {data}")
                    if "error" in data:
                        raise ValueError(f"API Error: {data['error']}")
                    return str(data)
                    
            except json.JSONDecodeError:
                # 如果 JSON 解析失败，检查是否是 SSE 格式的文本堆在一起
                print("JSON Decode Failed, trying to parse as SSE text dump")
                if "data: " in response_text:
                    lines = response_text.split('\n')
                    for line in lines:
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            if data_str == "[DONE]":
                                continue
                            try:
                                data = json.loads(data_str)
                                if "choices" in data and len(data["choices"]) > 0:
                                    delta = data["choices"][0].get("delta", {}) or data["choices"][0].get("message", {})
                                    chunk = delta.get("content", "")
                                    if chunk:
                                        content_buffer += chunk
                            except:
                                pass
                    if content_buffer:
                        return content_buffer.strip()
                
                # 实在不行就抛错
                print(f"Raw Response: {response_text[:200]}")
                raise ValueError(f"LLM API 返回无效格式: {response_text[:200]}")
