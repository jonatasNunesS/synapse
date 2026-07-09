"""
Synapse — Painel Administrativo: Models.

LogAlteracaoPlano: auditoria de TODA troca de plano feita pelo staff da
plataforma. Sucesso e falha ficam registrados (a tentativa que falhou também).
"""
import uuid

from django.db import models

STATUS_CHOICES = [
    ("sucesso", "Sucesso"),
    ("erro", "Erro"),
]


class LogAlteracaoPlano(models.Model):
    """Registro imutável de uma troca de plano de uma empresa."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="logs_alteracao_plano",
    )
    plano_anterior = models.CharField(max_length=20)
    plano_novo = models.CharField(max_length=20)
    alterado_por = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="alteracoes_plano_feitas",
    )
    observacao = models.TextField(blank=True, default="")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="sucesso")
    erro = models.TextField(blank=True, default="")
    alterado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "synapse_log_alteracao_plano"
        verbose_name = "Log de Alteração de Plano"
        verbose_name_plural = "Logs de Alteração de Plano"
        ordering = ["-alterado_em"]
        indexes = [
            models.Index(fields=["empresa", "-alterado_em"]),
        ]

    def __str__(self) -> str:
        return (
            f"{self.empresa_id}: {self.plano_anterior} → {self.plano_novo} "
            f"[{self.status}]"
        )
