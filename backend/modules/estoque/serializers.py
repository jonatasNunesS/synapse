from rest_framework import serializers
from .models import CategoriaEstoque, Produto, Variacao, Movimentacao


# ─── Categoria ────────────────────────────────────────────────────────────────

class CategoriaEstoqueSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaEstoque
        fields = ["id", "nome", "descricao", "cor", "ativo", "criado_em"]
        read_only_fields = ["id", "criado_em"]

    def validate_nome(self, value):
        """Valida unicidade do nome por empresa."""
        request = self.context.get("request")
        if not request:
            return value
        empresa_id = getattr(request.user, "empresa_id", None)
        if not empresa_id:
            return value
        qs = CategoriaEstoque.objects.filter(empresa_id=empresa_id, nome=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "Já existe uma categoria com este nome nesta empresa."
            )
        return value


# ─── Variação ─────────────────────────────────────────────────────────────────

class VariacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Variacao
        fields = [
            "id", "nome", "sku_variacao", "estoque_atual",
            "preco_venda", "ativo",
        ]
        read_only_fields = ["id"]


# ─── Produto — Listagem (leve) ────────────────────────────────────────────────

class ProdutoListSerializer(serializers.ModelSerializer):
    categoria_nome = serializers.CharField(
        source="categoria.nome", read_only=True, default=None
    )
    categoria_cor = serializers.CharField(
        source="categoria.cor", read_only=True, default=None
    )
    status_estoque = serializers.CharField(read_only=True)

    class Meta:
        model = Produto
        fields = [
            "id", "nome", "sku", "categoria_nome", "categoria_cor",
            "preco_venda", "estoque_atual", "estoque_minimo",
            "status_estoque", "unidade", "imagem_url", "ativo",
        ]


# ─── Produto — Detalhe (completo) ─────────────────────────────────────────────

class ProdutoDetailSerializer(serializers.ModelSerializer):
    categoria_nome = serializers.CharField(
        source="categoria.nome", read_only=True, default=None
    )
    categoria_cor = serializers.CharField(
        source="categoria.cor", read_only=True, default=None
    )
    variacoes = VariacaoSerializer(many=True, read_only=True)
    margem_lucro = serializers.FloatField(read_only=True)
    esta_abaixo_minimo = serializers.BooleanField(read_only=True)
    esta_sem_estoque = serializers.BooleanField(read_only=True)
    status_estoque = serializers.CharField(read_only=True)
    valor_em_estoque = serializers.FloatField(read_only=True)
    total_movimentacoes = serializers.SerializerMethodField()
    criado_por_nome = serializers.CharField(
        source="criado_por.nome", read_only=True, default=None
    )

    class Meta:
        model = Produto
        fields = [
            "id", "nome", "descricao", "sku", "codigo_barras", "unidade",
            "preco_custo", "preco_venda", "estoque_atual", "estoque_minimo",
            "estoque_maximo", "imagem_url", "ativo",
            "categoria", "categoria_nome", "categoria_cor",
            "variacoes",
            "margem_lucro", "esta_abaixo_minimo", "esta_sem_estoque",
            "status_estoque", "valor_em_estoque", "total_movimentacoes",
            "criado_por_nome", "criado_em", "atualizado_em",
        ]

    def get_total_movimentacoes(self, obj):
        return obj.movimentacoes.count()


# ─── Produto — Criação/Atualização ────────────────────────────────────────────

class ProdutoCreateUpdateSerializer(serializers.ModelSerializer):
    preco_venda_warning = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Produto
        fields = [
            "id", "nome", "descricao", "sku", "codigo_barras", "unidade",
            "preco_custo", "preco_venda", "estoque_minimo", "estoque_maximo",
            "categoria", "imagem_url", "preco_venda_warning",
        ]
        read_only_fields = ["id"]

    def get_preco_venda_warning(self, obj):
        """Aviso se preço de venda < preço de custo (não é erro)."""
        if obj.preco_venda < obj.preco_custo:
            return "Atenção: preço de venda está abaixo do preço de custo."
        return None

    def validate(self, data):
        preco_custo = data.get("preco_custo", 0)
        preco_venda = data.get("preco_venda", 0)
        if preco_custo < 0:
            raise serializers.ValidationError(
                {"preco_custo": "O preço de custo não pode ser negativo."}
            )
        if preco_venda < 0:
            raise serializers.ValidationError(
                {"preco_venda": "O preço de venda não pode ser negativo."}
            )
        return data


# ─── Movimentação — Leitura ───────────────────────────────────────────────────

class MovimentacaoSerializer(serializers.ModelSerializer):
    produto_nome = serializers.CharField(source="produto.nome", read_only=True)
    variacao_nome = serializers.CharField(
        source="variacao.nome", read_only=True, default=None
    )
    criado_por_nome = serializers.CharField(
        source="criado_por.nome", read_only=True, default=None
    )
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    motivo_display = serializers.CharField(source="get_motivo_display", read_only=True)

    class Meta:
        model = Movimentacao
        fields = [
            "id", "produto", "produto_nome", "variacao", "variacao_nome",
            "tipo", "tipo_display", "quantidade", "estoque_antes", "estoque_depois",
            "motivo", "motivo_display", "referencia", "observacoes",
            "criado_por_nome", "criado_em",
        ]


# ─── Movimentação — Escrita ───────────────────────────────────────────────────

class MovimentacaoCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Movimentacao
        fields = [
            "produto", "variacao", "tipo", "quantidade",
            "motivo", "referencia", "observacoes",
        ]

    def validate_quantidade(self, value):
        if value <= 0:
            raise serializers.ValidationError("A quantidade deve ser maior que zero.")
        return value

    def validate(self, data):
        produto = data.get("produto")
        tipo = data.get("tipo")
        quantidade = data.get("quantidade", 0)
        variacao = data.get("variacao")

        if not produto:
            return data

        # Validar multi-tenant: produto deve pertencer à empresa do usuário
        request = self.context.get("request")
        if request and hasattr(request, "user") and request.user.is_authenticated:
            empresa_id = request.user.empresa_id
            if str(produto.empresa_id) != str(empresa_id):
                raise serializers.ValidationError(
                    {"produto": "Produto não encontrado."}
                )

        # Verificar estoque suficiente para saída
        if tipo == "saida":
            estoque = (
                variacao.estoque_atual if variacao else produto.estoque_atual
            )
            if estoque < quantidade:
                raise serializers.ValidationError(
                    {
                        "quantidade": (
                            f"Estoque insuficiente. Disponível: {estoque}, "
                            f"Solicitado: {quantidade}."
                        )
                    }
                )

        # Validar que variação pertence ao produto
        if variacao and variacao.produto_id != produto.id:
            raise serializers.ValidationError(
                {"variacao": "Esta variação não pertence ao produto informado."}
            )

        return data


# ─── Relatório de Estoque ─────────────────────────────────────────────────────

class RelatorioEstoqueSerializer(serializers.Serializer):
    total_produtos = serializers.IntegerField()
    total_skus = serializers.IntegerField()
    valor_total_estoque = serializers.DecimalField(max_digits=15, decimal_places=2)
    produtos_sem_estoque = serializers.IntegerField()
    produtos_abaixo_minimo = serializers.IntegerField()
    giro_medio = serializers.DecimalField(max_digits=10, decimal_places=2)
