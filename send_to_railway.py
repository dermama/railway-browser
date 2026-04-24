import base64
import requests
import json
import os

# رابط السيرفر على Railway
server_url = "https://railway-browser-production.up.railway.app/api/tasks"

# مسار الصورة
image_path = "تنزيل (2).jpg"

def get_base64(path):
    with open(path, "rb") as f:
        # السيرفر يتوقع Base64 JPEG
        return f"data:image/png;base64,{base64.b64encode(f.read()).decode()}"

if not os.path.exists(image_path):
    print(f"Error: Please save the image as '{image_path}' in the current folder first.")
else:
    try:
        print(f"Loading image {image_path}...")
        img_base64 = get_base64(image_path)
        
        payload = {
            "image": img_base64,
            "prompt": "Test task for jewelry logo"
        }
        
        print(f"Sending Task to Railway: {server_url}...")
        response = requests.post(server_url, json=payload, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            task_id = response.json().get('taskId')
            print(f"\n--- SUCCESS ---")
            print(f"Task ID: {task_id}")
            print(f"Check your browser now!")
            
    except Exception as e:
        print(f"Error: {e}")
