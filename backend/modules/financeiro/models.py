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


class Caixinha(models.Model):
    """Cofrinhos / reservas financeiras com meta e prazo opcionais."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="caixinhas",
    )
    nome = models.CharField(max_length=100)
    descricao = models.TextField(blank=True)
    cor = models.CharField(max_length=7, default="#6D28D9")
    icone = models.CharField(max_length=50, default="piggy-bank")
    meta = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    saldo_atual = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    data_meta = models.DateField(null=True, blank=True)
    ativa = models.BooleanField(default=True)
    criado_por = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="caixinhas_criadas",
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "synapse_financeiro"
        verbose_name = "Caixinha"
        verbose_name_plural = "Caixinhas"
        ordering = ["-criado_em"]
        indexes = [
            models.Index(fields=["empresa", "ativa"], name="caixinha_emp_ativa_idx"),
        ]

    def __str__(self):
        return f"{self.nome} (R${self.saldo_atual})"

    @property
    def progresso(self) -> float:
        """Percentual de progresso em relação à meta (0-100)."""
        if self.meta and self.meta > 0:
            return min(float(self.saldo_atual / self.meta * 100), 100)
        return 0


class MovimentoCaixinha(models.Model):
    """Histórico de depósitos e retiradas de uma caixinha."""

    TIPO_CHOICES = [
        ("deposito", "Depósito"),
        ("retirada", "Retirada"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    caixinha = models.ForeignKey(
        Caixinha,
        on_delete=models.CASCADE,
        related_name="movimentos",
    )
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="movimentos_caixinha",
    )
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    descricao = models.CharField(max_length=255, blank=True)
    saldo_anterior = models.DecimalField(max_digits=12, decimal_places=2)
    saldo_posterior = models.DecimalField(max_digits=12, decimal_places=2)
    criado_por = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movimentos_caixinha_criados",
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "synapse_financeiro"
        verbose_name = "Movimento de Caixinha"
        verbose_name_plural = "Movimentos de Caixinha"
        ordering = ["-criado_em"]
        indexes = [
            models.Index(fields=["caixinha", "criado_em"], name="mov_caixinha_criado_idx"),
        ]

    def __str__(self):
        return f"{self.get_tipo_display()} R${self.valor} → {self.caixinha.nome}"


class Investimento(models.Model):
    """Investimentos acompanhados pela empresa."""

    TIPO_CHOICES = [
        ("renda_fixa", "Renda Fixa"),
        ("renda_variavel", "Renda Variável"),
        ("fundos", "Fundos"),
        ("criptomoeda", "Criptomoeda"),
        ("imovel", "Imóvel"),
        ("outro", "Outro"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="investimentos",
    )
    nome = models.CharField(max_length=150)
    descricao = models.TextField(blank=True)
    tipo = models.CharField(max_length=30, choices=TIPO_CHOICES, default="renda_fixa")
    valor_inicial = models.DecimalField(max_digits=14, decimal_places=2)
    valor_atual = models.DecimalField(max_digits=14, decimal_places=2)
    taxa_juros_anual = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    data_inicio = models.DateField()
    data_vencimento = models.DateField(null=True, blank=True)
    ativo = models.BooleanField(default=True)
    cor = models.CharField(max_length=7, default="#059669")
    criado_por = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="investimentos_criados",
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "synapse_financeiro"
        verbose_name = "Investimento"
        verbose_name_plural = "Investimentos"
        ordering = ["-criado_em"]
        indexes = [
            models.Index(fields=["empresa", "ativo"], name="inv_emp_ativo_idx"),
        ]

    def __str__(self):
        return f"{self.nome} (R${self.valor_atual})"

    @property
    def rentabilidade(self) -> float:
        """Rentabilidade percentual acumulada."""
        if self.valor_inicial and float(self.valor_inicial) > 0:
            return float((self.valor_atual - self.valor_inicial) / self.valor_inicial * 100)
        return 0.0

    @property
    def ganho_absoluto(self):
        return float(self.valor_atual) - float(self.valor_inicial)
