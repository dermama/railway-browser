import base64
import requests
import json
import os

# New Space V2 Server
server_url = "https://monldds-fashion-ai-v5-pro-v2.hf.space/api/tasks"

# Generated Images
person_img_path = r"C:\Users\ersan\.gemini\antigravity\brain\81d930cc-0199-4608-9f59-51faa7d89a44\fashion_model_hand_sample_1774768949181.png"
garment_img_path = r"C:\Users\ersan\.gemini\antigravity\brain\81d930cc-0199-4608-9f59-51faa7d89a44\luxury_diamond_ring_sample_1774768932166.png"

# Prompt requested by user
user_prompt = "Create a professional, realistic promotional image for jewelry. A high-fashion jewelry editorial shot of this luxury diamond ring on a high-fashion realistic model's hand, hyper-realistic detail, cinematic studio lighting, skin texture visibility, elegant background."

def get_base64(path):
    with open(path, "rb") as f:
        return f"data:image/png;base64,{base64.b64encode(f.read()).decode()}"

try:
    print(f"Loading generated jewelry and model images...")
    p_img = get_base64(person_img_path)
    g_img = get_base64(garment_img_path)
    
    payload = {
        "personImage": p_img,
        "garmentImage": g_img,
        "prompt": user_prompt
    }
    
    print(f"Sending Jewelry Task to V2 Server: {server_url}...")
    response = requests.post(server_url, json=payload, timeout=60)
    
    print(f"Server Status: {response.status_code}")
    print(f"Server Response: {response.text}")
    
    if response.status_code == 200:
        task_id = response.json().get('taskId')
        print(f"\n--- SUCCESS ---")
        print(f"Task ID created: {task_id}")
        print(f"You can monitor this task at: https://monldds-fashion-ai-v5-pro-v2.hf.space/control.html")
        
except Exception as e:
    print(f"Error sending task: {e}")
