import requests
import os
import base64

token = "os.getenv("HF_TOKEN")"
repo_id = "loradre/ai-merger-relay"

files_to_upload = [
    "index.js",
    "package.json",
    "package-lock.json",
    "Dockerfile",
    ".dockerignore"
]

def upload_file(filename):
    with open(filename, "rb") as f:
        content = f.read()
    
    url = f"https://huggingface.co/api/spaces/{repo_id}/upload/main/{filename}"
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.post(url, headers=headers, data=content)
    if response.status_code == 200:
        print(f"Uploaded: {filename}")
    else:
        print(f"Failed to upload {filename}: {response.status_code} - {response.text}")

for file in files_to_upload:
    if os.path.exists(file):
        upload_file(file)
    else:
        print(f"File not found: {file}")
