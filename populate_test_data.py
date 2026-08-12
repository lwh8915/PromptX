"""
批量创建测试数据脚本

脚本启动时会尝试获取并打印服务端应用版本号，获取失败不影响主流程。

用法:
  1. 设置环境变量:
     export PROMPTX_USERNAME=your_username
     export PROMPTX_PASSWORD=your_password
  2. 或者运行时会提示输入

运行: python populate_test_data.py
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
        if response.content:
            print(f"Server response: {response.content.decode()}")
        sys.exit(1)

def get_gemini_category_id(token):
    """Find 'AI' -> 'gemini' category ID"""
    headers = {"Authorization": f"Bearer {token}"}
    print("Fetching categories...")
    
    try:
        # Assuming there's an endpoint for categories
        # Based on client.ts: categoryApi.getAll() -> likely GET /categories
        response = requests.get(f"{BASE_URL}/categories", headers=headers)
        response.raise_for_status()
        categories = response.json()
        
        # Strategy: Look for a category named 'AI', then look for a child named 'gemini'
        # Or look for 'gemini' directly if structures are flat or fully returned
        
        gemini_id = None
        
        # Print categories for debugging if needed
        # print(categories)

        # 1. Find 'AI' category
        ai_cat = next((c for c in categories if c['name'] == 'AI'), None)
        if not ai_cat:
            print("Category 'AI' not found. Please create it first.")
            # Optionally create AI if not exists? User implied it exists.
            sys.exit(1)
            
        print(f"Found 'AI' category ID: {ai_cat['id']}")
        
        # 2. Find 'gemini' child category inside AI's children
        gemini_cat = next((c for c in ai_cat.get('children', []) if c['name'] == 'gemini'), None)
        
        if not gemini_cat:
             print("Category 'gemini' not found under 'AI'. Creating it...")
             create_resp = requests.post(f"{BASE_URL}/categories", headers=headers, json={
                 "name": "gemini",
                 "parent_id": ai_cat['id'],
                 "sort_order": 0
             })
             create_resp.raise_for_status()
             gemini_cat = create_resp.json()
             print("Created 'gemini' category.")
        
        print(f"Target Category 'gemini' ID: {gemini_cat['id']}")
        return gemini_cat['id']

    except Exception as e:
        print(f"Failed to get categories: {e}")
        # print full response for debug if needed
        # print(response.text)
        sys.exit(1)

def create_prompts(token, category_id):
    """Create 30 test prompts"""
    headers = {"Authorization": f"Bearer {token}"}
    
    for i in range(1, 31):
        title = f"测试{i}"
        content = f"测试{i}"
        
        data = {
            "title": title,
            "content": content,
            "category_id": category_id,
            "tags": ["test", "batch"],
            "description": f"Batch created test prompt {i}",
            "is_favorite": False
        }
        
        try:
            resp = requests.post(f"{BASE_URL}/prompts", headers=headers, json=data)
            if resp.status_code == 201 or resp.status_code == 200:
                print(f"Created: {title}")
            else:
                print(f"Failed to create {title}: {resp.status_code} - {resp.text}")
        except Exception as e:
            print(f"Error creating {title}: {e}")

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
    cat_id = get_gemini_category_id(token)
    create_prompts(token, cat_id)
    print("Done.")
