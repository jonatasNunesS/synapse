"""
Synapse — Módulo Financeiro: Serializers
"""
from decimal import Decimal

from rest_framework import serializers

from .models import Categoria, Lancamento, LogEdicaoLancamento


# ════════════════════════════════════════════════════════════
# CATEGORIA
# ════════════════════════════════════════════════════════════

class CategoriaSerializer(serializers.ModelSerializer):
    """Serializer completo de Categoria (leitura e escrita)."""

    class Meta:
        model = Categoria
        exclude = ["empresa"]
        read_only_fields = ["id", "criado_em"]

    def validate(self, attrs):
        """Valida unicidade de nome+tipo por empresa."""
        request = self.context.get("request")
        empresa_id = getattr(getattr(request, "user", None), "empresa_id", None)

        nome = attrs.get("nome", getattr(self.instance, "nome", None))
        tipo = attrs.get("tipo", getattr(self.instance, "tipo", None))

        if empresa_id and nome and tipo:
            qs = Categoria.objects.filter(
                empresa_id=empresa_id,
                nome__iexact=nome,
                tipo=tipo,
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"nome": f"Já existe uma categoria '{nome}' do tipo '{tipo}' nesta empresa."}
                )
        return attrs


# ════════════════════════════════════════════════════════════
# LANÇAMENTO
# ════════════════════════════════════════════════════════════

class LancamentoSerializer(serializers.ModelSerializer):
    """Serializer completo de Lançamento (leitura)."""

    categoria_nome = serializers.CharField(
        source="categoria.nome", read_only=True, default=None
    )
    categoria_cor = serializers.CharField(
        source="categoria.cor", read_only=True, default=None
    )
    esta_atrasado = serializers.SerializerMethodField()

    class Meta:
        model = Lancamento
        exclude = ["empresa", "criado_por"]
        read_only_fields = [
            "id",
            "criado_em",
            "atualizado_em",
            "categoria_nome",
            "categoria_cor",
            "esta_atrasado",
        ]

    def get_esta_atrasado(self, obj) -> bool:
        return obj.esta_atrasado

    def validate_valor(self, value):
        if value <= Decimal("0"):
            raise serializers.ValidationError("O valor deve ser maior que zero.")
        return value

    def validate(self, attrs):
        status = attrs.get("status", getattr(self.instance, "status", "pendente"))
        data_pagamento = attrs.get(
            "data_pagamento", getattr(self.instance, "data_pagamento", None)
        )
        recorrente = attrs.get("recorrente", getattr(self.instance, "recorrente", False))
        recorrencia = attrs.get("recorrencia", getattr(self.instance, "recorrencia", ""))

        # data_pagamento só permitida se status=pago
        if data_pagamento and status != "pago":
            raise serializers.ValidationError(
                {"data_pagamento": "Data de pagamento só é permitida quando o status é 'pago'."}
            )

        # se recorrente=True, recorrencia é obrigatório
        if recorrente and not recorrencia:
            raise serializers.ValidationError(
                {"recorrencia": "O campo recorrência é obrigatório quando o lançamento é recorrente."}
            )

        return attrs


class LancamentoCreateSerializer(LancamentoSerializer):
    """Serializer para criação/edição de Lançamento."""

    class Meta(LancamentoSerializer.Meta):
        exclude = ["empresa", "criado_por"]
        read_only_fields = ["id", "criado_em", "atualizado_em"]


# ════════════════════════════════════════════════════════════
# LOG DE EDIÇÃO (AUDITORIA)
# ════════════════════════════════════════════════════════════

class MotivoSerializer(serializers.Serializer):
    """Valida o motivo obrigatório das operações auditadas em lançamentos pagos."""

    motivo = serializers.CharField(
        min_length=5,
        max_length=500,
        trim_whitespace=True,
        error_messages={
            "required": "O motivo é obrigatório para esta operação.",
            "blank": "O motivo é obrigatório para esta operação.",
            "min_length": "O motivo deve ter no mínimo 5 caracteres.",
            "max_length": "O motivo deve ter no máximo 500 caracteres.",
        },
    )


class LogEdicaoLancamentoSerializer(serializers.ModelSerializer):
    """Serializer de leitura do log de auditoria de lançamentos."""

    editado_por_nome = serializers.SerializerMethodField()
    acao_display = serializers.SerializerMethodField()

    class Meta:
        model = LogEdicaoLancamento
        fields = [
            "id",
            "lancamento",
            "acao",
            "acao_display",
            "motivo",
            "editado_por",
            "editado_por_nome",
            "editado_em",
            "snapshot_antes",
            "snapshot_depois",
        ]

    def get_editado_por_nome(self, obj):
        if obj.editado_por:
            return obj.editado_por.nome or obj.editado_por.email
        return None

    def get_acao_display(self, obj):
        return obj.get_acao_display()


# ════════════════════════════════════════════════════════════
# RESUMO FINANCEIRO
# ════════════════════════════════════════════════════════════

class ResumoFinanceiroSerializer(serializers.Serializer):
    """Serializer para o resumo financeiro do mês."""

    total_receitas = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_despesas = serializers.DecimalField(max_digits=14, decimal_places=2)
    saldo = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_pendente = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_atrasado = serializers.DecimalField(max_digits=14, decimal_places=2)
    lancamentos_count = serializers.IntegerField()


# ════════════════════════════════════════════════════════════
# FLUXO DE CAIXA
# ════════════════════════════════════════════════════════════

class FluxoCaixaDiaSerializer(serializers.Serializer):
    """Serializer para um dia do fluxo de caixa."""

    data = serializers.DateField()
    receitas = serializers.DecimalField(max_digits=14, decimal_places=2)
    despesas = serializers.DecimalField(max_digits=14, decimal_places=2)
    saldo = serializers.DecimalField(max_digits=14, decimal_places=2)


# ════════════════════════════════════════════════════════════
# DRE
# ════════════════════════════════════════════════════════════

class DRECategoriaSerializer(serializers.Serializer):
    """Serializer para linha do DRE por categoria."""

    categoria_id = serializers.UUIDField(allow_null=True)
    categoria = serializers.CharField()
    cor = serializers.CharField()
    total = serializers.DecimalField(max_digits=14, decimal_places=2)


class DRESerializer(serializers.Serializer):
    """Serializer para o DRE simplificado."""

    receitas_por_categoria = DRECategoriaSerializer(many=True)
    despesas_por_categoria = DRECategoriaSerializer(many=True)
    total_receitas = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_despesas = serializers.DecimalField(max_digits=14, decimal_places=2)
    lucro_bruto = serializers.DecimalField(max_digits=14, decimal_places=2)
    margem = serializers.DecimalField(max_digits=6, decimal_places=2)
