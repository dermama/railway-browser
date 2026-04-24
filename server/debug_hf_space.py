import requests
import json

token = "os.getenv("HF_TOKEN")"
repo_id = "monldds/fashion-ai-v5-pro"
headers = {"Authorization": f"Bearer {token}"}

def check_space():
    print(f"--- Checking Space: {repo_id} ---")
    
    # 1. Get Space Details
    res = requests.get(f"https://huggingface.co/api/spaces/{repo_id}", headers=headers)
    if res.status_code == 200:
        data = res.json()
        print(f"Status: {data.get('runtime', {}).get('stage')}")
        print(f"URL: {data.get('runtime', {}).get('url')}")
        print(f"Last Build: {data.get('lastModified')}")
    else:
        print(f"Error fetching status: {res.status_code} - {res.text}")

    # 2. Check README.md content
    print("\n--- Checking README.md ---")
    res = requests.get(f"https://huggingface.co/datasets/{repo_id}/raw/main/README.md", headers=headers)
    if res.status_code != 200:
        # Try as space
        res = requests.get(f"https://huggingface.co/spaces/{repo_id}/raw/main/README.md", headers=headers)
    
    if res.status_code == 200:
        print(res.text)
    else:
       print(f"Could not fetch README.md contents: {res.status_code}")

    # 3. Check Dockerfile content
    print("\n--- Checking Dockerfile ---")
    res = requests.get(f"https://huggingface.co/spaces/{repo_id}/raw/main/Dockerfile", headers=headers)
    if res.status_code == 200:
        print(res.text[:200] + "...")
    else:
        print(f"Could not fetch Dockerfile contents: {res.status_code}")

if __name__ == "__main__":
    check_space()
