


from typing import Any, Dict, List, Literal, Optional, Self

import yaml
from overrides import override
from pydantic import BaseModel, ConfigDict, Field

from ..app.config import config as SERVER_CONFIG
from ..docker.utils import ContainerConfigBuilder


class LanguageService(BaseModel):
    cmd: str = Field("",description="The command that starts the language server")
    languages: List[str] = Field([],description="Associated languages to the language server (see: monaco language selectors)")

class Development(BaseModel):
    ignore: str = Field("", description="A newline delimited of patterns to ignore and not to show in the editor")
    languageService: Optional[Dict[str, str | LanguageService]] = Field(None,description="Language server definitions")

class AppConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    run: str = Field("", description="The command to run the app")
    app_icon: Optional[str] = Field(None, description="Local path or URI of the app's icon", alias="appIcon")
    env: Optional[Dict[str,str]] = Field(None, description="Environment variables passed to the app")
    cli_args: Optional[List[Any]] = Field(None, alias='cliArgs', description="Command line arguments passed to the application")
    port: Optional[int] = Field(None, description="The port that the application listens on")
    proxy: Optional[bool | Literal['public']] = Field(None, description="Whether to proxy the application to the outside or not")


    def create_container_config(
        self,
        image: str,
        traefik_name: str,
        network: str,
        proxy_path: str,
        use_proxy_auth: bool = True
    ) -> ContainerConfigBuilder:
        config = ContainerConfigBuilder(image)
        config.network(network)
        if self.env:
            for key, value in self.env.items():
                config.env(key, value)
        args = self.cli_args or []
        split_args = self.run.split(' ')
        if len(split_args) > 1:
            path = split_args[0]
            cli_args = split_args[1:] + args
        config.cmd(['run', path]+ cli_args)

        if self.proxy:
            config.label('traefik.enable','true')
            config.label('traefik.docker.network', network)
            config.label(f'traefik.http.routers.{traefik_name}.rule',f'Host(`{SERVER_CONFIG.PROXY_TEMPLATE.format(hash=proxy_path)}`)')
            config.label(f'traefik.http.routers.{traefik_name}.service',traefik_name)

            if self.proxy != 'public' and use_proxy_auth:
                config.label(f'traefik.http.routers.{traefik_name}.middlewares','proxy-auth@file')

            if self.port is not None:
                config.label(f'traefik.http.services.{traefik_name}.loadbalancer.server.port',str(self.port))
            else:
                config.label(f'traefik.http.services.{traefik_name}.loadbalancer.server.port','80')
                config.env('PORT','80')
                config.env('STREAMLIT_SERVER_PORT','80')

        return config

class ServiceConfig(AppConfig):
    restart_policy: Optional[Literal['no', 'always', 'unless-stopped', 'on-failure']] = Field('always', alias='restartPolicy', description="Restart policy for the service")
    max_retry_count: Optional[int] = Field(None, alias='maxRetryCount', description="Maximum number of retries before giving up")
    cookie_auth: Optional[bool] = Field(False, alias='cookieAuth', description="Allow cookie authentication for proxied service")
    subdomain: Optional[str] = Field(None, description="Subdomain for the service.")

    @override
    def create_container_config(
        self,
        image: str,
        traefik_name: str,
        network: str,
        proxy_path: str,
        use_proxy_auth: bool = True
    ) -> ContainerConfigBuilder:
        config = super().create_container_config(image, traefik_name, network, proxy_path, use_proxy_auth)
        if self.restart_policy:
            config.restart_policy(self.restart_policy)
        if self.max_retry_count is not None:
            config.max_retry_count(self.max_retry_count)

        if self.proxy == 'public':
            config.label(f'traefik.http.routers.{traefik_name}.middlewares','apps-middleware@file')
            config.label(f'traefik.http.routers.{traefik_name}.rule',f'Host(`{SERVER_CONFIG.PROXY_TEMPLATE.format(hash=proxy_path)}`)')
        elif self.cookie_auth:
            config.label(f'traefik.http.routers.{traefik_name}.middlewares','apps-middleware@file, traefik-forward-auth@docker')
            config.label(f'traefik.http.routers.{traefik_name}.rule',f'Host(`{SERVER_CONFIG.PROXY_TEMPLATE.format(hash=proxy_path)}`)')
        else:
            config.label(f'traefik.http.routers.{traefik_name}.middlewares','apps-middleware@file')
            config.label(f'traefik.http.routers.{traefik_name}.rule',f'METHOD(`GET`) && Host(`{SERVER_CONFIG.PROXY_TEMPLATE.format(hash=proxy_path)}`)')

        return config

class SetupConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


    packages: Optional[List[str]] = Field(None, description="Extra packages installed with apt when the container boots. These packages are also installed when releases are created")
    setup_script: Optional[str] = Field(None, alias="setupScript", description="Script that is run when the container boots. Also run when release is built. (Note: This is run as a non-root user)")

class BuildConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


    cmd: str = Field(description="Command to execute for building.")
    watch: Optional[bool] = Field(None, description="Watch for file changes and rerun the build command")
    file_patterns: Optional[str] = Field(None, description="A newline delimited of patterns to watch for changes", alias="filePatterns")
    run_before_apps: Optional[bool] = Field(None, description="If true build command is executed before every app run", alias="runBeforeApps")

class WorkBenchConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


    apps: Dict[str, AppConfig] = Field({}, description="Application definitions. These are run in an interactive manner")
    services: Dict[str, ServiceConfig] = Field({}, description="Service definitions. These are run in the background as a daemon")
    development: Development = Field(Development(), description="Configuration that change the development experience")
    setup: Optional[SetupConfig] = Field(None, description="Setup options for the container")
    build: Optional[BuildConfig] = Field(None, description="Build configuration")
    networks: Optional[List[str]] = Field(None, description="List of networks to connect to")

    @staticmethod
    def yaml_dump(config: "WorkBenchConfig", stream: Optional[Any] = None) -> str:
        return yaml.dump(config.model_dump(exclude_none=True, exclude_defaults=True), stream=stream, default_flow_style=False)

    @staticmethod
    def yaml_load(stream: Any) -> "WorkBenchConfig":
        return WorkBenchConfig.model_validate(yaml.full_load(stream))

    @classmethod
    def default(cls) -> Self:
        return cls(apps={'MyApp':{'run':'python'}})
