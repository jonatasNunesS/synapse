"""
M5 — Fornecedores: Models
CategoriaFornecedor, Fornecedor, CompraFornecedor
"""
import uuid
from decimal import Decimal

from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

from modules.auth.models import Empresa, CustomUser


class CategoriaFornecedor(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name="categorias_fornecedor",
    )
    nome = models.CharField(max_length=100)
    cor = models.CharField(max_length=7, default="#6D28D9")
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "synapse_categorias_fornecedor"
        verbose_name = "Categoria de Fornecedor"
        verbose_name_plural = "Categorias de Fornecedor"
        unique_together = ("empresa", "nome")
        ordering = ["nome"]

    def __str__(self):
        return self.nome


class Fornecedor(models.Model):
    STATUS_CHOICES = [
        ("ativo", "Ativo"),
        ("negociando", "Negociando"),
        ("suspenso", "Suspenso"),
        ("encerrado", "Encerrado"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name="fornecedores",
    )
    categoria = models.ForeignKey(
        CategoriaFornecedor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fornecedores",
    )
    nome = models.CharField(max_length=255)
    nome_contato = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    telefone = models.CharField(max_length=20, blank=True)
    whatsapp = models.CharField(max_length=20, blank=True)
    site = models.URLField(blank=True)
    cnpj = models.CharField(max_length=18, blank=True)
    endereco_cidade = models.CharField(max_length=100, blank=True)
    endereco_estado = models.CharField(max_length=2, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="ativo")
    condicoes_pagamento = models.CharField(max_length=255, blank=True)
    prazo_entrega_dias = models.IntegerField(null=True, blank=True)
    valor_total_compras = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    quantidade_pedidos = models.IntegerField(default=0)
    ultima_compra = models.DateField(null=True, blank=True)
    avaliacao_qualidade = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    avaliacao_prazo = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    avaliacao_preco = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    score_synapse = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("0.00")
    )
    notas = models.TextField(blank=True)
    ativo = models.BooleanField(default=True)
    criado_por = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fornecedores_criados",
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "synapse_fornecedores"
        verbose_name = "Fornecedor"
        verbose_name_plural = "Fornecedores"
        ordering = ["-score_synapse", "nome"]
        indexes = [
            models.Index(fields=["empresa", "status"], name="forn_empresa_status_idx"),
            models.Index(fields=["empresa", "categoria"], name="forn_empresa_cat_idx"),
            models.Index(fields=["empresa", "score_synapse"], name="forn_empresa_score_idx"),
            models.Index(fields=["empresa", "criado_em"], name="forn_empresa_criado_idx"),
        ]

    def __str__(self):
        return self.nome

    @property
    def score_qualidade(self) -> float:
        """Converte avaliação 1-5 para 0-100."""
        return (self.avaliacao_qualidade * 20) if self.avaliacao_qualidade else 0

    @property
    def ticket_medio(self) -> Decimal:
        """Ticket médio por pedido."""
        if self.quantidade_pedidos and self.quantidade_pedidos > 0:
            return self.valor_total_compras / self.quantidade_pedidos
        return Decimal("0.00")

    @property
    def link_whatsapp(self) -> str:
        """Link direto para WhatsApp com número limpo."""
        if not self.whatsapp:
            return ""
        # Remove caracteres não numéricos
        numero_limpo = "".join(c for c in self.whatsapp if c.isdigit())
        if numero_limpo:
            return f"https://wa.me/55{numero_limpo}"
        return ""

    @property
    def avaliacao_geral(self):
        """Média das 3 avaliações se pelo menos uma preenchida."""
        avaliacoes = [
            v for v in [
                self.avaliacao_qualidade,
                self.avaliacao_prazo,
                self.avaliacao_preco,
            ]
            if v is not None
        ]
        if not avaliacoes:
            return None
        return round(sum(avaliacoes) / len(avaliacoes), 1)

    def calcular_score(self) -> Decimal:
        """
        Score Synapse = média ponderada:
        - Qualidade: 40% (avaliacao_qualidade * 20)
        - Prazo: 35% (avaliacao_prazo * 20)
        - Preço: 25% (avaliacao_preco * 20)
        Se nenhuma avaliação: score = 0
        """
        if not any([self.avaliacao_qualidade, self.avaliacao_prazo, self.avaliacao_preco]):
            return Decimal("0.00")

        qualidade = (self.avaliacao_qualidade or 0) * 20
        prazo = (self.avaliacao_prazo or 0) * 20
        preco = (self.avaliacao_preco or 0) * 20

        score = (qualidade * Decimal("0.40")) + (prazo * Decimal("0.35")) + (preco * Decimal("0.25"))
        return round(Decimal(str(score)), 2)


class CompraFornecedor(models.Model):
    STATUS_CHOICES = [
        ("pendente", "Pendente"),
        ("pago", "Pago"),
        ("cancelado", "Cancelado"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fornecedor = models.ForeignKey(
        Fornecedor,
        on_delete=models.CASCADE,
        related_name="compras",
    )
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name="compras_fornecedor",
    )
    descricao = models.CharField(max_length=255)
    valor = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    data_compra = models.DateField()
    numero_nf = models.CharField(max_length=50, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pendente")
    data_pagamento = models.DateField(null=True, blank=True)
    observacoes = models.TextField(blank=True)
    criado_por = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="compras_fornecedor_criadas",
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "synapse_compras_fornecedor"
        verbose_name = "Compra de Fornecedor"
        verbose_name_plural = "Compras de Fornecedores"
        ordering = ["-data_compra"]
        indexes = [
            models.Index(fields=["fornecedor", "criado_em"], name="compra_forn_criado_idx"),
            models.Index(fields=["empresa", "criado_em"], name="compra_emp_criado_idx"),
            models.Index(fields=["empresa", "status"], name="compra_emp_status_idx"),
        ]

    def __str__(self):
        return f"{self.fornecedor.nome} — {self.descricao} ({self.valor})"
