import subprocess
import sys
from pathlib import Path
from typing import Any, List, Optional

import yaml


def install_pyproject() -> Optional[int]:
    if not Path('pyproject.toml').exists():
        return None
    proc = subprocess.run(['poetry','install'])
    return proc.returncode

def install_node_modules() -> Optional[int]:
    if not Path('package.json').exists():
        return None
    proc = subprocess.run(['npm','install'])
    return proc.returncode

def install_extra_packages(packages: List[str]) -> int:
    proc = subprocess.run(['apt-get','-y','update'])
    if proc.returncode != 0:
        return proc.returncode
    proc = subprocess.run(['apt-get','-y','install']+packages)
    return proc.returncode

def run_script(script: str) -> int:
    proc = subprocess.run(['bash','-c',script])
    return proc.returncode


def main() -> None:
    workbench_config = Path('workbench.yml')
    if not workbench_config.exists() or not workbench_config.is_file():
        sys.exit(1)
    install_pyproject()
    install_node_modules()

    with open(workbench_config,'r') as f:
        config: dict[str, Any] = yaml.full_load(f)

    if (packages := config.get('setup',{}).get('packages')):
        install_extra_packages(packages)

    if (setup_script := config.get('setup',{}).get('setupScript')):
        run_script(setup_script)

    if (build_script := config.get('build', {}).get('cmd')):
        run_script(build_script)
