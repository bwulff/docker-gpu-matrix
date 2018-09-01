import os
from flask import Flask, render_template
import docker
from funcs import get_gpu_assigments

num_gpus = int(os.getenv('NUM_GPUS', '1'))
docker_client = docker.DockerClient(
    base_url=os.getenv('DOCKER_URL', '/var/run/docker.sock'),
    user_agent='GPU Dashboard 0.1.0',
    version='auto')

# create application
app = Flask(__name__)
logger = app.logger

@app.route(
    '/gpu_assigments.html',
    methods=['GET']
)
def serve_gpu_assigments():
    containers, gpu_assigments = get_gpu_assigments(docker_client, num_gpus)
    return render_template('gpu_matrix.html', containers=containers, assigments=gpu_assigments, num_gpus=num_gpus)
