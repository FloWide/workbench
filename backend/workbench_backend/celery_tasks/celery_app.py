from celery import Celery
from celery.app.task import Task

from ..app.config import config

# For working celery types: https://github.com/sbdchd/celery-types
Task.__class_getitem__ = classmethod(lambda cls, *args, **kwargs: cls) # type: ignore[attr-defined]


app = Celery('tasks', broker=config.REDIS_BROKER_URL, backend=config.REDIS_BROKER_URL)
