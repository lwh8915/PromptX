"""
删除测试数据脚本

脚本登录前会尝试获取并打印服务端应用版本号，获取失败不影响主流程。

用法:
  1. 设置环境变量:
     export PROMPTX_USERNAME=your_username
     export PROMPTX_PASSWORD=your_password
  2. 或者运行时会提示输入

运行: python delete_test_data.py
"""
import requests
import sys
import os
import getpass

# Configuration
BASE_URL = os.getenv("PROMPTX_API_URL", "http://localhost:8000/api")
USERNAME = os.getenv("PROMPTX_USERNAME", "")
PASSWORD = os.getenv("PROMPTX_PASSWORD", "")

def login():
    """Login and return access token"""
    global USERNAME, PASSWORD
    
    # 如果未设置环境变量，提示输入
    if not USERNAME:
        USERNAME = input("用户名: ").strip()
    if not PASSWORD:
        PASSWORD = getpass.getpass("密码: ")
    
    print(f"正在登录 {USERNAME}...")
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "identifier": USERNAME,
            "password": PASSWORD
        })
        response.raise_for_status()
        token = response.json()["access_token"]
        print("Login successful.")
        return token
    except Exception as e:
        print(f"Login failed: {e}")
        if 'response' in locals() and response.content:
            print(f"Server response: {response.content.decode()}")
        sys.exit(1)

def delete_test_prompts(token):
    """Delete prompts with tags 'test' and 'batch'"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Fetch prompts with tags
    # requests automatically serializes list params as key=value&key=value
    params = {
        "tags": ["test", "batch"], 
        "page_size": 100  # Ensure we get enough, or loop if needed
    }
    
    print("Fetching test prompts...")
    try:
        response = requests.get(f"{BASE_URL}/prompts", headers=headers, params=params)
        response.raise_for_status()
        data = response.json()
        prompts = data.get("items", [])
        total = data.get("total", 0)
        
        print(f"Found {len(prompts)} prompts to delete (Total match: {total})")
        
        if not prompts:
            print("No prompts found to delete.")
            return

        deleted_count = 0
        for prompt in prompts:
            # Double check title to be safe (optional but good practice)
            if prompt["title"].startswith("测试"):
                print(f"Deleting '{prompt['title']}' (ID: {prompt['id']})...")
                del_resp = requests.delete(f"{BASE_URL}/prompts/{prompt['id']}", headers=headers)
                if del_resp.status_code == 200 or del_resp.status_code == 204:
                    deleted_count += 1
                else:
                    print(f"Failed to delete {prompt['id']}: {del_resp.status_code}")
            else:
                print(f"Skipping '{prompt['title']}' (does not start with '测试')")

        print(f"Operation complete. Deleted {deleted_count} prompts.")

        # Recurse if there are more pages? 
        # Since we fetched 100 and likely only deleted <=30, recursion might not be needed for this specific request 
        # but if total > 100, we'd need to loop. For now, 30 items fits in one page.

    except Exception as e:
        print(f"Error fetching/deleting prompts: {e}")
        sys.exit(1)

def show_server_version():
    """尝试获取并打印服务端应用版本号，失败时降级继续主流程"""
    try:
        resp = requests.get(f"{BASE_URL}/version", timeout=5)
        resp.raise_for_status()
        info = resp.json()
        print(f"服务端应用: {info.get('app')} v{info.get('version')}")
    except Exception as e:
        print(f"获取服务端版本失败（忽略并继续）: {e}")

if __name__ == "__main__":
    show_server_version()
    token = login()
    delete_test_prompts(token)
