import requests
import json

url = "https://railway-browser-production.up.railway.app/api/monitor/stats"

try:
    response = requests.get(url, timeout=15)
    if response.status_code == 200:
        data = response.json()
        print(f"Server Status:")
        print(f"- REAL Connected Extensions: {data.get('connected_extensions')}")
        print(f"- Connected Monitor Panels: {data.get('connected_monitors')}")
        print(f"- Pending Tasks: {data.get('pending_tasks')}")
        print(f"- Completed Tasks: {data.get('completed_tasks')}")
    else:
        print(f"Failed to reach server. Status Code: {response.status_code}")
except Exception as e:
    print(f"Error: {e}")
