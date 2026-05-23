"""
Synapse — Configuração do Celery
Broker: Redis | Backend: Redis
Tasks periódicas registradas para M2 (Financeiro), M3 (Estoque), M4 (CRM), M5 (Fornecedores), M6 (Projetos)
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
    # ── M2: Financeiro ──────────────────────────────────────
    "verificar-vencimentos": {
        "task": "financeiro.verificar_vencimentos",
        "schedule": crontab(hour=8, minute=0),  # Diáriamente às 8h
        "options": {"expires": 3600},
    },
    "criar-recorrencias": {
        "task": "financeiro.criar_recorrencias",
        "schedule": crontab(hour=0, minute=30),  # Diáriamente à meia-noite e meia
        "options": {"expires": 3600},
    },
    # ── M3: Estoque ──────────────────────────────────────────
    "verificar-estoque-minimo": {
        "task": "estoque.verificar_estoque_minimo",
        "schedule": crontab(hour=7, minute=0),  # Diáriamente às 7h
        "options": {"expires": 3600},
    },
    # ── M4: CRM ──────────────────────────────────────────────
    "verificar-followups": {
        "task": "clientes.verificar_followups",
        "schedule": crontab(hour=9, minute=0),  # Diáriamente às 9h
        "options": {"expires": 3600},
    },
    # ── M6: Projetos ──────────────────────────────────────────
    "verificar-prazos-tarefas": {
        "task": "projetos.verificar_prazos_tarefas",
        "schedule": crontab(hour=8, minute=0),  # Diáriamente às 8h
        "options": {"expires": 3600},
    },
    "verificar-projetos-atrasados": {
        "task": "projetos.verificar_projetos_atrasados",
        "schedule": crontab(hour=9, minute=0),  # Diáriamente às 9h
        "options": {"expires": 3600},
    },
    # ── M5: Fornecedores ─────────────────────────────────────
    "relatorio-semanal-fornecedores": {
        "task": "fornecedores.relatorio_semanal",
        "schedule": crontab(hour=8, minute=0, day_of_week=1),  # Toda segunda às 8h
        "options": {"expires": 7200},
    },
    "alertar-fornecedores-sem-avaliacao": {
        "task": "fornecedores.alertar_sem_avaliacao",
        "schedule": crontab(hour=10, minute=0, day_of_week=5),  # Toda sexta às 10h
        "options": {"expires": 3600},
    },
    # ── M9: AI Hub ───────────────────────────────────────────
    "gerar-insights-semanais": {
        "task": "ai_hub.gerar_insights_semanais",
        "schedule": crontab(hour=8, minute=0, day_of_week=0),  # Todo domingo às 8h
        "options": {"expires": 7200},
    },
}

app.conf.timezone = "America/Sao_Paulo"


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Task de debug para validar que o Celery está funcionando."""
    print(f"Request: {self.request!r}")
