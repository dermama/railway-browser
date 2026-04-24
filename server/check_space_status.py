import requests

token = "os.getenv("HF_TOKEN")"
headers = {"Authorization": f"Bearer {token}"}
repo_id = "monldds/ashion-ai-v5-pro"

try:
    print(f"Fetching status for {repo_id}...")
    response = requests.get(f"https://huggingface.co/api/spaces/{repo_id}", headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f"Space Status: {data.get('runtime', {}).get('stage')}")
        print(f"Hardware: {data.get('runtime', {}).get('hardware')}")
    else:
        print(f"Error: {response.status_code} - {response.text}")

    print("\nFetching latest build logs...")
    logs_response = requests.get(f"https://huggingface.co/api/spaces/{repo_id}/logs/build", headers=headers)
    if logs_response.status_code == 200:
        logs = logs_response.text.split('\n')
        # Print last 20 lines of logs
        for line in logs[-20:]:
            print(line)
    else:
         print(f"Error fetching logs: {logs_response.status_code} - {logs_response.text}")

except Exception as e:
    print(f"Request failed: {e}")
