from typing import Any

from fastapi import APIRouter

from ...workbench_config.model import WorkBenchConfig

router = APIRouter(
    prefix='/schemas',
    tags=["Schemas"]
)


@router.get('/workbench.schema')
def workbench_config_schema() -> Any:
    return WorkBenchConfig.model_json_schema()
