import socket
import time

def send_test_data():
    HOST = '127.0.0.1'
    PORT = 5001
    
    test_data = [
        "CT01_13,1,MINI10438,1894,20:26:41.07,1,1085B1,2\n",
        "CT01_13,2,MINI10438,1908,20:26:42.18,1,1085B1,4\n",
        "CT01_13,3,MINI10438,2073,20:26:42.66,1,1085B1,4\n",
        "CT01_13,4,MINI10438,2074,20:26:42.88,1,1085B1,4\n",
        "CT01_13,5,MINI10438,1983,20:26:43.39,1,1085B1,4\n"
    ]
    
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.connect((HOST, PORT))
        print(f"Connected to {HOST}:{PORT}")
        
        for line in test_data:
            s.sendall(line.encode('utf-8'))
            print(f"Sent: {line.strip()}")
            time.sleep(1)  # Wait 1 second between sends
            
        # Keep connection open
        while True:
            time.sleep(1)

if __name__ == "__main__":
    send_test_data()