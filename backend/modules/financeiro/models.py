"""
Synapse — Módulo Financeiro: Models
Categoria e Lancamento com multi-tenant obrigatório (empresa_id).
"""
import uuid
from datetime import date

from django.db import models


class Categoria(models.Model):
    """Categorias de receitas e despesas por empresa."""

    TIPO_CHOICES = [
        ("receita", "Receita"),
        ("despesa", "Despesa"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="categorias_financeiro",
    )
    nome = models.CharField(max_length=100)
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    cor = models.CharField(max_length=7, default="#6D28D9")
    icone = models.CharField(max_length=50, blank=True)
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "synapse_financeiro"
        verbose_name = "Categoria"
        verbose_name_plural = "Categorias"
        unique_together = [("empresa", "nome", "tipo")]
        ordering = ["tipo", "nome"]

    def __str__(self):
        return f"{self.nome} ({self.tipo})"


class Lancamento(models.Model):
    """
    Lançamentos financeiros (receitas e despesas) por empresa.

    DECISÃO DE PRODUTO (feedback do piloto, jul/2026):
    Lançamentos pagos são editáveis/excluíveis apenas por admin da empresa,
    com motivo obrigatório e log de auditoria completo (LogEdicaoLancamento).
    Esta decisão prioriza flexibilidade operacional com rastreabilidade sobre
    imutabilidade estrita. NÃO remover essa permissão achando que é bug —
    a regra antiga ("pago é imutável") foi descontinuada de propósito.
    Lançamentos pendentes continuam livremente editáveis por qualquer usuário
    da empresa, sem exigência de motivo.
    """

    TIPO_CHOICES = [
        ("receita", "Receita"),
        ("despesa", "Despesa"),
    ]

    STATUS_CHOICES = [
        ("pendente", "Pendente"),
        ("pago", "Pago"),
        ("atrasado", "Atrasado"),
        ("cancelado", "Cancelado"),
    ]

    RECORRENCIA_CHOICES = [
        ("semanal", "Semanal"),
        ("mensal", "Mensal"),
        ("anual", "Anual"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="lancamentos_financeiro",
    )
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    descricao = models.CharField(max_length=255)
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    categoria = models.ForeignKey(
        Categoria,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lancamentos",
    )
    data_vencimento = models.DateField()
    data_pagamento = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pendente")
    recorrente = models.BooleanField(default=False)
    recorrencia = models.CharField(
        max_length=10, choices=RECORRENCIA_CHOICES, blank=True
    )
    observacoes = models.TextField(blank=True)
    criado_por = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lancamentos_criados",
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "synapse_financeiro"
        verbose_name = "Lançamento"
        verbose_name_plural = "Lançamentos"
        ordering = ["-data_vencimento"]
        indexes = [
            models.Index(fields=["empresa", "data_vencimento"], name="fin_emp_venc_idx"),
            models.Index(fields=["empresa", "status"], name="fin_emp_status_idx"),
            models.Index(fields=["empresa", "tipo"], name="fin_emp_tipo_idx"),
            models.Index(fields=["empresa", "criado_em"], name="fin_emp_criado_idx"),
        ]

    def __str__(self):
        return f"{self.descricao} — R${self.valor} ({self.status})"

    @property
    def esta_atrasado(self) -> bool:
        """True se o lançamento está pendente e o vencimento já passou."""
        return self.status == "pendente" and self.data_vencimento < date.today()


class LogEdicaoLancamento(models.Model):
    """
    Log de auditoria de edições/exclusões de lançamentos pagos.

    Cada operação controlada sobre um lançamento pago gera um registro aqui,
    com snapshot completo do antes/depois. O log é imutável (nunca editado
    nem apagado pela aplicação) e visível a qualquer usuário da empresa,
    garantindo transparência sobre alterações que afetam saldos históricos.
    """

    ACAO_CHOICES = [
        ("editado", "Editado"),
        ("excluido", "Excluído"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # SET_NULL: se o lançamento for excluído, o log sobrevive como registro
    # histórico da exclusão (o snapshot_antes preserva todos os dados).
    lancamento = models.ForeignKey(
        Lancamento,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="logs_edicao",
    )
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="logs_edicao_lancamentos",
    )
    editado_por = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="edicoes_lancamentos",
    )
    editado_em = models.DateTimeField(auto_now_add=True)
    acao = models.CharField(max_length=10, choices=ACAO_CHOICES)
    motivo = models.TextField()
    snapshot_antes = models.JSONField()
    snapshot_depois = models.JSONField(null=True, blank=True)

    class Meta:
        app_label = "synapse_financeiro"
        verbose_name = "Log de Edição de Lançamento"
        verbose_name_plural = "Logs de Edição de Lançamentos"
        ordering = ["-editado_em"]
        indexes = [
            models.Index(fields=["empresa", "lancamento"], name="fin_log_emp_lanc_idx"),
            models.Index(fields=["empresa", "editado_em"], name="fin_log_emp_data_idx"),
        ]

    def __str__(self):
        return f"{self.get_acao_display()} por {self.editado_por} em {self.editado_em:%d/%m/%Y %H:%M}"
