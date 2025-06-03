import glob
import importlib
from pathlib import Path

from fastapi import APIRouter

api_router = APIRouter()

for file in glob.iglob("*",root_dir=Path(__file__).parent / 'routers'):
    if file.startswith('_'):
        continue
    name = Path(file).stem
    try:
        module = importlib.import_module(f'.routers.{name}', package=__package__)
        if hasattr(module,'router'):
            api_router.include_router(module.router)
            print(f"Dynamically loaded router from module {module.__name__}")
    except ImportError as e:
        raise e
    except Exception as e:
        raise e


__all__ = [
    'api_router'
]

