import requests

token = "os.getenv("HF_TOKEN")"
headers = {"Authorization": f"Bearer {token}"}

try:
    response = requests.get("https://huggingface.co/api/spaces", headers=headers)
    if response.status_code == 200:
        spaces = response.json()
        print(f"Total Spaces Visible: {len(spaces)}")
        # Filter for monldds
        my_spaces = [s['id'] for s in spaces if s['id'].startswith('monldds/')]
        print(f"My Spaces: {my_spaces}")
    else:
        print(f"Error: {response.status_code} - {response.text}")
except Exception as e:
    print(f"Request failed: {e}")
