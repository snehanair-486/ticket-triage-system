import requests

BASE = "https://1jgh0qrgfg.execute-api.ap-southeast-2.amazonaws.com"

tests = [
    ("angry checkout", "My checkout is broken and I have been trying for an hour, this is really frustrating", [201, 202]),
    ("app crash", "The app crashes every time I log in, this is unacceptable", [201, 202]),
    ("simple question", "How do I change my email address?", [201, 202]),
    ("happy", "Thanks, the refund arrived quickly!", [201, 202]),
    ("empty", "", [400]),
    ("too long", "x" * 3000, [400]),
]

print("=== Running Functional Test Suite ===")
results = []
for name, text, expected_codes in tests:
    try:
        r = requests.post(BASE + "/tickets", json={"text": text}, timeout=30)
        status = "PASS" if r.status_code in expected_codes else "FAIL"
        results.append((name, status, r.status_code, r.text[:80]))
        print(f"[{status}] {name} (got {r.status_code}): {r.text[:80]}")
    except Exception as e:
        print(f"[FAIL] {name}: {e}")

try:
    r = requests.get(BASE + "/tickets/does-not-exist", timeout=30)
    status = "PASS" if r.status_code == 404 else "FAIL"
    print(f"[{status}] missing ticket 404 check (got {r.status_code})")
except Exception as e:
    print(f"[FAIL] missing ticket check: {e}")

try:
    r = requests.post(BASE + "/tickets", data="not json", headers={"Content-Type": "application/json"}, timeout=30)
    status = "PASS" if r.status_code == 400 else "FAIL"
    print(f"[{status}] invalid json check (got {r.status_code})")
except Exception as e:
    print(f"[FAIL] invalid json check: {e}")
