#!/bin/bash

poetry run celery -A workbench_backend.celery_tasks.celery_app worker --loglevel=DEBUG
