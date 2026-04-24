import requests

token = "os.getenv("HF_TOKEN")"
url = "https://huggingface.co/api/spaces/monakoki/mdffcd/logs"

headers = {
    "Authorization": f"Bearer {token}"
}

try:
    response = requests.get(url, headers=headers)
    print(f"Status Code: {response.status_code}")
    # The API might stream or return JSON lines or direct text
    try:
        logs = response.text.splitlines()[-50:] # Get last 50 lines
        for line in logs:
            print(line)
    except Exception as e:
        print("Failed to parse logs:", e)
        print("Raw response:", response.text[:500])
except Exception as e:
    print(f"Error fetching logs: {e}")
