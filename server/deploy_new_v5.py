from huggingface_hub import HfApi, create_repo
import os

# New Account Credentials (V5 Pro)
token = "os.getenv("HF_TOKEN")"
repo_id = "monldds/ashion-ai-v5-pro" 

api = HfApi(token=token)

print(f"Checking/Creating repository: {repo_id}...")
try:
    # Set space_sdk explicitly to docker
    create_repo(repo_id=repo_id, repo_type="space", space_sdk="docker", exist_ok=True)
    print("Repository is ready.")
except Exception as e:
    print(f"Error checking/creating repository: {e}")

print("Uploading files...")

# Upload specific files and folders
files_to_upload = ["index.js", "package.json", "package-lock.json", "Dockerfile", ".gitignore", "nginx.conf", "start.sh", "README.md"]
folders_to_upload = ["public", "../extension"]

try:
    for file in files_to_upload:
        if os.path.exists(file):
            api.upload_file(
                path_or_fileobj=file,
                path_in_repo=file,
                repo_id=repo_id,
                repo_type="space",
                token=token
            )
            print(f"Uploaded File: {file}")
    
    for folder_path in folders_to_upload:
        if os.path.exists(folder_path):
            # If it's the extension folder (which is outside the server dir), upload it as 'extension'
            path_in_repo = "extension" if "extension" in folder_path else folder_path
            api.upload_folder(
                folder_path=folder_path,
                path_in_repo=path_in_repo,
                repo_id=repo_id,
                repo_type="space",
                token=token
            )
            print(f"Uploaded Folder: {folder_path} as {path_in_repo}")
            
    print(f"Successfully deployed to: https://huggingface.co/spaces/{repo_id}")
    print(f"Server URL (WebSocket): wss://{repo_id.replace('/', '-')}.hf.space")
    print(f"API URL (HTTP): https://{repo_id.replace('/', '-')}.hf.space")
except Exception as e:
    print(f"Error uploading: {e}")
