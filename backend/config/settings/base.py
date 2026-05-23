"""
Synapse - Configurações Base
Configurações comuns a todos os ambientes (dev, prod).
"""

import os
from datetime import timedelta
from pathlib import Path

from decouple import Csv, config

# ════════════════════════════════════════════════════════════
# PATHS
# ════════════════════════════════════════════════════════════
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# ════════════════════════════════════════════════════════════
# SEGURANÇA
# ════════════════════════════════════════════════════════════
SECRET_KEY = config("DJANGO_SECRET_KEY")
DEBUG = config("DJANGO_DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = config("DJANGO_ALLOWED_HOSTS", default="localhost,backend", cast=Csv())


# ════════════════════════════════════════════════════════════
# APLICAÇÕES
# ════════════════════════════════════════════════════════════
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
]

LOCAL_APPS = [
    "modules.auth",
    "modules.financeiro",
    "modules.estoque",
    "modules.clientes",
    "modules.fornecedores",
    "modules.projetos",
    "modules.notificacoes",
    "modules.equipe",
    "modules.documentos",
    "modules.dashboard",
    "modules.ai_hub",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ════════════════════════════════════════════════════════════
# MIDDLEWARE
# ════════════════════════════════════════════════════════════
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "shared.middleware.RequestLoggingMiddleware",
]

ROOT_URLCONF = "config.urls"

# ════════════════════════════════════════════════════════════
# TEMPLATES
# ════════════════════════════════════════════════════════════
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ════════════════════════════════════════════════════════════
# BANCO DE DADOS
# ════════════════════════════════════════════════════════════
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("POSTGRES_DB", default="synapse"),
        "USER": config("POSTGRES_USER", default="synapse"),
        "PASSWORD": config("POSTGRES_PASSWORD", default="synapse_dev_2026"),
        "HOST": config("POSTGRES_HOST", default="postgres"),
        "PORT": config("POSTGRES_PORT", default="5432"),
        "OPTIONS": {
            "connect_timeout": 5,
        },
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ════════════════════════════════════════════════════════════
# AUTENTICAÇÃO
# ════════════════════════════════════════════════════════════
AUTH_USER_MODEL = "synapse_auth.CustomUser"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ════════════════════════════════════════════════════════════
# JWT (Simple JWT)
# ════════════════════════════════════════════════════════════
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_COOKIE": "access_token",
    "AUTH_COOKIE_HTTP_ONLY": True,
    "AUTH_COOKIE_SECURE": False,  # True em produção
    "AUTH_COOKIE_SAMESITE": "Lax",
    "AUTH_COOKIE_PATH": "/",
}

# ════════════════════════════════════════════════════════════
# REST FRAMEWORK
# ════════════════════════════════════════════════════════════
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "shared.authentication.CookieJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "shared.pagination.StandardPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "EXCEPTION_HANDLER": "shared.exceptions.custom_exception_handler",
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
}

# ════════════════════════════════════════════════════════════
# REDIS E CACHE
# ════════════════════════════════════════════════════════════
REDIS_URL = config("REDIS_URL", default="redis://redis:6379/0")

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
        "KEY_PREFIX": "synapse",
        "TIMEOUT": 300,  # 5 minutos padrão
    }
}

# ════════════════════════════════════════════════════════════
# CELERY
# ════════════════════════════════════════════════════════════
CELERY_BROKER_URL = config("CELERY_BROKER_URL", default="redis://redis:6379/1")
CELERY_RESULT_BACKEND = config("CELERY_RESULT_BACKEND", default="redis://redis:6379/2")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "America/Sao_Paulo"
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 300  # 5 minutos
CELERY_TASK_SOFT_TIME_LIMIT = 240  # 4 minutos
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_DEFAULT_RETRY_DELAY = 60  # 1 minuto
CELERY_TASK_MAX_RETRIES = 3

# ════════════════════════════════════════════════════════════
# CORS
# ════════════════════════════════════════════════════════════
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:3000",
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = True

# ════════════════════════════════════════════════════════════
# INTERNACIONALIZAÇÃO
# ════════════════════════════════════════════════════════════
LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

# ════════════════════════════════════════════════════════════
# ARQUIVOS ESTÁTICOS E MÍDIA
# ════════════════════════════════════════════════════════════
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# ════════════════════════════════════════════════════════════
# LOGGING (JSON Estruturado)
# ════════════════════════════════════════════════════════════
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.json.JsonFormatter",
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
            "rename_fields": {
                "asctime": "timestamp",
                "levelname": "level",
                "name": "logger",
            },
        },
        "simple": {
            "format": "[{asctime}] {levelname} {name}: {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
        "file": {
            "class": "logging.FileHandler",
            "filename": BASE_DIR / "logs" / "synapse.log",
            "formatter": "json",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "synapse": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
        "celery": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}

# ════════════════════════════════════════════════════════════
# EMAIL (Resend)
# ════════════════════════════════════════════════════════════
RESEND_API_KEY = config("RESEND_API_KEY", default="")
DEFAULT_FROM_EMAIL = "Synapse <noreply@synapse.app>"

# ════════════════════════════════════════════════════════════
# IA (Groq) - Placeholder para M9
# ════════════════════════════════════════════════════════════
GROQ_API_KEY = config("GROQ_API_KEY", default="")
