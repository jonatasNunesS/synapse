"""
Synapse - Configuração do Celery
Broker: Redis | Backend: Redis
"""

import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

app = Celery("synapse")

# Carrega configurações do Django settings com prefixo CELERY_
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-descobre tasks em todos os módulos registrados
app.autodiscover_tasks()

# ════════════════════════════════════════════════════════════
# TAREFAS AGENDADAS (Celery Beat)
# ════════════════════════════════════════════════════════════
app.conf.beat_schedule = {
    # Placeholder: tarefas agendadas serão adicionadas nos milestones seguintes
    # Exemplo (M2): verificar vencimentos financeiros diariamente às 8h
    # "verificar-vencimentos": {
    #     "task": "modules.financeiro.tasks.verificar_vencimentos",
    #     "schedule": crontab(hour=8, minute=0),
    # },
}


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Task de debug para validar que o Celery está funcionando."""
    print(f"Request: {self.request!r}")
