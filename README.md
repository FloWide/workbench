# FloWide Workbench

FloWide Workbench allows you to develop and manage python and javascript based applications or services in a web based IDE.

## Deployment

1. Clone the repository
2. Create `.env` based on the template `.env.tmpl`
3. (Optional) If updating run `docker compose down` and then `docker compose up --build --no-cache`
4. Run `docker compose up -d` and wait for containers to start up
5. Enter workbench backend container `docker exec -it workbench_backend bash`
    1. Build base images by running `poetry run python build_base_images.py`

## Development

Development is done through devcontainers. You can open the devcontainer for backend or frontend in VSCode by using the command palette (Ctrl+Shift+P) and selecting "Dev Containers: Reopen in container". This will build the container and set up the environment for development.
