"""
Synapse - Configuração do Projeto
Garante que o Celery app é carregado quando o Django inicia.
"""

from .celery import app as celery_app

__all__ = ("celery_app",)
