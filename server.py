import os
from gpudash import app

ip = os.getenv('BIND_IP', '0.0.0.0')
port = int(os.getenv('BIND_PORT', 80))

print("Starting server on {} port {}".format(ip, port))
app.run(host=ip, port=port, debug=True)
