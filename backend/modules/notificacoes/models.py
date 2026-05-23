"""
Synapse — M7: Módulo Notificações
Model Notificacao: notificações por usuário com tipo, prioridade e acao_url.
"""
import uuid
from django.db import models


class Notificacao(models.Model):
    TIPO_CHOICES = [
        ("financeiro", "Financeiro"),
        ("estoque", "Estoque"),
        ("cliente", "Cliente"),
        ("fornecedor", "Fornecedor"),
        ("projeto", "Projeto"),
        ("equipe", "Equipe"),
        ("documento", "Documento"),
        ("sistema", "Sistema"),
    ]

    PRIORIDADE_CHOICES = [
        ("normal", "Normal"),
        ("alta", "Alta"),
        ("urgente", "Urgente"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa", on_delete=models.CASCADE, related_name="notificacoes"
    )
    usuario = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.CASCADE,
        related_name="notificacoes",
        help_text="Usuário que recebe a notificação",
    )
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default="sistema")
    titulo = models.CharField(max_length=255)
    mensagem = models.TextField()
    lida = models.BooleanField(default=False)
    data_leitura = models.DateTimeField(null=True, blank=True)
    acao_url = models.CharField(
        max_length=500,
        blank=True,
        default="",
        help_text="URL para onde o usuário deve navegar ao clicar",
    )
    prioridade = models.CharField(
        max_length=10, choices=PRIORIDADE_CHOICES, default="normal"
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notificacoes"
        ordering = ["-criado_em"]
        indexes = [
            models.Index(fields=["usuario", "lida"], name="notif_usuario_lida_idx"),
            models.Index(fields=["usuario", "criado_em"], name="notif_usuario_criado_idx"),
            models.Index(fields=["empresa", "criado_em"], name="notif_empresa_criado_idx"),
            models.Index(fields=["usuario", "tipo"], name="notif_usuario_tipo_idx"),
        ]
        verbose_name = "Notificação"
        verbose_name_plural = "Notificações"

    def __str__(self):
        return f"[{self.tipo}] {self.titulo} → {self.usuario}"

    @property
    def tipo_display(self):
        return dict(self.TIPO_CHOICES).get(self.tipo, self.tipo)

    @property
    def prioridade_display(self):
        return dict(self.PRIORIDADE_CHOICES).get(self.prioridade, self.prioridade)
