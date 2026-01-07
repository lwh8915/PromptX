"""
邮件发送服务 - 使用 SMTP 发送验证码邮件
"""
import os
import random
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import Optional

# 简单的内存存储验证码（生产环境应使用 Redis）
verification_codes: dict[str, dict] = {}


def generate_code(length: int = 6) -> str:
    """生成随机验证码"""
    return ''.join(random.choices(string.digits, k=length))


def store_code(email: str, code: str, expires_minutes: int = 10):
    """存储验证码"""
    verification_codes[email] = {
        "code": code,
        "expires_at": datetime.utcnow() + timedelta(minutes=expires_minutes)
    }


def verify_code(email: str, code: str) -> bool:
    """验证验证码"""
    if email not in verification_codes:
        return False
    
    stored = verification_codes[email]
    if datetime.utcnow() > stored["expires_at"]:
        del verification_codes[email]
        return False
    
    if stored["code"] != code:
        return False
    
    # 验证成功后删除
    del verification_codes[email]
    return True


async def send_verification_email(to_email: str, code: str) -> bool:
    """发送验证码邮件"""
    try:
        smtp_host = os.getenv("SMTP_HOST", "smtp.qq.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER")
        smtp_password = os.getenv("SMTP_PASSWORD")
        from_name = os.getenv("SMTP_FROM_NAME", "Prompt Manager")
        
        if not smtp_user or not smtp_password:
            print("SMTP配置缺失")
            return False
        
        # 创建邮件
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"【{from_name}】密码重置验证码"
        msg["From"] = f"{from_name} <{smtp_user}>"
        msg["To"] = to_email
        
        # HTML 邮件内容
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
                .container {{ max-width: 500px; margin: 0 auto; padding: 40px 20px; }}
                .code {{ font-size: 32px; font-weight: bold; color: #5b7cfa; letter-spacing: 4px; 
                         background: #f5f7ff; padding: 20px 40px; border-radius: 12px; text-align: center; }}
                .footer {{ color: #888; font-size: 12px; margin-top: 30px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <h2>密码重置验证码</h2>
                <p>您好，您正在重置 {from_name} 的登录密码，验证码如下：</p>
                <div class="code">{code}</div>
                <p>验证码有效期为 <strong>10 分钟</strong>，请尽快使用。</p>
                <p>如果这不是您本人的操作，请忽略此邮件。</p>
                <div class="footer">
                    <p>此邮件由系统自动发送，请勿回复。</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"您的密码重置验证码是：{code}，有效期10分钟。"
        
        msg.attach(MIMEText(text_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))
        
        # 发送邮件
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, to_email, msg.as_string())
        
        print(f"验证码邮件已发送到 {to_email}")
        return True
        
    except Exception as e:
        print(f"发送邮件失败: {e}")
        return False
