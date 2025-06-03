import functools
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Callable, Dict, List, NoReturn

STREAMLIT_IMPORT_REGEX = re.compile('((import)|(from)) +streamlit')

def is_poetry_env() -> bool:
    proc = subprocess.run(['poetry','env','info'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return proc.returncode == 0

def npx_which(cmd: str) -> str | None:
    proc = subprocess.run(['npx','--yes','which', cmd], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        return None
    return proc.stdout.decode().strip()

def generic_interpreter(interpreter: str, file_path: str, args: List[str]) -> NoReturn:
    try:
        if is_poetry_env():
            os.execv(shutil.which("poetry"), ["poetry","run",interpreter, file_path] + args ) # type: ignore
        else:
            os.execv(shutil.which(interpreter),[interpreter,file_path] + args) # type: ignore
    except OSError as e:
        print(f"Failed to run `{file_path}` with interpreter `{interpreter}` \n {str(e)} ")
        sys.exit(1)

def run_streamlit(file_path: str, args: List[str]) -> NoReturn:
    try:
        if is_poetry_env():
            os.execv(shutil.which("poetry"), ["poetry","run", "python", "-m", "streamlit", "run", file_path] + args) # type: ignore
        else:
            os.execv(shutil.which("streamlit"), ["streamlit", "run", file_path] + args) # type: ignore
    except OSError as e:
        print(f"Failed to run Streamlit app: {e}")
        sys.exit(1)

def run_python(file_path: str, args: List[str]) -> NoReturn:
    if check_file_content_for_streamlit(file_path):
        run_streamlit(file_path,args)
    generic_interpreter("python", file_path, args)

INTERPRETERS: Dict[str, Callable[[str, List[str]], None]] = {
    ".py": run_python,
    ".sh": functools.partial(generic_interpreter, "bash"),
    ".js": functools.partial(generic_interpreter, "node"),
    ".html": functools.partial(generic_interpreter, "http-server"),
    ".ts":functools.partial(generic_interpreter, "ts-node")
}

def check_file_content_for_streamlit(file_path: str) -> bool:
    try:
        with open(file_path, "r") as file:
            content = file.read()
            return STREAMLIT_IMPORT_REGEX.search(content) # type: ignore
    except Exception as e:
        print(f"An error occurred: {e}")
        return False

def run_smart(file_path: str, args: List[str]) -> NoReturn:
    _, extension = os.path.splitext(file_path)

    if os.access(file_path,os.X_OK):
        try:
            os.execv(file_path,[file_path]+args)
        except OSError as e:
            print(f"Failed to run executable file: {file_path}\n{str(e)}")
            sys.exit(1)

    func = INTERPRETERS.get(extension)
    if not func:
        print(f"Cannot run {file_path}")
        sys.exit(1)
    func(file_path,args)

def handle_command(path: str, args: List[str]) -> NoReturn:
    if is_poetry_env():
        os.execv(shutil.which("poetry"), ["poetry", "run", path] + args ) # type: ignore
    else:
        executable_path = shutil.which(path)
        if executable_path:
            try:
                os.execv(executable_path, [executable_path] + args)
            except OSError as e:
                print(f"Failed to execute executable: {e}")
                sys.exit(1)
        elif (npx_path := npx_which(path)):
            try:
                os.execv(npx_path, [npx_path]+args)
            except OSError as e:
                print(f"Failed to execute executable: {e}")
                sys.exit(1)
        else:
            print("Path not found or invalid.")
            sys.exit(1)

def run_smart_runner(path: str, args: List[str]) -> NoReturn:
    path_obj = Path(path)
    if path_obj.is_file():
        run_smart(str(path_obj), args)
    if path_obj.is_dir():
        generic_interpreter("http-server", str(path_obj), args)
    else:
        handle_command(path, args)

def main() -> NoReturn:
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <path> [args]")
        sys.exit(1)

    target_path = sys.argv[1]
    args = sys.argv[2:]

    run_smart_runner(target_path, args)
