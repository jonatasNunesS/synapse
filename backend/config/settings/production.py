"""
Synapse - Configurações de Produção
Herda de base.py e aplica hardening de segurança.
"""

from decouple import config

from .base import *  # noqa: F401, F403

# ════════════════════════════════════════════════════════════
# SEGURANÇA
# ════════════════════════════════════════════════════════════
DEBUG = False

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=True, cast=bool)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = "DENY"

SIMPLE_JWT["AUTH_COOKIE_SECURE"] = True  # noqa: F405

# ════════════════════════════════════════════════════════════
# LOGGING - Menos verboso em prod
# ════════════════════════════════════════════════════════════
LOGGING["loggers"]["synapse"]["level"] = "INFO"  # noqa: F405
LOGGING["root"]["level"] = "WARNING"  # noqa: F405

# ════════════════════════════════════════════════════════════
# SENTRY (quando configurado)
# ════════════════════════════════════════════════════════════
SENTRY_DSN = config("SENTRY_DSN", default="")

if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.redis import RedisIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[
            DjangoIntegration(),
            CeleryIntegration(),
            RedisIntegration(),
        ],
        traces_sample_rate=0.1,
        send_default_pii=False,
        environment="production",
    )
