import requests
import base64
import time

def test_space(name, url):
    print(f"\n--- Testing {name} ({url}) ---")
    person_path = r"C:\Users\ersan\.gemini\antigravity\brain\6c5e2f06-13fd-4032-a883-05fc1bd06bdc\test_person_1774338632649.png"
    garment_path = r"C:\Users\ersan\.gemini\antigravity\brain\6c5e2f06-13fd-4032-a883-05fc1bd06bdc\test_garment_1774338648351.png"
    
    with open(person_path, "rb") as f:
        p_b64 = f"data:image/png;base64,{base64.b64encode(f.read()).decode()}"
    with open(garment_path, "rb") as f:
        g_b64 = f"data:image/png;base64,{base64.b64encode(f.read()).decode()}"
        
    try:
        res = requests.post(f"{url}/api/tasks", json={"personImage": p_b64, "garmentImage": g_b64})
        print(f"Post Task: {res.status_code}")
        if res.status_code == 200:
            tid = res.json().get('taskId')
            print(f"Task Created: {tid}")
            for i in range(10):
                time.sleep(15)
                stat = requests.get(f"{url}/api/tasks/{tid}/status").json()
                print(f"[{i*15}s] Status: {stat.get('status')}")
                if stat.get('status') == 'completed':
                    print(f"✅ SUCCESS: {name} completed task!")
                    return True
        else:
            print(f"❌ FAILED: {name} returned {res.status_code}")
    except Exception as e:
        print(f"❌ ERROR: {name} - {e}")
    return False

test_space("Space 1", "https://loradre-serveloutfit.hf.space")
test_space("Space 2", "https://loradre-fashionmergerv2.hf.space")
