"""
M5 — Fornecedores: Serializers
CategoriaFornecedor, FornecedorList, FornecedorDetail,
FornecedorCreateUpdate, Avaliacao, Compra, Ranking, Resumo
"""
from decimal import Decimal
from rest_framework import serializers

from .models import CategoriaFornecedor, Fornecedor, CompraFornecedor


# ─── Categoria ───────────────────────────────────────────────────────────────

class CategoriaFornecedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaFornecedor
        fields = ["id", "nome", "cor", "ativo", "criado_em"]
        read_only_fields = ["id", "criado_em"]

    def validate_nome(self, value):
        """Garante nome único por empresa."""
        request = self.context.get("request")
        empresa_id = request.user.empresa_id if request else None
        qs = CategoriaFornecedor.objects.filter(empresa_id=empresa_id, nome=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Já existe uma categoria com este nome.")
        return value


# ─── Compra (leitura) ─────────────────────────────────────────────────────────

class CompraFornecedorSerializer(serializers.ModelSerializer):
    fornecedor_nome = serializers.CharField(source="fornecedor.nome", read_only=True)
    criado_por_nome = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = CompraFornecedor
        fields = [
            "id", "fornecedor", "fornecedor_nome", "descricao", "valor",
            "data_compra", "numero_nf", "status", "status_display",
            "data_pagamento", "observacoes", "criado_por_nome", "criado_em",
        ]
        read_only_fields = ["id", "criado_em", "fornecedor_nome", "criado_por_nome", "status_display"]

    def get_criado_por_nome(self, obj):
        if obj.criado_por:
            return obj.criado_por.nome
        return None


# ─── Compra (criação) ─────────────────────────────────────────────────────────

class CompraFornecedorCreateSerializer(serializers.ModelSerializer):
    # fornecedor é injetado via URL, não precisa ser enviado no payload
    fornecedor = serializers.PrimaryKeyRelatedField(
        queryset=Fornecedor.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = CompraFornecedor
        fields = [
            "fornecedor", "descricao", "valor", "data_compra",
            "numero_nf", "status", "data_pagamento", "observacoes",
        ]

    def validate_valor(self, value):
        if value <= 0:
            raise serializers.ValidationError("O valor deve ser maior que zero.")
        return value

    def validate(self, data):
        status = data.get("status", "pendente")
        data_pagamento = data.get("data_pagamento")
        if status == "pago" and not data_pagamento:
            raise serializers.ValidationError(
                {"data_pagamento": "Data de pagamento é obrigatória para compras pagas."}
            )
        if status != "pago" and data_pagamento:
            data["data_pagamento"] = None
        return data


# ─── Fornecedor (lista leve) ──────────────────────────────────────────────────

class FornecedorListSerializer(serializers.ModelSerializer):
    categoria_nome = serializers.CharField(source="categoria.nome", read_only=True, default=None)
    categoria_cor = serializers.CharField(source="categoria.cor", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    avaliacao_geral = serializers.SerializerMethodField()
    link_whatsapp = serializers.SerializerMethodField()
    ticket_medio = serializers.SerializerMethodField()

    class Meta:
        model = Fornecedor
        fields = [
            "id", "nome", "categoria_nome", "categoria_cor", "status", "status_display",
            "email", "telefone", "whatsapp", "score_synapse", "avaliacao_geral",
            "valor_total_compras", "quantidade_pedidos", "ultima_compra",
            "ativo", "link_whatsapp", "ticket_medio",
        ]

    def get_avaliacao_geral(self, obj):
        return obj.avaliacao_geral

    def get_link_whatsapp(self, obj):
        return obj.link_whatsapp

    def get_ticket_medio(self, obj):
        return str(obj.ticket_medio)


# ─── Fornecedor (detalhe completo) ───────────────────────────────────────────

class FornecedorDetailSerializer(serializers.ModelSerializer):
    categoria_nome = serializers.CharField(source="categoria.nome", read_only=True, default=None)
    categoria_cor = serializers.CharField(source="categoria.cor", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    avaliacao_geral = serializers.SerializerMethodField()
    link_whatsapp = serializers.SerializerMethodField()
    ticket_medio = serializers.SerializerMethodField()
    compras = serializers.SerializerMethodField()
    total_compras = serializers.SerializerMethodField()
    criado_por_nome = serializers.SerializerMethodField()

    class Meta:
        model = Fornecedor
        fields = [
            "id", "nome", "nome_contato", "email", "telefone", "whatsapp",
            "site", "cnpj", "endereco_cidade", "endereco_estado",
            "categoria", "categoria_nome", "categoria_cor",
            "status", "status_display", "condicoes_pagamento", "prazo_entrega_dias",
            "valor_total_compras", "quantidade_pedidos", "ultima_compra",
            "avaliacao_qualidade", "avaliacao_prazo", "avaliacao_preco",
            "avaliacao_geral", "score_synapse", "notas", "ativo",
            "link_whatsapp", "ticket_medio", "compras", "total_compras",
            "criado_por_nome", "criado_em", "atualizado_em",
        ]
        read_only_fields = [
            "id", "criado_em", "atualizado_em", "score_synapse",
            "valor_total_compras", "quantidade_pedidos", "ultima_compra",
        ]

    def get_avaliacao_geral(self, obj):
        return obj.avaliacao_geral

    def get_link_whatsapp(self, obj):
        return obj.link_whatsapp

    def get_ticket_medio(self, obj):
        return str(obj.ticket_medio)

    def get_compras(self, obj):
        """Retorna as últimas 5 compras."""
        compras = obj.compras.select_related("criado_por").order_by("-data_compra")[:5]
        return CompraFornecedorSerializer(compras, many=True).data

    def get_total_compras(self, obj):
        return obj.compras.count()

    def get_criado_por_nome(self, obj):
        if obj.criado_por:
            return obj.criado_por.nome
        return None


# ─── Fornecedor (criação/edição) ──────────────────────────────────────────────

class FornecedorCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fornecedor
        fields = [
            "nome", "nome_contato", "email", "telefone", "whatsapp",
            "site", "cnpj", "endereco_cidade", "endereco_estado",
            "categoria", "status", "condicoes_pagamento",
            "prazo_entrega_dias", "notas",
        ]

    def validate_categoria(self, value):
        """Garante que a categoria pertence à empresa."""
        if value is None:
            return value
        request = self.context.get("request")
        empresa_id = request.user.empresa_id if request else None
        if str(value.empresa_id) != str(empresa_id):
            raise serializers.ValidationError("Categoria não pertence à sua empresa.")
        return value


# ─── Avaliação ────────────────────────────────────────────────────────────────

class AvaliacaoFornecedorSerializer(serializers.Serializer):
    avaliacao_qualidade = serializers.IntegerField(
        min_value=1, max_value=5,
        error_messages={
            "min_value": "Avaliação deve ser entre 1 e 5.",
            "max_value": "Avaliação deve ser entre 1 e 5.",
        }
    )
    avaliacao_prazo = serializers.IntegerField(
        min_value=1, max_value=5,
        error_messages={
            "min_value": "Avaliação deve ser entre 1 e 5.",
            "max_value": "Avaliação deve ser entre 1 e 5.",
        }
    )
    avaliacao_preco = serializers.IntegerField(
        min_value=1, max_value=5,
        error_messages={
            "min_value": "Avaliação deve ser entre 1 e 5.",
            "max_value": "Avaliação deve ser entre 1 e 5.",
        }
    )


# ─── Ranking ──────────────────────────────────────────────────────────────────

class RankingFornecedorSerializer(serializers.ModelSerializer):
    categoria_nome = serializers.CharField(source="categoria.nome", read_only=True, default=None)
    posicao = serializers.IntegerField(read_only=True)

    class Meta:
        model = Fornecedor
        fields = [
            "id", "nome", "categoria_nome", "score_synapse",
            "avaliacao_qualidade", "avaliacao_prazo", "avaliacao_preco",
            "valor_total_compras", "quantidade_pedidos", "posicao",
        ]


# ─── Resumo ───────────────────────────────────────────────────────────────────

class ResumoFornecedoresSerializer(serializers.Serializer):
    total_fornecedores = serializers.IntegerField()
    fornecedores_ativos = serializers.IntegerField()
    valor_total_gasto = serializers.DecimalField(max_digits=14, decimal_places=2)
    ticket_medio_geral = serializers.DecimalField(max_digits=12, decimal_places=2)
    melhor_score = serializers.DictField(allow_null=True)
    fornecedores_por_status = serializers.DictField()
