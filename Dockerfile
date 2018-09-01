FROM python:2.7-alpine3.6
ENV PYTHONUNBUFFERED 1

# main application living in /app
RUN mkdir /app
WORKDIR /app

# install app
ADD . /app/
RUN pip install -r /app/requirements.txt
RUN rm -rf /app/.git

EXPOSE 80
ENV NUM_GPUS=1
ENV BIND_IP=0.0.0.0
ENV BIND_PORT=80
ENV DOCKER_URL=unix://tmp/docker.sock

CMD ["python", "/app/server.py"]
