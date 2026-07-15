"""
Synapse — Caixinhas (reservas financeiras).

Modelo Nubank/PicPay: dinheiro depositado numa caixinha SAI do saldo
disponível; retirado, VOLTA. Depósito/retirada são transferências internas —
não criam lançamento no Financeiro (a conta bancária da empresa não muda).
saldo_disponivel = saldo_acumulado − total_em_caixinhas;
patrimônio total = saldo_acumulado (não muda com caixinhas).
"""
import uuid

from django.db import models


class Caixinha(models.Model):
    """Reserva financeira separada do caixa principal da empresa."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="caixinhas",
    )
    nome = models.CharField(max_length=100)
    cor = models.CharField(max_length=7, default="#6366f1")
    icone = models.CharField(max_length=10, blank=True)
    # Saldo NUNCA negativo — toda alteração passa por select_for_update
    # no repository (mesmo padrão do EstoqueRepository.criar_movimentacao).
    saldo = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    meta = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
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
        app_label = "synapse_caixinhas"
        verbose_name = "Caixinha"
        verbose_name_plural = "Caixinhas"
        ordering = ["-criado_em"]
        indexes = [
            models.Index(fields=["empresa", "criado_em"], name="cx_emp_criado_idx"),
        ]

    def __str__(self):
        return f"{self.nome} — R${self.saldo}"

    @property
    def meta_atingida(self) -> bool:
        """True se há meta definida e o saldo já a alcançou."""
        return self.meta is not None and self.saldo >= self.meta


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
        related_name="movimentos_caixinhas",
    )
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    descricao = models.CharField(max_length=255, blank=True)
    criado_por = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movimentos_caixinhas_criados",
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "synapse_caixinhas"
        verbose_name = "Movimento de Caixinha"
        verbose_name_plural = "Movimentos de Caixinhas"
        ordering = ["-criado_em"]
        indexes = [
            models.Index(fields=["empresa", "criado_em"], name="cxmov_emp_criado_idx"),
            models.Index(fields=["caixinha", "criado_em"], name="cxmov_cx_criado_idx"),
        ]

    def __str__(self):
        return f"{self.get_tipo_display()} R${self.valor} — {self.caixinha.nome}"
