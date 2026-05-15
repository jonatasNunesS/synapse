import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _


class CategoriaEstoque(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="categorias_estoque",
    )
    nome = models.CharField(_("nome"), max_length=100)
    descricao = models.CharField(_("descrição"), max_length=255, blank=True)
    cor = models.CharField(_("cor"), max_length=7, default="#6D28D9")
    ativo = models.BooleanField(_("ativo"), default=True)
    criado_em = models.DateTimeField(_("criado em"), auto_now_add=True)

    class Meta:
        app_label = "synapse_estoque"
        verbose_name = _("Categoria de Estoque")
        verbose_name_plural = _("Categorias de Estoque")
        unique_together = ("empresa", "nome")
        ordering = ["nome"]

    def __str__(self):
        return self.nome


class Produto(models.Model):
    UNIDADE_CHOICES = [
        ("unidade", "Unidade"),
        ("kg", "Quilograma"),
        ("litro", "Litro"),
        ("metro", "Metro"),
        ("caixa", "Caixa"),
        ("pacote", "Pacote"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="produtos",
    )
    categoria = models.ForeignKey(
        CategoriaEstoque,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="produtos",
    )
    nome = models.CharField(_("nome"), max_length=255)
    descricao = models.TextField(_("descrição"), blank=True)
    sku = models.CharField(_("SKU"), max_length=100, blank=True)
    codigo_barras = models.CharField(_("código de barras"), max_length=50, blank=True)
    unidade = models.CharField(
        _("unidade"), max_length=20, choices=UNIDADE_CHOICES, default="unidade"
    )
    preco_custo = models.DecimalField(
        _("preço de custo"), max_digits=12, decimal_places=2, default=0
    )
    preco_venda = models.DecimalField(
        _("preço de venda"), max_digits=12, decimal_places=2, default=0
    )
    estoque_atual = models.DecimalField(
        _("estoque atual"), max_digits=12, decimal_places=3, default=0
    )
    estoque_minimo = models.DecimalField(
        _("estoque mínimo"), max_digits=12, decimal_places=3, default=0
    )
    estoque_maximo = models.DecimalField(
        _("estoque máximo"),
        max_digits=12,
        decimal_places=3,
        null=True,
        blank=True,
    )
    imagem_url = models.CharField(_("URL da imagem"), max_length=500, blank=True)
    ativo = models.BooleanField(_("ativo"), default=True)
    criado_por = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="produtos_criados",
    )
    criado_em = models.DateTimeField(_("criado em"), auto_now_add=True)
    atualizado_em = models.DateTimeField(_("atualizado em"), auto_now=True)

    class Meta:
        app_label = "synapse_estoque"
        verbose_name = _("Produto")
        verbose_name_plural = _("Produtos")
        ordering = ["nome"]
        indexes = [
            models.Index(fields=["empresa", "ativo"], name="produto_empresa_ativo_idx"),
            models.Index(fields=["empresa", "categoria"], name="produto_empresa_cat_idx"),
            models.Index(fields=["empresa", "criado_em"], name="produto_empresa_criado_idx"),
            models.Index(fields=["empresa", "nome"], name="produto_empresa_nome_idx"),
        ]

    def __str__(self):
        return f"{self.nome} ({self.sku})" if self.sku else self.nome

    @property
    def margem_lucro(self):
        """Margem de lucro percentual."""
        if self.preco_custo and self.preco_custo > 0:
            return float(
                (self.preco_venda - self.preco_custo) / self.preco_custo * 100
            )
        return None

    @property
    def esta_abaixo_minimo(self):
        """Verifica se o estoque está abaixo do mínimo."""
        return self.estoque_atual <= self.estoque_minimo

    @property
    def esta_sem_estoque(self):
        """Verifica se o estoque está zerado."""
        return self.estoque_atual <= 0

    @property
    def status_estoque(self):
        """Retorna o status do estoque: ok, baixo ou zerado."""
        if self.esta_sem_estoque:
            return "zerado"
        if self.esta_abaixo_minimo:
            return "baixo"
        return "ok"

    @property
    def valor_em_estoque(self):
        """Valor total do estoque (estoque_atual * preco_custo)."""
        return float(self.estoque_atual * self.preco_custo)


class Variacao(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    produto = models.ForeignKey(
        Produto,
        on_delete=models.CASCADE,
        related_name="variacoes",
    )
    nome = models.CharField(_("nome"), max_length=100)
    sku_variacao = models.CharField(_("SKU da variação"), max_length=100, blank=True)
    estoque_atual = models.DecimalField(
        _("estoque atual"), max_digits=12, decimal_places=3, default=0
    )
    preco_venda = models.DecimalField(
        _("preço de venda"),
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    ativo = models.BooleanField(_("ativo"), default=True)

    class Meta:
        app_label = "synapse_estoque"
        verbose_name = _("Variação")
        verbose_name_plural = _("Variações")
        unique_together = ("produto", "nome")
        ordering = ["nome"]

    def __str__(self):
        return f"{self.produto.nome} — {self.nome}"

    @property
    def preco_efetivo(self):
        """Retorna o preço da variação ou do produto pai."""
        return self.preco_venda if self.preco_venda is not None else self.produto.preco_venda


class Movimentacao(models.Model):
    TIPO_CHOICES = [
        ("entrada", "Entrada"),
        ("saida", "Saída"),
        ("ajuste", "Ajuste"),
        ("transferencia", "Transferência"),
    ]

    MOTIVO_CHOICES = [
        ("compra", "Compra"),
        ("venda", "Venda"),
        ("perda", "Perda"),
        ("devolucao", "Devolução"),
        ("inventario", "Inventário"),
        ("ajuste_manual", "Ajuste Manual"),
        ("transferencia", "Transferência"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="movimentacoes_estoque",
    )
    produto = models.ForeignKey(
        Produto,
        on_delete=models.PROTECT,
        related_name="movimentacoes",
    )
    variacao = models.ForeignKey(
        Variacao,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movimentacoes",
    )
    tipo = models.CharField(_("tipo"), max_length=20, choices=TIPO_CHOICES)
    quantidade = models.DecimalField(
        _("quantidade"), max_digits=12, decimal_places=3
    )
    estoque_antes = models.DecimalField(
        _("estoque antes"), max_digits=12, decimal_places=3
    )
    estoque_depois = models.DecimalField(
        _("estoque depois"), max_digits=12, decimal_places=3
    )
    motivo = models.CharField(_("motivo"), max_length=30, choices=MOTIVO_CHOICES)
    referencia = models.CharField(_("referência"), max_length=255, blank=True)
    observacoes = models.TextField(_("observações"), blank=True)
    criado_por = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movimentacoes_criadas",
    )
    criado_em = models.DateTimeField(_("criado em"), auto_now_add=True)

    class Meta:
        app_label = "synapse_estoque"
        verbose_name = _("Movimentação de Estoque")
        verbose_name_plural = _("Movimentações de Estoque")
        ordering = ["-criado_em"]
        indexes = [
            models.Index(fields=["empresa", "criado_em"], name="mov_empresa_criado_idx"),
            models.Index(fields=["produto", "criado_em"], name="mov_produto_criado_idx"),
            models.Index(fields=["empresa", "tipo"], name="mov_empresa_tipo_idx"),
        ]

    def __str__(self):
        return f"{self.get_tipo_display()} — {self.produto.nome} ({self.quantidade})"

    def save(self, *args, **kwargs):
        """Movimentação é imutável: impede atualização após criação."""
        if not self._state.adding:
            raise ValueError(
                "Movimentações são imutáveis. Crie uma nova movimentação de ajuste."
            )
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """Movimentação é imutável: impede exclusão."""
        raise ValueError(
            "Movimentações não podem ser excluídas. Crie uma nova movimentação de ajuste."
        )
