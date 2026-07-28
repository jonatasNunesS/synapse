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

# Tipo de evento auditado. `troca_plano` é o histórico clássico; os demais
# registram o ciclo de vida da empresa na mesma linha do tempo.
ACAO_CHOICES = [
    ("troca_plano", "Troca de plano"),
    ("criacao", "Criação da empresa"),
    ("suspenso", "Suspensa"),
    ("reativado", "Reativada"),
]


class LogAlteracaoPlano(models.Model):
    """Registro imutável de uma troca de plano de uma empresa."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="logs_alteracao_plano",
    )
    acao = models.CharField(max_length=20, choices=ACAO_CHOICES, default="troca_plano")
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


class AuditLog(models.Model):
    """
    Trilha de auditoria que SOBREVIVE à exclusão da empresa.

    Diferente de LogAlteracaoPlano (FK CASCADE → some junto com a empresa),
    aqui a empresa é guardada por UUID solto + snapshot do nome, de modo que
    o registro de "empresa X foi excluída por Y em Z" persista para sempre,
    mesmo depois que todos os dados da empresa forem apagados.
    """

    ACAO_CHOICES = [
        ("empresa_excluida", "Empresa excluída definitivamente"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa_id = models.UUIDField(db_index=True)
    empresa_nome = models.CharField(max_length=255)
    acao = models.CharField(max_length=32, choices=ACAO_CHOICES, default="empresa_excluida")
    realizado_por = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="auditorias_realizadas",
    )
    # Snapshot: sobrevive mesmo se o staff que executou for removido depois.
    realizado_por_email = models.CharField(max_length=255, blank=True, default="")
    detalhes = models.TextField(blank=True, default="")
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "synapse_audit_log"
        verbose_name = "Log de Auditoria"
        verbose_name_plural = "Logs de Auditoria"
        ordering = ["-criado_em"]
        indexes = [
            models.Index(fields=["empresa_id", "-criado_em"]),
        ]

    def __str__(self) -> str:
        return f"{self.acao}: {self.empresa_nome} ({self.empresa_id})"
