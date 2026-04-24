import requests
import sys

# Set encoding to utf-8 for stdout
sys.stdout.reconfigure(encoding='utf-8')

token = "os.getenv("HF_TOKEN")"
repo_id = "monldds/ashion-ai-v5-pro"
headers = {"Authorization": f"Bearer {token}"}

try:
    print(f"--- Checking Space: {repo_id} ---")
    res = requests.get(f"https://huggingface.co/api/spaces/{repo_id}", headers=headers)
    if res.status_code == 200:
        data = res.json()
        print(f"Status Stage: {data.get('runtime', {}).get('stage')}")
        print(f"Last Modified: {data.get('lastModified')}")
    else:
        print(f"Error fetching status: {res.status_code}")

    print("\n--- Checking README.md Metadata ---")
    res = requests.get(f"https://huggingface.co/spaces/{repo_id}/raw/main/README.md", headers=headers)
    if res.status_code == 200:
        print(res.text[:500])
    else:
        print(f"Error fetching README.md: {res.status_code}")

    print("\n--- Checking Dockerfile ---")
    res = requests.get(f"https://huggingface.co/spaces/{repo_id}/raw/main/Dockerfile", headers=headers)
    if res.status_code == 200:
        print(res.text[:500])
    else:
        print(f"Error fetching Dockerfile: {res.status_code}")

except Exception as e:
    print(f"Error: {e}")
