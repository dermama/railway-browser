from huggingface_hub import HfApi, create_repo
import os
import sys

# Default values
token = "os.getenv("HF_TOKEN")"
repo_id = "loradre/serveloutfit"

# Override repo_id from command line if provided
if len(sys.argv) > 1:
    repo_id = sys.argv[1]

api = HfApi(token=token)

print(f"Checking/Creating repository: {repo_id}...")
try:
    # Set space_sdk explicitly for new repos
    create_repo(repo_id=repo_id, repo_type="space", space_sdk="docker", exist_ok=True)
    print("Repository is ready.")
except Exception as e:
    print(f"Error checking/creating repository: {e}")

print(f"Uploading files to {repo_id}...")

files_to_upload = ["index.js", "package.json", "package-lock.json", "Dockerfile", ".gitignore", "nginx.conf", "start.sh"]
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
            
    print(f"All files and folders uploaded successfully to {repo_id}.")
except Exception as e:
    print(f"Error uploading: {e}")

print(f"Check your space at: https://huggingface.co/spaces/{repo_id}")
