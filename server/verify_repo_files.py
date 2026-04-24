import requests

token = "os.getenv("HF_TOKEN")"
headers = {"Authorization": f"Bearer {token}"}
repo_id = "monldds/ashion-ai-v5-pro"

try:
    print(f"Listing files in {repo_id}...")
    response = requests.get(f"https://huggingface.co/api/spaces/{repo_id}/tree/main", headers=headers)
    if response.status_code == 200:
        files = response.json()
        print("Files in repository:")
        for f in files:
            print(f"- {f.get('path')} (type: {f.get('type')})")
    else:
        print(f"Error: {response.status_code} - {response.text}")
except Exception as e:
    print(f"Request failed: {e}")
