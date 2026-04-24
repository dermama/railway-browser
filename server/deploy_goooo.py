from huggingface_hub import HfApi, create_repo
import os
import time

# Credentials for the NEW space
token = "os.getenv("HF_TOKEN")"
repo_id = "monakoki/goooo" 

api = HfApi(token=token)

print(f"--- Deploying Hardened Stealth AI to: {repo_id} ---")
try:
    create_repo(repo_id=repo_id, repo_type="space", space_sdk="docker", exist_ok=True)
    print("Repository is ready.")
except Exception as e:
    print(f"Note: {e}")

# Build trigger
dockerfile_path = "Dockerfile"
if os.path.exists(dockerfile_path):
    with open(dockerfile_path, "r") as f:
        lines = f.readlines()
    lines = [line for line in lines if "BUILD_TRIGGER" not in line]
    lines.append(f"\n# BUILD_TRIGGER_GOOOO: {time.time()}\n")
    with open(dockerfile_path, "w") as f:
        f.writelines(lines)
    print("Added Build Trigger for 'goooo' to Dockerfile.")

print("Uploading files...")
files_to_upload = ["index.js", "package.json", "package-lock.json", "Dockerfile", ".gitignore", "nginx.conf", "start.sh", "README.md"]
folders_to_upload = ["public", "../extension"]

try:
    for file in files_to_upload:
        if os.path.exists(file):
            api.upload_file(path_or_fileobj=file, path_in_repo=file, repo_id=repo_id, repo_type="space", token=token)
            print(f"Uploaded: {file}")
    
    for folder_path in folders_to_upload:
        if os.path.exists(folder_path):
            path_in_repo = "extension" if "extension" in folder_path else folder_path
            api.upload_folder(folder_path=folder_path, path_in_repo=path_in_repo, repo_id=repo_id, repo_type="space", token=token)
            print(f"Uploaded Folder: {folder_path}")
            
    print(f"\n--- SUCCESS ---")
    print(f"Deployed to: https://huggingface.co/spaces/{repo_id}")
except Exception as e:
    print(f"Error: {e}")
