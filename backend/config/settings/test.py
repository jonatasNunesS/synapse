"""
Synapse - Configurações de Teste
Usa SQLite em memória para testes rápidos sem PostgreSQL.
"""

from .base import *  # noqa: F401, F403

# ════════════════════════════════════════════════════════════
# BANCO DE DADOS - SQLite em memória para testes
# ════════════════════════════════════════════════════════════
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# ════════════════════════════════════════════════════════════
# CACHE - Local memory para testes
# ════════════════════════════════════════════════════════════
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "synapse-test",
    }
}

# ════════════════════════════════════════════════════════════
# CELERY - Síncrono em testes
# ════════════════════════════════════════════════════════════
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# ════════════════════════════════════════════════════════════
# SENHAS - Hasher rápido para testes
# ════════════════════════════════════════════════════════════
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# ════════════════════════════════════════════════════════════
# DEBUG TOOLBAR - Desabilitado em testes
# ════════════════════════════════════════════════════════════
DEBUG = False  # Garante que debug_toolbar não seja carregado nas URLs
INSTALLED_APPS = [app for app in INSTALLED_APPS if app != "debug_toolbar"]  # noqa: F405
MIDDLEWARE = [m for m in MIDDLEWARE if "debug_toolbar" not in m]  # noqa: F405

# ════════════════════════════════════════════════════════════
# LOGGING - Silencioso em testes
# ════════════════════════════════════════════════════════════
LOGGING = {
    "version": 1,
    "disable_existing_loggers": True,
    "handlers": {
        "null": {
            "class": "logging.NullHandler",
        },
    },
    "root": {
        "handlers": ["null"],
        "level": "CRITICAL",
    },
}
