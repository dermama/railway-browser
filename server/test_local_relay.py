import requests
import base64
import json
import os

# Files
person_img_path = r'C:\Users\ersan\.gemini\antigravity\brain\60ed17b3-170a-481f-92bb-891e8a0db058\media__1774268096566.jpg'
server_url = 'http://localhost:7860/api/tasks'

def get_base64_encoded_image(image_path):
    with open(image_path, "rb") as img_file:
        return f"data:image/jpeg;base64,{base64.b64encode(img_file.read()).decode('utf-8')}"

try:
    if os.path.exists(person_img_path):
        base64_img = get_base64_encoded_image(person_img_path)
        
        payload = {
            "personImage": base64_img,
            "garmentImage": base64_img # Using same image for testing as requested/available
        }
        
        print(f"Sending request to {server_url}...")
        response = requests.post(server_url, json=payload)
        
        if response.status_code == 200:
            print(f"Success! Task ID: {response.json().get('taskId')}")
            print("Check your local control page: http://localhost:7860/control.html")
        else:
            print(f"Failed with status: {response.status_code}")
            print(response.text)
    else:
        print(f"File not found: {person_img_path}")
except Exception as e:
    print(f"Error: {e}")
