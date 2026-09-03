"""
Synapse — Vendas: Serializers.

Regra que atravessa este arquivo: subtotal e total NÃO são campos de entrada.
Chegam calculados do backend e saem somente-leitura. O que a interface soma
enquanto a pessoa monta a venda serve para ela ver o valor na hora — o número
que vale é o que o servidor devolve.
"""
from datetime import date
from decimal import Decimal

from rest_framework import serializers

from modules.clientes.models import Cliente
from modules.estoque.models import Produto

from .models import ItemVenda, Venda


class ItemVendaSerializer(serializers.ModelSerializer):
    """Item como sai para a tela."""

    produto_nome = serializers.SerializerMethodField()
    produto_unidade = serializers.SerializerMethodField()

    class Meta:
        model = ItemVenda
        fields = [
            "id",
            "produto",
            "produto_nome",
            "produto_unidade",
            "descricao",
            "quantidade",
            "preco_unitario",
            "subtotal",
        ]
        read_only_fields = ["id", "subtotal"]

    def get_produto_nome(self, obj) -> str:
        # Item livre não tem produto; o nome é a descrição.
        return obj.nome_exibido

    def get_produto_unidade(self, obj) -> str:
        return obj.produto.unidade if obj.produto_id else ""


class ItemVendaCreateSerializer(serializers.Serializer):
    """Item como entra. Sem subtotal: ele é derivado."""

    produto = serializers.UUIDField(required=False, allow_null=True)
    descricao = serializers.CharField(
        max_length=255, required=False, allow_blank=True
    )
    quantidade = serializers.DecimalField(max_digits=12, decimal_places=3)
    preco_unitario = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False
    )

    def validate(self, attrs):
        # Sem produto, a linha precisa dizer o que é. E sem produto o preço
        # não tem de onde vir: é obrigatório informar.
        if not attrs.get("produto"):
            if not (attrs.get("descricao") or "").strip():
                raise serializers.ValidationError(
                    {"descricao": "Informe a descrição quando o item não tem produto."}
                )
            if attrs.get("preco_unitario") is None:
                raise serializers.ValidationError(
                    {"preco_unitario": "Informe o preço quando o item não tem produto."}
                )
        return attrs

    def validate_quantidade(self, value):
        if value <= 0:
            raise serializers.ValidationError("A quantidade deve ser maior que zero.")
        return value

    def validate_preco_unitario(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("O preço não pode ser negativo.")
        return value


class VendaSerializer(serializers.ModelSerializer):
    """Venda como sai para a tela, com os itens dentro."""

    itens = ItemVendaSerializer(many=True, read_only=True)
    cliente_nome = serializers.SerializerMethodField()
    # Estado das integrações. A tela precisa disso para saber se oferece a ação
    # ou avisa que já foi feita — é o que impede o clique que duplicaria.
    ja_baixou_estoque = serializers.SerializerMethodField()
    tem_itens_com_produto = serializers.SerializerMethodField()
    tem_lancamento_financeiro = serializers.SerializerMethodField()
    # Fiado: o que a tela precisa para o badge e para a cobrança.
    saldo_devedor = serializers.SerializerMethodField()
    pagamento_atrasado = serializers.SerializerMethodField()
    # Dias até a previsão (negativo se já venceu; null se não aplicável).
    dias_para_vencer = serializers.SerializerMethodField()

    class Meta:
        model = Venda
        fields = [
            "id",
            "cliente",
            "cliente_nome",
            "data_venda",
            "subtotal",
            "desconto",
            "total",
            "forma_pagamento",
            "status_pagamento",
            "data_prevista_pagamento",
            "devedor",
            "valor_recebido",
            "saldo_devedor",
            "pagamento_atrasado",
            "dias_para_vencer",
            "observacoes",
            "itens",
            "ja_baixou_estoque",
            "tem_itens_com_produto",
            "tem_lancamento_financeiro",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["id", "subtotal", "total", "criado_em", "atualizado_em"]

    def get_ja_baixou_estoque(self, obj) -> bool:
        return obj.movimentacoes.exists()

    def get_tem_itens_com_produto(self, obj) -> bool:
        # Venda só de item livre (serviço, ou venda migrada) não tem estoque a
        # baixar — a tela não deve nem oferecer.
        return any(item.produto_id for item in obj.itens.all())

    def get_tem_lancamento_financeiro(self, obj) -> bool:
        return obj.lancamento_financeiro_id is not None

    def get_cliente_nome(self, obj) -> str | None:
        # None e não "Sem cliente": quem decide como exibir a ausência é a
        # interface, não o serializer.
        return obj.cliente.nome if obj.cliente else None

    def get_saldo_devedor(self, obj) -> str:
        return str(obj.saldo_devedor)

    def get_pagamento_atrasado(self, obj) -> bool:
        return bool(
            obj.status_pagamento == "pendente"
            and obj.data_prevista_pagamento is not None
            and obj.data_prevista_pagamento < date.today()
        )

    def get_dias_para_vencer(self, obj) -> int | None:
        # Só faz sentido para o que ainda se cobra e tem data marcada.
        if obj.status_pagamento != "pendente" or obj.data_prevista_pagamento is None:
            return None
        return (obj.data_prevista_pagamento - date.today()).days


class VendaCreateSerializer(serializers.Serializer):
    """
    Venda como entra — cabeçalho e itens numa requisição só.

    Resolve as chaves estrangeiras já filtrando por empresa: produto ou
    cliente de outra empresa não é "não encontrado", é tentativa de alcançar
    dado alheio, e para aqui.
    """

    cliente = serializers.UUIDField(required=False, allow_null=True)
    data_venda = serializers.DateField(required=False)
    desconto = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, default=Decimal("0")
    )
    forma_pagamento = serializers.ChoiceField(
        choices=Venda.FORMA_PAGAMENTO_CHOICES, required=False, allow_blank=True
    )
    status_pagamento = serializers.ChoiceField(
        choices=Venda.STATUS_PAGAMENTO_CHOICES, required=False
    )
    data_prevista_pagamento = serializers.DateField(required=False, allow_null=True)
    # Fiado de balcão: quem ficou devendo, quando não há cliente cadastrado.
    devedor = serializers.CharField(
        max_length=255, required=False, allow_blank=True
    )
    observacoes = serializers.CharField(required=False, allow_blank=True)
    itens = ItemVendaCreateSerializer(many=True)

    def __init__(self, *args, **kwargs):
        self.empresa_id = kwargs.pop("empresa_id", None)
        # No PATCH os itens podem não vir — significa "não mexi neles".
        self.parcial = kwargs.pop("parcial", False)
        super().__init__(*args, **kwargs)
        if self.parcial:
            for campo in self.fields.values():
                campo.required = False

    def validate_desconto(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("O desconto não pode ser negativo.")
        return value

    def validate_itens(self, value):
        if not value:
            raise serializers.ValidationError("A venda precisa de ao menos um item.")
        return value

    def validate_cliente(self, value):
        if value is None:
            return None
        cliente = Cliente.objects.filter(id=value, empresa_id=self.empresa_id).first()
        if not cliente:
            raise serializers.ValidationError("Cliente não encontrado.")
        return cliente

    def validate(self, attrs):
        itens = attrs.get("itens")

        if itens is not None:
            resolvidos = []
            subtotal = Decimal("0")
            for item in itens:
                produto = None
                if item.get("produto"):
                    produto = Produto.objects.filter(
                        id=item["produto"], empresa_id=self.empresa_id
                    ).first()
                    if not produto:
                        raise serializers.ValidationError(
                            {"itens": f"Produto {item['produto']} não encontrado."}
                        )
                # Preço em branco cai no do cadastro — o caso comum é vender
                # pelo preço de tabela. Item livre já teve o preço exigido.
                preco = item.get("preco_unitario")
                if preco is None:
                    preco = produto.preco_venda
                resolvidos.append(
                    {
                        "produto": produto,
                        "descricao": (item.get("descricao") or "").strip(),
                        "quantidade": item["quantidade"],
                        "preco_unitario": preco,
                    }
                )
                subtotal += item["quantidade"] * preco
            attrs["itens"] = resolvidos
            attrs["_subtotal_previsto"] = subtotal

        # Fiado precisa de data: sem previsão não há dia para cobrar, e a venda
        # ficaria pendente para sempre sem nunca aparecer no sino.
        #
        # A exigência vale quando ESTA requisição diz "pendente". Não vale para
        # quem só edita outra coisa numa venda que já era pendente — entre elas
        # as migradas da fase 2, que podem não ter previsão nenhuma e não
        # devem virar reféns de um campo que a migração não tinha de onde tirar.
        if attrs.get("status_pagamento") == "pendente":
            prevista = attrs.get("data_prevista_pagamento")
            if prevista is None and self.instance is not None:
                prevista = self.instance.data_prevista_pagamento
            if prevista is None:
                raise serializers.ValidationError(
                    {
                        "data_prevista_pagamento":
                            "Informe quando a venda a prazo deve ser paga."
                    }
                )

        # Desconto é validado contra o subtotal que ESTES itens produzem, e
        # não contra o total salvo — senão um PATCH que baixa os itens
        # deixaria passar um desconto que virou grande demais.
        desconto = attrs.get("desconto")
        if desconto is not None:
            subtotal = attrs.get("_subtotal_previsto")
            if subtotal is None and self.instance is not None:
                subtotal = self.instance.subtotal
            if subtotal is not None and desconto > subtotal:
                raise serializers.ValidationError(
                    {"desconto": "O desconto não pode ser maior que o subtotal da venda."}
                )

        return attrs
