from huggingface_hub import HfApi, create_repo
import os
import time

# NEW Space Credentials (Fashion AI V5 Pro - Correct Name)
token = "os.getenv("HF_TOKEN")"
repo_id = "monldds/fashion-ai-v5-pro" 

api = HfApi(token=token)

print(f"Checking/Creating repository: {repo_id}...")
try:
    # Ensure it's created as a Docker Space
    create_repo(repo_id=repo_id, repo_type="space", space_sdk="docker", exist_ok=True)
    print("Repository is ready.")
except Exception as e:
    print(f"Error checking/creating repository: {e}")

# Create a build trigger by adding a timestamp to Dockerfile
dockerfile_path = "Dockerfile"
if os.path.exists(dockerfile_path):
    with open(dockerfile_path, "r") as f:
        lines = f.readlines()
    
    # Remove old triggers if any
    lines = [line for line in lines if "BUILD_TRIGGER" not in line]
    # Add new trigger
    lines.append(f"\n# BUILD_TRIGGER: {time.time()}\n")
    
    with open(dockerfile_path, "w") as f:
        f.writelines(lines)
    print("Added Build Trigger to Dockerfile.")

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
            path_in_repo = "extension" if "extension" in folder_path else folder_path
            api.upload_folder(
                folder_path=folder_path,
                path_in_repo=path_in_repo,
                repo_id=repo_id,
                repo_type="space",
                token=token
            )
            print(f"Uploaded Folder: {folder_path} as {path_in_repo}")
            
    print(f"\n--- SUCCESS ---")
    print(f"Deployed to: https://huggingface.co/spaces/{repo_id}")
    print(f"Server URL: wss://{repo_id.replace('/', '-')}.hf.space")
    print(f"Check Logs: https://huggingface.co/spaces/{repo_id}?logs=build")
except Exception as e:
    print(f"Error uploading: {e}")
