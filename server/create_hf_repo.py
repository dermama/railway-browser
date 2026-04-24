import requests

token = "os.getenv("HF_TOKEN")"
repo_name = "ai-merger-relay"

url = "https://huggingface.co/api/repos/create?type=space"
headers = {"Authorization": f"Bearer {token}"}
data = {"name": repo_name, "sdk": "docker"}

response = requests.post(url, headers=headers, json=data)

if response.status_code == 200:
    print(f"Successfully created space: {repo_name}")
elif response.status_code == 409:
    print(f"Space {repo_name} already exists.")
else:
    print(f"Error creating space: {response.status_code} - {response.text}")
