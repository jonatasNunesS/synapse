"""
Synapse - Configurações de Desenvolvimento
Herda de base.py e adiciona ferramentas de debug.
"""

from .base import *  # noqa: F401, F403

# ════════════════════════════════════════════════════════════
# DEBUG
# ════════════════════════════════════════════════════════════
DEBUG = True

# ════════════════════════════════════════════════════════════
# DEBUG TOOLBAR
# ════════════════════════════════════════════════════════════
INSTALLED_APPS += ["debug_toolbar"]  # noqa: F405

MIDDLEWARE.insert(0, "debug_toolbar.middleware.DebugToolbarMiddleware")  # noqa: F405

INTERNAL_IPS = ["127.0.0.1", "0.0.0.0", "localhost"]

DEBUG_TOOLBAR_CONFIG = {
    "SHOW_TOOLBAR_CALLBACK": lambda request: DEBUG,
}

# ════════════════════════════════════════════════════════════
# LOGGING - Mais verboso em dev
# ════════════════════════════════════════════════════════════
LOGGING["loggers"]["synapse"]["level"] = "DEBUG"  # noqa: F405
LOGGING["loggers"]["django.db.backends"] = {  # noqa: F405
    "handlers": ["console"],
    "level": "WARNING",
    "propagate": False,
}

# ════════════════════════════════════════════════════════════
# EMAIL - Console em dev
# ════════════════════════════════════════════════════════════
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# ════════════════════════════════════════════════════════════
# CORS - Permissivo em dev
# ════════════════════════════════════════════════════════════
CORS_ALLOW_ALL_ORIGINS = True
