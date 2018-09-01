import os
from flask import Flask, render_template
import docker
from funcs import get_gpu_assigments

num_gpus = int(os.getenv('NUM_GPUS', '1'))
docker_url = os.getenv('DOCKER_URL', '/var/run/docker.sock')
docker_client = docker.DockerClient(
    base_url=docker_url,
    user_agent='GPU Dashboard 0.1.0',
    version='auto')
print("Using Docker deamon at {}".format(docker_url))

# create application
app = Flask(__name__)
logger = app.logger

@app.route(
    '/gpu_matrix.html',
    methods=['GET']
)
def serve_gpu_assigments():
    containers, gpu_assigments = get_gpu_assigments(docker_client, num_gpus)
    return render_template('gpu_matrix.html', containers=containers, assignments=gpu_assigments, num_gpus=num_gpus)
