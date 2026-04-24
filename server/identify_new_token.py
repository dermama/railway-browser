import requests

token = "os.getenv("HF_TOKEN")"
headers = {"Authorization": f"Bearer {token}"}

try:
    response = requests.get("https://huggingface.co/api/whoami-v2", headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f"IDENTIFIED_NAME: {data.get('name')}")
        print(f"ROLE: {data.get('auth', {}).get('accessToken', {}).get('role')}")
    else:
        print(f"Error: {response.status_code} - {response.text}")
except Exception as e:
    print(f"Request failed: {e}")
