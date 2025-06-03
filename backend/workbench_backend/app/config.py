from enum import Enum
from typing import Literal

from pydantic_settings import BaseSettings

from .custom_log import LOG_LEVEL as LOG_LEVEL_TYPE


class Env(str, Enum):
    DEV = 'DEV'
    PROD = 'PROD'
    TEST = 'TEST'
    CELERY = 'CELERY'

class Config(BaseSettings):
    ENV: Env = Env.DEV
    LOG_LEVEL: LOG_LEVEL_TYPE = 'DEBUG'
    DB_URI: str = 'postgresql+asyncpg://god:dog@localhost:5432/workbench_dev'
    REPOSITORIES_ROOT: str = '/home/bgorzsony/workbench2_repos'
    APPS_LOGO_ROOT: str = '/app_logos'
    KEYCLOAK_REALM_URL: str = 'http://auth.localhost/realms/workbench'
    KEYCLOAK_OIDC_URL: str = 'http://auth.localhost/realms/workbench/.well-known/openid-configuration'
    REDIS_BROKER_URL: str = 'redis://redis-broker:6379'
    TRAEFIK_API_URL: str = 'http://traefik:8080'
    PROXY_TEMPLATE: str = '{hash}.app.localhost'
    APPS_DOCKER_NETWORK: str = 'apps-network'
    WEBHOOK_SECRET: str = ''
    SERVICE_PROXY_TEMPLATE: str = 'http://localhost/services/{username}/{service_name}/{release_name}/'
    SCHEME: Literal['http', 'https'] = 'http'


config = Config()
