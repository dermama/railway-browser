import requests
import json
import time

# Testing specifically for the monldds space
API_URL = "https://monldds-fvdghjt.hf.space/api/tasks"

print(f"--- Sending Test Task with Prompt to {API_URL} ---")

payload = {
    "personImage": "https://raw.githubusercontent.com/gradio-app/gradio/main/test/test_files/bus.png", # Dummy image
    "garmentImage": "https://raw.githubusercontent.com/gradio-app/gradio/main/test/test_files/bus.png", # Dummy image
    "prompt": "Create a futuristic neon jacket based on this garment."
}

try:
    print("Sending POST request...")
    response = requests.post(API_URL, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")

    if response.status_code == 200:
        task_id = response.json().get("taskId")
        print(f"✅ Success! Created Task ID: {task_id}")
        
        print("\nChecking if the task in the queue includes the prompt (via /api/tasks/next)...")
        # Note: In a real scenario, this would be called by the extension.
        # Calling it here will mark the task as 'processing'.
        next_task_res = requests.get(API_URL.replace('/tasks', '/tasks/next'))
        if next_task_res.status_code == 200:
            task_data = next_task_res.json()
            if task_data.get('prompt') == payload['prompt']:
                print(f"✅ VERIFIED: Next task data contains the prompt: {task_data.get('prompt')}")
            else:
                print(f"❌ ERROR: Next task data does not have matching prompt. Found: {task_data.get('prompt')}")
        else:
            print(f"⚠️ Could not fetch next task (it might have been picked up already): {next_task_res.status_code}")
    else:
        print("❌ FAILED to create task.")

except Exception as e:
    print(f"❌ Exception occurred: {e}")
