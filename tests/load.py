import requests, time
from concurrent.futures import ThreadPoolExecutor

URL = "https://1jgh0qrgfg.execute-api.ap-southeast-2.amazonaws.com/tickets"
TEXT = "The checkout page keeps failing and I cannot pay, this is urgent and frustrating"
N = 20

print(f"=== Running Concurrent Load Test (N={N}) ===")
def send(_):
    try:
        return requests.post(URL, json={"text": TEXT}, timeout=30).status_code
    except Exception as e:
        return 500

start = time.time()
with ThreadPoolExecutor(max_workers=10) as pool:
    codes = list(pool.map(send, range(N)))

duration = round(time.time() - start, 2)
print(f"Sent {N} requests in {duration} s ({round(N/duration, 1)} req/s)")
summary = {c: codes.count(c) for c in sorted(set(codes))}
print(f"Status codes distribution: {summary}")
