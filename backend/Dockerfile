FROM nikolaik/python-nodejs:python3.11-nodejs20-bullseye

ARG HTTP_PROXY
ARG HTTPS_PROXY

WORKDIR /app

COPY . .

RUN poetry install --no-root --no-interaction --no-ansi

ENTRYPOINT [ "./scripts/docker_entrypoint.sh" ]

CMD [ "./scripts/backend.sh" ]