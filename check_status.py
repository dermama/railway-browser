import requests
import json

url = "https://railway-browser-production.up.railway.app/api/debug"

try:
    response = requests.get(url, timeout=15)
    if response.status_code == 200:
        data = response.json()
        print(f"Server Status:")
        print(f"- Connected Extensions: {data.get('extensions') or data.get('connected_extensions')}")
        print(f"- Pending Tasks: {data.get('tasks') or data.get('pending_tasks')}")
        print(f"- Completed Tasks: {data.get('results') or data.get('completed_tasks_count')}")
    else:
        print(f"Failed to reach server. Status Code: {response.status_code}")
except Exception as e:
    print(f"Error: {e}")
