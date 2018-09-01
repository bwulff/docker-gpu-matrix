
def get_gpu_assigments(docker_client, num_gpus):
    containers = docker_client.containers.list(all=True)
    assignments = {}
    for container in containers:
        assignments[container.short_id] = [0] * num_gpus
        for var in container.attrs['Config']['Env']:
    		if var.startswith('NVIDIA_VISIBLE_DEVICES'):
    			val = var.split('=', 1)[1]
                if val == 'all':
                    assignments[container.short_id] = [1] * num_gpus
                else:
                    for gpu in val.split(','):
                        gpu_num = int(gpu.strip())
                        assignments[container.short_id][gpu_num] = 1
    return containers, assignments
