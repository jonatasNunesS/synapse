"""
Synapse - AI Hub Models
ConteudoGerado: histórico de conteúdos gerados pela IA.
TaskIA: rastreamento de tasks Celery assíncronas de IA.
"""
import uuid
from django.db import models


# ─── Choices ──────────────────────────────────────────────────────────────────

TIPO_CONTEUDO_CHOICES = [
    ("legenda_instagram", "Legenda para Instagram"),
    ("titulo_produto", "Título de Produto"),
    ("descricao_produto", "Descrição de Produto"),
    ("hashtags", "Hashtags"),
    ("ideia_pauta", "Ideia de Pauta"),
    ("email_marketing", "E-mail Marketing"),
    ("relatorio_negocio", "Relatório do Negócio"),
    ("insight", "Insight"),
    ("outro", "Outro"),
]

TIPO_TASK_CHOICES = [
    ("conteudo", "Conteúdo"),
    ("insight", "Insight"),
    ("relatorio", "Relatório"),
    ("analise", "Análise"),
]

STATUS_TASK_CHOICES = [
    ("pendente", "Pendente"),
    ("processando", "Processando"),
    ("concluido", "Concluído"),
    ("erro", "Erro"),
]


# ─── ConteudoGerado ───────────────────────────────────────────────────────────

class ConteudoGerado(models.Model):
    """
    Histórico de conteúdos gerados pela IA para uma empresa.
    Cada registro representa uma geração concluída com sucesso.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="conteudos_ia",
    )
    tipo = models.CharField(max_length=50, choices=TIPO_CONTEUDO_CHOICES)
    prompt_usuario = models.TextField(
        help_text="O que o usuário pediu (simplificado)."
    )
    prompt_completo = models.TextField(
        help_text="Prompt completo montado pelo sistema com contexto."
    )
    resultado = models.TextField(help_text="Resposta gerada pela IA.")
    modelo_usado = models.CharField(max_length=100)
    tokens_usados = models.IntegerField(default=0)
    favorito = models.BooleanField(default=False)
    copiado = models.BooleanField(default=False)
    criado_por = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conteudos_ia_criados",
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-criado_em"]
        indexes = [
            models.Index(fields=["empresa", "tipo"]),
            models.Index(fields=["empresa", "criado_em"]),
            models.Index(fields=["empresa", "favorito"]),
        ]
        verbose_name = "Conteúdo Gerado"
        verbose_name_plural = "Conteúdos Gerados"

    def __str__(self):
        return f"{self.get_tipo_display()} — {self.empresa.nome} ({self.criado_em.date()})"


# ─── TaskIA ───────────────────────────────────────────────────────────────────

class TaskIA(models.Model):
    """
    Rastreamento de tasks Celery assíncronas de IA.
    O frontend faz polling neste model até status=concluido.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="tasks_ia",
    )
    task_id = models.CharField(
        max_length=255,
        blank=True,
        help_text="ID da task Celery.",
    )
    tipo = models.CharField(max_length=20, choices=TIPO_TASK_CHOICES, default="conteudo")
    status = models.CharField(
        max_length=20,
        choices=STATUS_TASK_CHOICES,
        default="pendente",
    )
    parametros = models.JSONField(
        default=dict,
        help_text="Parâmetros de entrada da task (tipo de conteúdo, campos, etc.).",
    )
    resultado = models.TextField(blank=True, help_text="Output quando concluído.")
    erro = models.TextField(blank=True, help_text="Mensagem de erro se falhou.")
    criado_em = models.DateTimeField(auto_now_add=True)
    concluido_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-criado_em"]
        indexes = [
            models.Index(fields=["empresa", "status"]),
            models.Index(fields=["empresa", "criado_em"]),
        ]
        verbose_name = "Task IA"
        verbose_name_plural = "Tasks IA"

    def __str__(self):
        return f"TaskIA [{self.status}] {self.get_tipo_display()} — {self.empresa.nome}"
