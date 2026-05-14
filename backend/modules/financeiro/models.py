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
    """Lançamentos financeiros (receitas e despesas) por empresa."""

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
