"""
Synapse — Configuração do Celery
Broker: Redis | Backend: Redis
Tasks periódicas registradas para M2 (Financeiro), M3 (Estoque), M4 (CRM),
M5 (Fornecedores), M6 (Projetos), M9 (AI Hub).

IMPORTANTE: Os nomes das tasks devem corresponder EXATAMENTE ao parâmetro
`name=` do decorator @shared_task em cada módulo.
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
# Nomes verificados contra o decorator @shared_task(name=...) de cada módulo.
# ════════════════════════════════════════════════════════════
app.conf.beat_schedule = {
    # ── M2: Financeiro ──────────────────────────────────────
    "verificar-vencimentos": {
        "task": "financeiro.verificar_vencimentos",   # modules/financeiro/tasks.py
        "schedule": crontab(hour=8, minute=0),        # Diariamente às 8h (BRT)
        "options": {"expires": 3600},
    },
    "criar-recorrencias": {
        "task": "financeiro.criar_recorrencias",      # modules/financeiro/tasks.py
        "schedule": crontab(hour=0, minute=30),       # Diariamente à meia-noite e meia
        "options": {"expires": 3600},
    },
    # ── M3: Estoque ──────────────────────────────────────────
    "verificar-estoque-minimo": {
        "task": "estoque.verificar_estoque_minimo",   # modules/estoque/tasks.py
        "schedule": crontab(hour=7, minute=0),        # Diariamente às 7h
        "options": {"expires": 3600},
    },
    # ── M4: CRM ──────────────────────────────────────────────
    "verificar-followups": {
        "task": "clientes.verificar_followups",       # modules/clientes/tasks.py
        "schedule": crontab(hour=9, minute=0),        # Diariamente às 9h
        "options": {"expires": 3600},
    },
    # ── M6: Projetos ──────────────────────────────────────────
    "verificar-prazos-tarefas": {
        "task": "projetos.verificar_prazos_tarefas",  # modules/projetos/tasks.py
        "schedule": crontab(hour=8, minute=0),        # Diariamente às 8h
        "options": {"expires": 3600},
    },
    "verificar-projetos-atrasados": {
        "task": "projetos.verificar_projetos_atrasados",  # modules/projetos/tasks.py
        "schedule": crontab(hour=9, minute=0),            # Diariamente às 9h
        "options": {"expires": 3600},
    },
    # ── M5: Fornecedores ─────────────────────────────────────
    "relatorio-semanal-fornecedores": {
        "task": "fornecedores.relatorio_semanal",     # modules/fornecedores/tasks.py
        "schedule": crontab(hour=8, minute=0, day_of_week=1),  # Toda segunda às 8h
        "options": {"expires": 7200},
    },
    "alertar-fornecedores-sem-avaliacao": {
        "task": "fornecedores.alertar_sem_avaliacao",  # modules/fornecedores/tasks.py
        "schedule": crontab(hour=10, minute=0, day_of_week=5),  # Toda sexta às 10h
        "options": {"expires": 3600},
    },
    # ── M9: AI Hub ───────────────────────────────────────────
    "gerar-insights-semanais": {
        "task": "ai_hub.gerar_insights_semanais",     # modules/ai_hub/tasks.py
        # ALTO-2: day_of_week=1 = segunda-feira (0=domingo, 1=segunda, ..., 6=sábado)
        "schedule": crontab(hour=8, minute=0, day_of_week=1),  # Toda segunda às 8h
        "options": {"expires": 7200},
    },
}

app.conf.timezone = "America/Sao_Paulo"


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Task de debug para validar que o Celery está funcionando."""
    print(f"Request: {self.request!r}")
