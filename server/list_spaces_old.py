import requests

# OLD monldds token
token = "os.getenv("HF_TOKEN")"
headers = {"Authorization": f"Bearer {token}"}

try:
    response = requests.get("https://huggingface.co/api/spaces", headers=headers)
    if response.status_code == 200:
        spaces = response.json()
        my_spaces = [s['id'] for s in spaces if s['id'].startswith('monldds/')]
        print(f"Token IDENTIFIED_NAME: {requests.get('https://huggingface.co/api/whoami-v2', headers=headers).json().get('name')}")
        print(f"My Spaces for OLD token: {my_spaces}")
    else:
        print(f"Error: {response.status_code} - {response.text}")
except Exception as e:
    print(f"Request failed: {e}")
