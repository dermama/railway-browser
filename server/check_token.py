import requests

token = "os.getenv("HF_TOKEN")"
headers = {"Authorization": f"Bearer {token}"}

print("Checking user identity...")
whoami = requests.get("https://huggingface.co/api/whoami-v2", headers=headers).json()
print(f"Current User: {whoami.get('name')}")

print("\nListing spaces accessible by this token:")
spaces = requests.get("https://huggingface.co/api/spaces", headers=headers).json()
# Filter for spaces owned by the user
user_spaces = [s for s in spaces if s['id'].startswith(f"{whoami['name']}/")]

if user_spaces:
    for space in user_spaces:
        print(f"- {space['id']} ({space.get('sdk')})")
else:
    print("No spaces found for this user.")

print("\nChecking token capabilities...")
print(f"Token Display Name: {whoami.get('auth', {}).get('accessToken', {}).get('displayName')}")
print(f"Token Role: {whoami.get('auth', {}).get('accessToken', {}).get('role')}")
