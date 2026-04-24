import requests
import base64
import os
import time

# Target: Third Space
API_URL = "https://monldds-mongi.hf.space/api/tasks"

# Use existing test images
person_path = r"C:\Users\ersan\.gemini\antigravity\brain\6c5e2f06-13fd-4032-a883-05fc1bd06bdc\test_person_1774338632649.png"
garment_path = r"C:\Users\ersan\.gemini\antigravity\brain\6c5e2f06-13fd-4032-a883-05fc1bd06bdc\test_garment_1774338648351.png"

def get_base64(path):
    with open(path, "rb") as f:
        return f"data:image/png;base64,{base64.b64encode(f.read()).decode()}"

print("Loading images...")
person_b64 = get_base64(person_path)
garment_b64 = get_base64(garment_path)

payload = {
    "personImage": person_b64,
    "garmentImage": garment_b64
}

print(f"Sending request to {API_URL}...")
try:
    response = requests.post(API_URL, json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")

    if response.status_code == 200:
        task_id = response.json().get("taskId")
        print(f"Success! Created Task ID: {task_id}")
        
        # Poll for status
        for i in range(12): # Poll for 2 minutes
            time.sleep(10)
            status_res = requests.get(f"{API_URL}/{task_id}/status")
            print(f"[{time.strftime('%H:%M:%S')}] Status: {status_res.text}")
            if "completed" in status_res.text:
                print("Task Completed Successfully in Third Space!")
                break
    else:
        print("Failed to create task.")
except Exception as e:
    print(f"Error: {e}")
