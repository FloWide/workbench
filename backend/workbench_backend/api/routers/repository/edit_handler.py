

import asyncio
import fnmatch
import hashlib
import logging
import os
import uuid
from typing import (
    Any,
    Awaitable,
    Callable,
    Dict,
    List,
    Optional,
    Sequence,
    Tuple,
    TypedDict,
    cast,
)

import watchfiles
from aiodocker.execs import Exec
from aiodocker.stream import Stream
from deepdiff import DeepDiff  # type: ignore
from watchfiles.main import FileChange

from ....app.config import config as app_config
from ....db.models.repository import Repository
from ....db.models.user import User
from ....docker.edit_utils import (
    EditorContainer,
    EditStreamHandler,
    LspServiceHandler,
    Notification,
    Process,
)
from ....git import EditableRepository
from ....jsonrpc import jsonrpc
from ....utils.proxy import ProxyService
from ....utils.session_manager import SessionManager
from ....workbench_config.model import AppConfig


class FileChangeResult(TypedDict):
    change: str
    path: str
    name: str
    isDirectory: bool

def short_id() -> str:
    return str(uuid.uuid4())[:8]

class EditorRpc(jsonrpc.JsonRpc):

    def __init__(
        self,
        session_manager: SessionManager,
        session_id: str,
        repo: Repository,
        user: User
    ) -> None:
        super().__init__()
        self._session_id = session_id
        self._session_manager = session_manager
        self._repo = repo
        self._user = user
        self._edit_container = EditorContainer(repo,self._user)
        self._process_streams: Dict[int, EditStreamHandler] = {}
        self._proxy = ProxyService()
        self._process_ports: Dict[int, List[int]] = {}
        self._app_process_map: Dict[str, Process] = {}
        self._task_execs: Dict[str, Exec] = {}
        self._lsp_service: Optional[LspServiceHandler] = None
        self._editable_repo: EditableRepository

    async def init(self) -> None:
        await self.notify('status', state='starting')
        try:
            self._editable_repo = await self._repo.get_editable_repo()
            await self.notify('status', state='starting', message="Booting up container")
            await self._editable_repo.load_workbench_config()
            await self.notify('workbench_config_changed', config=self._editable_repo.workbench_config.model_dump())
            await self._edit_container.start()
            await self._handle_network_connections()
            if not self._edit_container.using_existing_container:
                await self.notify('status', state='starting', message="Setting up container")
                await self.install_extra_packages()
                await self.run_setup_script()
                if self._editable_repo.file_exists('pyproject.toml'):
                    await self._run_task('poetry',['poetry','install'],tty=False)
            else:
                await self.notify('status', state='starting', message='Using existing container')

            await self.notify('status', state='starting', message="Starting services")
            self._file_watcher_task = asyncio.create_task(self._file_watcher())
            self._notif_listener = self._edit_container.process_manager.on_notification(self._notif_handler)
            await self._start_language_service()


            await self.notify('status', state='ready')
        except Exception as e:
            await self.notify('status',state='error', error=str(e))

    async def close(self) -> None:
        await self._edit_container.close()
        await self._proxy.close()
        for _id, stream in self._process_streams.items():
            stream.stop()
        if self._lsp_service:
            await self._lsp_service.stop()
        self._file_watcher_task.cancel()
        self._notif_listener.dispose()

    async def _notif_handler(self, notif: Notification) -> None:
        logging.debug(f'Edit notification {notif}')
        try:
            if notif.type == 'PROCESS_EXITED':
                if notif.pid in self._process_streams:
                    self._process_streams[notif.pid].stop()
                    del self._process_streams[notif.pid]
                if notif.pid in self._process_ports:
                    await self._handle_proxy_close(notif.pid)
                    del self._process_ports[notif.pid]

                for app in list(self._app_process_map.keys()):
                    if self._app_process_map[app].pid == notif.pid:
                        del self._app_process_map[app]

            elif notif.type == 'CHILD_PROCESS_EXITED':
                await self._handle_proxy_close(notif.data.get('pid'))
                if (cpid := notif.data.get('pid')):
                    if cpid in self._process_ports:
                        del self._process_ports[cpid]
            elif notif.type == 'PORTS_CHANGED':
                assert notif.pid
                self._process_ports[notif.pid] = notif.data
                await self._handle_proxying(notif)
            await self.notify(notif.type,**notif.model_dump())
        except Exception as e:
            logging.error('Notif error', exc_info=e)

    def _hash_open_port(self, pid: int, port: int) -> bytes:
        hash = hashlib.sha1(bytes(self._repo.id))
        hash.update(bytes(pid))
        hash.update(bytes(port))
        hash.update(self._session_id.encode())
        return hash.digest()

    async def _handle_proxying(self, notif: Notification) -> None:
        ports: List[int] = notif.data
        for port in ports:
            if port < 8000 or port >= 9000:
                continue
            assert notif.pid
            name = self._hash_open_port(notif.pid, port).hex()
            url = await self._proxy.new_service(name,self._edit_container.ip,port)
            await self._session_manager.add_proxy_hash_to_session(self._session_id, name)
            await self.notify("proxy_opened", pid=notif.pid, port=port, url=url)

    async def _handle_proxy_close(self, pid: int) -> None:
        try:
            if not (ports := self._process_ports.get(pid)):
                return
            for port in ports:
                name = self._hash_open_port(pid, port).hex()
                await self._proxy.remove_service(name)
                await self._session_manager.remove_proxy_hash_from_session(self._session_id, name)
                await self.notify("proxy_closed", pid=pid, port=port)
        except Exception as e:
            logging.warning("Proxy close error",exc_info=e)

    async def _cmd_exec_output(self, cmd: str | Sequence[str], workdir: Optional[str] = None, user: Optional[str] = None,**kwargs: Any) -> Tuple[str, str]:
        if not user:
            user = 'root' if 'god' in self._user.permissions else 'runner'
        exec = await self._edit_container.container.exec(cmd, workdir=workdir, user=user, **kwargs)
        stream: Stream = exec.start(detach=False)
        content_stdout = ''
        content_stderr = ''
        async with stream as s:
            while (msg := await s.read_out()) is not None:
                if msg.stream == 1:
                    content_stdout += msg.data.decode()
                elif msg.stream == 2:
                    content_stderr += msg.data.decode()
        await exec.inspect()
        return content_stdout, content_stderr

    async def _cmd_exec_stream(self, id: str,cmd: str | Sequence[str], stream_callback: Callable[[str], Awaitable[None]] , workdir: Optional[str] = None, user: Optional[str] = None,tty: bool = True, **kwargs: Any) -> int:
        if not user:
            user = 'root' if 'god' in self._user.permissions else 'runner'
        exec = await self._edit_container.container.exec(cmd,tty=tty,workdir=workdir,user=user,**kwargs)
        self._task_execs[id] = exec
        stream: Stream = exec.start(detach=False)
        async with stream as s:
            while (msg := await s.read_out()) is not None:
                await stream_callback(msg.data.decode())
        inspect = await exec.inspect()
        del self._task_execs[id]
        return cast(int,inspect['ExitCode'])

    async def _file_watcher(self) -> None:
        def _transform(change: FileChange) -> FileChangeResult:
            return {
                "change":change[0].raw_str(),
                "path":os.path.relpath(change[1], self._repo.path()),
                "name":os.path.basename(change[1]),
                "isDirectory":os.path.isdir(change[1])
            }
        try:
            stop_event = asyncio.Event()
            async for changes in watchfiles.awatch(self._repo.path(), stop_event=stop_event):
                try:
                    file_changes = list(map(_transform,changes))
                    if next((item for item in file_changes if item["path"] == "workbench.yml"), None):
                        await self._on_workbench_config_changed()

                    for file_change in file_changes:
                        if self._is_build_watched_file(file_change["path"]):
                            await self._on_build_files_changed()
                            break

                    await self.notify("file_changes",file_changes)
                except Exception as e:
                    logging.error("File watcher error",exc_info=e)
        except asyncio.CancelledError:
            stop_event.set()
            logging.info("File watcher stopped")
            return
        except Exception as e:
            logging.error("File watcher error", exc_info=e)

    async def _start_language_service(self) -> None:
        config = self._editable_repo.workbench_config.development.languageService
        if not config:
            return
        if self._lsp_service:
            await self._lsp_service.stop()

        startArgs: Dict[str, str] = {}
        for name, value in config.items():
            if isinstance(value, str):
                startArgs[name] = value
            else:
                startArgs[name] = value.cmd
        self._lsp_service = await self._edit_container.process_manager.startLspService(startArgs)
        await self.notify('lsp_service_started')

    async def _on_workbench_config_changed(self) -> None:
        try:
            old = self._editable_repo.workbench_config.copy(deep=True)
            await self._editable_repo.load_workbench_config()
            await self.notify('workbench_config_changed', config=self._editable_repo.workbench_config.model_dump())
            diff = DeepDiff(old,self._editable_repo.workbench_config)
            affected_path: str
            for affected_path in diff.affected_paths:
                if affected_path.startswith("root.development.languageService"):
                    logging.info("Language service definition changed. Restarting...")
                    asyncio.create_task(self._start_language_service())
                elif affected_path.startswith('root.setup.packages'):
                    logging.info("Installing extra packages")
                    asyncio.create_task(self.install_extra_packages())
                elif affected_path.startswith('root.setup.setup_script'):
                    asyncio.create_task(self.run_setup_script())
                elif affected_path.startswith('root.networks'):
                    asyncio.create_task(self._handle_network_connections())
        except Exception as e:
            logging.error("Workbench config changed error", exc_info=e)

    def _is_build_watched_file(self,path: str) -> bool:
        workbench_config = self._editable_repo.workbench_config
        if not workbench_config.build:
            return False
        if (not workbench_config.build.watch or
            not workbench_config.build.file_patterns):
            return False
        patterns = workbench_config.build.file_patterns.splitlines()
        for pattern in patterns:
            if fnmatch.fnmatch(path, pattern):
                return True
        return False

    async def _handle_network_connections(self) -> None:

        async def disconnect(n: str) -> None:
            if await self._edit_container.disconnect_from_network(n):
                await self.notify('network_disconnected',name=n)

        async def connect(n: str) -> None:
            if await self._edit_container.connect_to_network(n):
                ip = await self._edit_container.get_network_ip(n)
                await self.notify('network_connected', name=n, ip=ip)

        networks = self._editable_repo.workbench_config.networks or []
        connected_networks = await self._edit_container.get_networks()
        connected_networks.remove(app_config.APPS_DOCKER_NETWORK)
        await asyncio.gather(*[
                disconnect(n) for n in connected_networks
            ])
        if not networks:
            return
        await asyncio.gather(*[
            connect(n) for n in networks
        ])


    async def _on_build_files_changed(self) -> None:
        logging.info("Build watched files changed. Running build")
        await self.run_build()

    async def _run_task(self, name: str, cmd: str | Sequence[str], workdir: Optional[str] = None, user: Optional[str] = None, **kwargs: Any) -> int:
        id = short_id()
        async def callback(data: str) -> None:
            await self.notify('on_task_stream', id=id, name=name, data=data)
        await self.notify('task_started', id=id, name=name)
        exit_code = await self._cmd_exec_stream(id, cmd, callback, workdir=workdir, user=user,**kwargs )
        await self.notify('task_finished', id=id, name=name, exit_code=exit_code)
        return exit_code

    @jsonrpc.register
    async def run_build(self) -> Optional[int]:
        if not self._editable_repo.workbench_config.build:
            return None
        cmd = self._editable_repo.workbench_config.build.cmd
        if not cmd:
            return None
        return await self._run_task('build',["bash", "-c", cmd])

    @jsonrpc.register
    async def install_extra_packages(self) -> Optional[int]:
        if not self._editable_repo.workbench_config.setup:
            return None
        packages = self._editable_repo.workbench_config.setup.packages
        if not packages or len(packages) == 0:
            return None
        logging.info("Running package install")
        await self._run_task('package_install', ["apt-get","-y","update"], user='root')
        exit_code = await self._run_task('package_install',["apt-get", "-y", "install"] + packages, user='root')
        logging.info("Running package install finished")
        return exit_code

    @jsonrpc.register
    async def run_setup_script(self) -> Optional[int]:
        if not self._editable_repo.workbench_config.setup:
            return None
        script = self._editable_repo.workbench_config.setup.setup_script
        if not script:
            return None
        logging.info("Running setup script")
        exit_code = await self._run_task('setup_script',["bash", "-c", script])
        logging.info("Running setup script finished")
        return exit_code


    @jsonrpc.register
    async def open_proxy(self, pid: int, port: int) -> Optional[str]:
        if not (ports := self._process_ports.get(pid)):
            raise RuntimeError(f"No such process with given PID: {pid}")
        if port not in ports:
            raise RuntimeError(f"Process {pid} has no open port {port}")
        name = self._hash_open_port(pid, port).hex()
        url = await self._proxy.new_service(name, self._edit_container.ip, port)
        await self.notify("proxy_opened", pid=pid, port=port, url=url)
        return url

    @jsonrpc.register
    async def list_dir(self, *args: Any, **kwargs: Any) -> Any:
        return await self._editable_repo.list_dir(*args,**kwargs)

    @jsonrpc.register
    async def get_processes(self) -> Dict[int, Process]:
        return self._edit_container.process_manager.processes

    @jsonrpc.register
    async def get_git_status(self) -> Dict[str, str]:
        return await self._editable_repo.status()

    @jsonrpc.register
    async def get_file_content(self, path: str) -> str:
        out, err = await self._cmd_exec_output(['cat', path])
        if err:
            raise Exception(err)
        return out

    @jsonrpc.register
    async def get_base64_file_content(self, path: str) -> str:
        out, err = await self._cmd_exec_output(['base64', path])
        if err:
            raise Exception(err)
        return out

    @jsonrpc.register
    async def get_cwd(self) -> str:
        out, err = await self._cmd_exec_output("pwd")
        if err:
            raise Exception(err)
        return out.replace('\n', '')

    @jsonrpc.register
    async def create_file(self, *args: Any, **kwargs: Any) -> Any:
        return await self._editable_repo.create_file(*args, **kwargs)

    @jsonrpc.register
    async def update_file(self, *args: Any, **kwargs: Any) -> Any:
        return await self._editable_repo.update_file(*args, **kwargs)

    @jsonrpc.register
    async def delete_file(self,*args: Any, **kwargs: Any) -> Any:
        return await self._editable_repo.delete(*args,**kwargs)

    @jsonrpc.register
    async def move_file(self,*args: Any, **kwargs: Any) -> Any:
        return await self._editable_repo.move_file(*args, **kwargs)

    @jsonrpc.register
    async def copy_file(self,*args: Any, **kwargs: Any) -> Any:
        return await self._editable_repo.copy_file(*args, **kwargs)

    @jsonrpc.register
    async def make_dir(self,*args: Any, **kwargs: Any) -> Any:
        return await self._editable_repo.mkdir(*args, **kwargs)

    @jsonrpc.register
    async def run(
        self,
        path: str,
        args: Optional[List[str]] = None,
        **kwargs: Any
    ) -> Process:
        if not args:
            args = []
        split_path = path.split(' ')
        if len(split_path) > 1:
            path = split_path[0]
            args = split_path[1:] + args
        proc = await self._edit_container.process_manager.run(
            cmd='run',
            args=[path] + args,
            **kwargs
        )
        async def _on_receive(data: str | bytes) -> None:
            await self.notify('on_stream',pid=proc.pid, data=data)
        stream_handler = EditStreamHandler(
            self._edit_container.process_manager.get_attach_url(proc.pid),
            _on_receive
        )
        stream_handler.start()
        await stream_handler.ready()
        self._process_streams[proc.pid] = stream_handler
        return proc

    @jsonrpc.register
    async def stream_write(self, pid: int, data: Any) -> None:
        stream_handler = self._process_streams.get(pid)
        if not stream_handler:
            raise Exception("No such process")
        else:
            await stream_handler.send(data)

    @jsonrpc.register
    async def kill(self,*args: Any) -> Any:
        return await self._edit_container.process_manager.kill(*args)

    @jsonrpc.register
    async def resize(self, id: int, cols: int, rows: int) -> None:
        if str(id) in self._task_execs:
            await self._task_execs[str(id)].resize(h=rows, w=cols)
        else:
            await self._edit_container.process_manager.resize(id,cols,rows)

    @jsonrpc.register
    async def connect_to_lsp(self, lang: str) -> None:
        assert self._lsp_service
        async def on_receive(data: Any) -> None:
            await self.notify('on_lsp_stream',lang=lang, data=data)
        await self._lsp_service.connect(on_receive=on_receive, lang=lang)

    @jsonrpc.register
    async def lsp_write(self, lang: str, data: Any) -> None:
        assert self._lsp_service
        await self._lsp_service.send(lang, data)

    @jsonrpc.register
    async def run_app_or_service(self, name: str) -> Optional[Process]:
        config: AppConfig

        if name in self._app_process_map:
            await self.kill(self._app_process_map[name].pid)
            del self._app_process_map[name]
        workbench_config = self._editable_repo.workbench_config
        if name in workbench_config.apps:
            config = workbench_config.apps[name]
        elif name in workbench_config.services:
            config = workbench_config.services[name]
        else:
            raise Exception(f"No app or service with name {name}")

        if workbench_config.build and workbench_config.build.run_before_apps:
            if await self.run_build() != 0:
                return None

        proc = await self.run(
            config.run,
            config.cli_args,
            env=config.env
        )
        self._app_process_map[name] = proc
        return cast(Process,proc)
