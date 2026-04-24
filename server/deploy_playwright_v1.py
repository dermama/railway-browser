import os
import time
from huggingface_hub import HfApi, create_repo

# ── Config ──────────────────────────────────────────────────
TOKEN   = "os.getenv("HF_TOKEN")"
REPO_ID = "monakoki/goooo"

# ── Files to upload ──────────────────────────────────────────
FILES = [
    "index.js",
    "package.json",
    "package-lock.json",
    "Dockerfile",
    ".gitignore",
    "nginx.conf",
    "start.sh",
    "README.md",
]
FOLDERS = [
    ("public",        "public"),
    ("../extension",  "extension"),
]

# ────────────────────────────────────────────────────────────
api = HfApi(token=TOKEN)

print(f"=== Deploying Playwright V1 to: {REPO_ID} ===")

# 1. Ensure the Space exists
try:
    create_repo(repo_id=REPO_ID, repo_type="space", space_sdk="docker", exist_ok=True)
    print("Space is ready.")
except Exception as e:
    print(f"Note: {e}")

# 2. Stamp a fresh BUILD_TRIGGER so HF rebuilds the container
docker_path = "Dockerfile"
if os.path.exists(docker_path):
    with open(docker_path, "r") as f:
        lines = [l for l in f.readlines() if "BUILD_TRIGGER" not in l]
    lines.append(f"\n# BUILD_TRIGGER_PLAYWRIGHT: {time.time()}\n")
    with open(docker_path, "w") as f:
        f.writelines(lines)
    print("BUILD_TRIGGER updated in Dockerfile.")

# 3. Upload individual files
print("\nUploading files...")
for filename in FILES:
    if os.path.exists(filename):
        api.upload_file(
            path_or_fileobj=filename,
            path_in_repo=filename,
            repo_id=REPO_ID,
            repo_type="space",
            token=TOKEN,
        )
        print(f"  [OK] {filename}")
    else:
        print(f"  [SKIP] (not found): {filename}")

# 4. Upload folders
print("\nUploading folders...")
for local_path, repo_path in FOLDERS:
    if os.path.exists(local_path):
        api.upload_folder(
            folder_path=local_path,
            path_in_repo=repo_path,
            repo_id=REPO_ID,
            repo_type="space",
            token=TOKEN,
        )
        print(f"  [OK] {local_path} -> {repo_path}/")
    else:
        print(f"  [SKIP] (not found): {local_path}")

print(f"\n=== SUCCESS ===")
print(f"Space URL  : https://huggingface.co/spaces/{REPO_ID}")
print(f"Control UI : https://{REPO_ID.replace('/', '-')}.hf.space")
print(f"\nBuild takes ~2-3 minutes. Check Diagnostics panel for Playwright status.")
