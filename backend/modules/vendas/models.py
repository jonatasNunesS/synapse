"""
Synapse — Vendas: a venda como entidade própria.

Hoje uma venda é uma InteracaoCliente do tipo "venda": um registro só, com um
valor único, preso a um cliente. Isso não representa o que uma venda é — um
conjunto de itens, cada um com produto, quantidade e preço — nem permite
vender sem cliente identificado, que é o caso mais comum no balcão.

Esta é a fase 1: o modelo novo nasce CONVIVENDO com o atual. Nada de
InteracaoCliente é tocado, nenhuma venda antiga é migrada (fase 2), e criar
uma venda aqui ainda NÃO baixa estoque nem lança financeiro — as integrações
entram na fase 3.

DINHEIRO: subtotal e total são sempre derivados dos itens, recalculados no
save. O cliente pode enviar preço unitário (é editável), mas nunca os totais —
valor que a interface calcula serve para ela mostrar, não para ser persistido.
"""
import uuid
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from modules.auth.models import CustomUser, Empresa


class Venda(models.Model):
    """Cabeçalho da venda: com quem, quando, quanto e como foi pago."""

    STATUS_PAGAMENTO_CHOICES = [
        ("pago", "Pago"),
        ("pendente", "Pendente"),
    ]

    FORMA_PAGAMENTO_CHOICES = [
        ("dinheiro", "Dinheiro"),
        ("pix", "PIX"),
        ("cartao", "Cartão"),
        ("outro", "Outro"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        Empresa, on_delete=models.CASCADE, related_name="vendas"
    )
    # Nulo de propósito: venda de balcão não tem cliente identificado, e
    # exigir um seria inventar cadastro para poder vender. Vincular depois é
    # assunto da fase 3.
    cliente = models.ForeignKey(
        "synapse_clientes.Cliente",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="vendas",
    )
    data_venda = models.DateField(default=timezone.localdate)

    # Derivados dos itens — ver recalcular_totais(). Não aceitam valor de fora.
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    desconto = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))

    forma_pagamento = models.CharField(
        max_length=20, choices=FORMA_PAGAMENTO_CHOICES, blank=True, default=""
    )
    status_pagamento = models.CharField(
        max_length=20, choices=STATUS_PAGAMENTO_CHOICES, default="pago"
    )
    data_prevista_pagamento = models.DateField(null=True, blank=True)
    observacoes = models.TextField(blank=True, default="")

    # Lançamento de receita já existente para esta venda. Nasce preenchido só
    # na migração da fase 2, copiado da interação de origem: a venda antiga já
    # foi ao financeiro, e a fase 3 precisa saber disso para não lançar de novo.
    lancamento_financeiro = models.ForeignKey(
        "synapse_financeiro.Lancamento",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="venda_origem",
    )

    criado_por = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="vendas_criadas",
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "vendas"
        verbose_name = "Venda"
        verbose_name_plural = "Vendas"
        ordering = ["-data_venda", "-criado_em"]
        indexes = [
            models.Index(fields=["empresa", "-data_venda"], name="venda_empresa_data_idx"),
            models.Index(fields=["empresa", "status_pagamento"], name="venda_empresa_status_idx"),
        ]

    def __str__(self):
        quem = self.cliente.nome if self.cliente else "Sem cliente"
        return f"Venda {self.data_venda} — {quem} — R$ {self.total}"

    def clean(self):
        # Desconto maior que o subtotal deixaria o total negativo, o que não
        # é venda: é devolução, e não é isto que este modelo representa.
        if self.desconto is not None and self.desconto < 0:
            raise ValidationError({"desconto": "O desconto não pode ser negativo."})
        if self.desconto is not None and self.desconto > self.subtotal:
            raise ValidationError(
                {"desconto": "O desconto não pode ser maior que o subtotal da venda."}
            )

    def recalcular_totais(self, salvar: bool = True) -> None:
        """
        Refaz subtotal e total a partir dos itens.

        É a única porta de entrada desses dois campos. Chamar sempre que os
        itens mudarem — criar, editar ou remover.
        """
        soma = sum(
            (item.subtotal for item in self.itens.all()), Decimal("0")
        )
        self.subtotal = soma
        self.total = soma - (self.desconto or Decimal("0"))
        if salvar:
            self.save(update_fields=["subtotal", "total", "atualizado_em"])


class ItemVenda(models.Model):
    """Uma linha da venda: produto, quantidade e o preço praticado."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    venda = models.ForeignKey(Venda, on_delete=models.CASCADE, related_name="itens")
    # Redundante com venda.empresa, mas evita join em toda consulta por
    # empresa — e mantém o filtro multi-tenant possível direto no item.
    empresa = models.ForeignKey(
        Empresa, on_delete=models.CASCADE, related_name="itens_venda"
    )
    # Nulo permite o ITEM LIVRE: uma linha que não corresponde a produto
    # cadastrado. Serve para serviço ("cerimonial", "montagem") e é o que
    # permite migrar a venda antiga que só guardava um valor, sem inventar
    # produto no catálogo de estoque só para ela caber aqui.
    produto = models.ForeignKey(
        "synapse_estoque.Produto",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="itens_venda",
    )
    # Nome da linha quando não há produto. Com produto é opcional: o nome sai
    # do cadastro.
    descricao = models.CharField(max_length=255, blank=True, default="")
    # Três casas seguem o padrão da movimentação de estoque, para quem vende
    # por peso ou metro.
    quantidade = models.DecimalField(max_digits=12, decimal_places=3)
    # Vem do cadastro do produto, mas é editável: desconto de balcão e preço
    # combinado na hora são a regra, não a exceção.
    preco_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))

    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "venda_itens"
        verbose_name = "Item da venda"
        verbose_name_plural = "Itens da venda"
        ordering = ["criado_em"]
        indexes = [
            models.Index(fields=["empresa", "produto"], name="itemvenda_emp_prod_idx"),
        ]

    @property
    def nome_exibido(self) -> str:
        """O que a linha mostra: o produto quando há, senão a descrição."""
        if self.produto_id and self.produto:
            return self.produto.nome
        return self.descricao

    def __str__(self):
        return f"{self.quantidade} × {self.nome_exibido}"

    def clean(self):
        if self.quantidade is not None and self.quantidade <= 0:
            raise ValidationError({"quantidade": "A quantidade deve ser maior que zero."})
        if self.preco_unitario is not None and self.preco_unitario < 0:
            raise ValidationError({"preco_unitario": "O preço não pode ser negativo."})
        # Um item precisa dizer o que está sendo vendido. Sem produto e sem
        # descrição a linha não significa nada — e ainda somaria ao total.
        if not self.produto_id and not (self.descricao or "").strip():
            raise ValidationError(
                {"descricao": "Informe a descrição quando o item não tem produto."}
            )

    def save(self, *args, **kwargs):
        # O subtotal da linha nunca vem de fora: é sempre quantidade × preço.
        self.subtotal = (self.quantidade or Decimal("0")) * (
            self.preco_unitario or Decimal("0")
        )
        super().save(*args, **kwargs)
