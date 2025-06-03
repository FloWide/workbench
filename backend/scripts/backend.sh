#!/bin/bash

poetry run alembic upgrade head

poetry run uvicorn workbench_backend:app --host 0.0.0.0 --port 80