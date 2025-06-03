import logging
from abc import ABCMeta, abstractproperty
from pathlib import Path

import aiofiles
import yaml
from pydantic import ValidationError

from .model import WorkBenchConfig


class WorkBenchConfigMixin(metaclass=ABCMeta):

    _workbench_config: WorkBenchConfig = WorkBenchConfig.default()

    @abstractproperty
    def root_path(self) -> str:
        pass

    @property
    def workbench_config(self) -> WorkBenchConfig:
        return self._workbench_config

    async def load_workbench_config(self) -> WorkBenchConfig:
        path = Path(self.root_path) / 'workbench.yml'
        if not path.exists():
            return self._workbench_config
        try:
            async with aiofiles.open(path, 'r') as f:
                self._workbench_config = WorkBenchConfig.yaml_load(await f.read())
        except (ValidationError, yaml.error.YAMLError) as e:
            self._workbench_config = WorkBenchConfig.default()
            logging.error("Failed to parse workbench.yml", exc_info=e)
        return self._workbench_config

    async def write_workbench_config(self) -> None:
        path = Path(self.root_path) / 'workbench.yml'
        if not path.exists() or not self._workbench_config:
            return
        async with aiofiles.open(path, 'w') as f:
            await f.write(WorkBenchConfig.yaml_dump(self._workbench_config))
