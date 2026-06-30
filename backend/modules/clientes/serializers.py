import re
from rest_framework import serializers
from .models import Cliente, InteracaoCliente


# ─── Interação (leitura) ──────────────────────────────────────────────────────

class InteracaoClienteSerializer(serializers.ModelSerializer):
    criado_por_nome = serializers.SerializerMethodField()
    tipo_display = serializers.SerializerMethodField()

    class Meta:
        model = InteracaoCliente
        fields = [
            "id",
            "tipo",
            "tipo_display",
            "titulo",
            "descricao",
            "valor",
            "data_interacao",
            "proximo_followup",
            "criado_por",
            "criado_por_nome",
            "criado_em",
        ]

    def get_criado_por_nome(self, obj):
        if obj.criado_por:
            return obj.criado_por.nome or obj.criado_por.email
        return None

    def get_tipo_display(self, obj):
        return obj.get_tipo_display()


# ─── Interação (criação) ──────────────────────────────────────────────────────

class InteracaoClienteCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = InteracaoCliente
        fields = [
            "cliente",
            "tipo",
            "titulo",
            "descricao",
            "valor",
            "data_interacao",
            "proximo_followup",
        ]
        extra_kwargs = {
            "cliente": {"required": False},
            "data_interacao": {"required": False},
        }

    def to_internal_value(self, data):
        # O formulário do frontend envia strings vazias ("") para datas/valor
        # não preenchidos. O DRF DateField/DateTimeField rejeita "" com erro de
        # formato — normalizamos antes da validação para evitar 400 indevido.
        if hasattr(data, "dict"):  # QueryDict → dict mutável
            data = data.dict()
        else:
            data = dict(data)
        if data.get("proximo_followup") == "":
            data["proximo_followup"] = None
        if data.get("valor") == "":
            data["valor"] = None
        if data.get("data_interacao") == "":
            # Sem data informada: deixa o default do model (timezone.now) agir.
            data.pop("data_interacao", None)
        return super().to_internal_value(data)

    def validate(self, attrs):
        tipo = attrs.get("tipo")
        valor = attrs.get("valor")
        if tipo == "venda" and (valor is None or valor <= 0):
            raise serializers.ValidationError(
                {"valor": "O valor deve ser maior que 0 para interações do tipo venda."}
            )
        return attrs


# ─── Cliente (listagem leve) ──────────────────────────────────────────────────

class ClienteListSerializer(serializers.ModelSerializer):
    ticket_medio = serializers.SerializerMethodField()
    followup_atrasado = serializers.SerializerMethodField()
    link_whatsapp = serializers.SerializerMethodField()
    status_funil_display = serializers.SerializerMethodField()
    origem_display = serializers.SerializerMethodField()
    tipo_display = serializers.SerializerMethodField()

    class Meta:
        model = Cliente
        fields = [
            "id",
            "nome",
            "tipo",
            "tipo_display",
            "email",
            "telefone",
            "whatsapp",
            "status_funil",
            "status_funil_display",
            "origem",
            "origem_display",
            "valor_total_compras",
            "quantidade_compras",
            "ultima_compra",
            "ticket_medio",
            "followup_atrasado",
            "proximo_followup",
            "ativo",
            "link_whatsapp",
            "criado_em",
        ]

    def get_ticket_medio(self, obj):
        return str(obj.ticket_medio)

    def get_followup_atrasado(self, obj):
        return obj.followup_atrasado

    def get_link_whatsapp(self, obj):
        return obj.link_whatsapp

    def get_status_funil_display(self, obj):
        return obj.get_status_funil_display()

    def get_origem_display(self, obj):
        return obj.get_origem_display() if obj.origem else ""

    def get_tipo_display(self, obj):
        return obj.get_tipo_display()


# ─── Cliente (detalhe completo) ───────────────────────────────────────────────

class ClienteDetailSerializer(serializers.ModelSerializer):
    ticket_medio = serializers.SerializerMethodField()
    followup_atrasado = serializers.SerializerMethodField()
    link_whatsapp = serializers.SerializerMethodField()
    dias_sem_compra = serializers.SerializerMethodField()
    total_interacoes = serializers.SerializerMethodField()
    interacoes = serializers.SerializerMethodField()
    status_funil_display = serializers.SerializerMethodField()
    origem_display = serializers.SerializerMethodField()
    tipo_display = serializers.SerializerMethodField()
    lista_tags = serializers.SerializerMethodField()
    criado_por_nome = serializers.SerializerMethodField()

    class Meta:
        model = Cliente
        fields = [
            "id",
            "nome",
            "tipo",
            "tipo_display",
            "email",
            "telefone",
            "whatsapp",
            "documento",
            "nome_empresa",
            "endereco_cidade",
            "endereco_estado",
            "segmento",
            "status_funil",
            "status_funil_display",
            "origem",
            "origem_display",
            "valor_total_compras",
            "quantidade_compras",
            "ultima_compra",
            "proximo_followup",
            "tags",
            "lista_tags",
            "notas",
            "ativo",
            "ticket_medio",
            "dias_sem_compra",
            "followup_atrasado",
            "link_whatsapp",
            "total_interacoes",
            "interacoes",
            "criado_por",
            "criado_por_nome",
            "criado_em",
            "atualizado_em",
        ]

    def get_ticket_medio(self, obj):
        return str(obj.ticket_medio)

    def get_followup_atrasado(self, obj):
        return obj.followup_atrasado

    def get_link_whatsapp(self, obj):
        return obj.link_whatsapp

    def get_dias_sem_compra(self, obj):
        return obj.dias_sem_compra

    def get_total_interacoes(self, obj):
        return obj.interacoes.count()

    def get_interacoes(self, obj):
        ultimas = obj.interacoes.select_related("criado_por").order_by(
            "-data_interacao"
        )[:10]
        return InteracaoClienteSerializer(ultimas, many=True).data

    def get_status_funil_display(self, obj):
        return obj.get_status_funil_display()

    def get_origem_display(self, obj):
        return obj.get_origem_display() if obj.origem else ""

    def get_tipo_display(self, obj):
        return obj.get_tipo_display()

    def get_lista_tags(self, obj):
        return obj.lista_tags

    def get_criado_por_nome(self, obj):
        if obj.criado_por:
            return obj.criado_por.nome or obj.criado_por.email
        return None


# ─── Cliente (criar/editar) ───────────────────────────────────────────────────

def _validar_cpf(cpf: str) -> bool:
    """Valida CPF (apenas dígitos, 11 caracteres)."""
    cpf = re.sub(r"\D", "", cpf)
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False
    for i in range(9, 11):
        soma = sum(int(cpf[j]) * (i + 1 - j) for j in range(i))
        digito = (soma * 10 % 11) % 10
        if digito != int(cpf[i]):
            return False
    return True


def _validar_cnpj(cnpj: str) -> bool:
    """Valida CNPJ (apenas dígitos, 14 caracteres)."""
    cnpj = re.sub(r"\D", "", cnpj)
    if len(cnpj) != 14 or cnpj == cnpj[0] * 14:
        return False
    pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    soma1 = sum(int(cnpj[i]) * pesos1[i] for i in range(12))
    d1 = 0 if soma1 % 11 < 2 else 11 - soma1 % 11
    soma2 = sum(int(cnpj[i]) * pesos2[i] for i in range(13))
    d2 = 0 if soma2 % 11 < 2 else 11 - soma2 % 11
    return int(cnpj[12]) == d1 and int(cnpj[13]) == d2


class ClienteCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = [
            "nome",
            "tipo",
            "email",
            "telefone",
            "whatsapp",
            "documento",
            "nome_empresa",
            "endereco_cidade",
            "endereco_estado",
            "segmento",
            "status_funil",
            "origem",
            "proximo_followup",
            "tags",
            "notas",
            "ativo",
        ]

    def validate_email(self, value):
        if value:
            # Validação básica de formato (o EmailField já valida, mas garantimos)
            if "@" not in value or "." not in value.split("@")[-1]:
                raise serializers.ValidationError("Informe um e-mail válido.")
        return value

    def validate_documento(self, value):
        if value:
            apenas_digitos = re.sub(r"\D", "", value)
            if len(apenas_digitos) == 11:
                if not _validar_cpf(value):
                    raise serializers.ValidationError("CPF inválido.")
            elif len(apenas_digitos) == 14:
                if not _validar_cnpj(value):
                    raise serializers.ValidationError("CNPJ inválido.")
            else:
                raise serializers.ValidationError(
                    "Documento deve ser um CPF (11 dígitos) ou CNPJ (14 dígitos)."
                )
        return value


# ─── Funil Kanban ─────────────────────────────────────────────────────────────

class ClienteFunilCardSerializer(serializers.ModelSerializer):
    """Serializer leve para cards do Kanban."""
    origem_display = serializers.SerializerMethodField()

    class Meta:
        model = Cliente
        fields = [
            "id",
            "nome",
            "tipo",
            "valor_total_compras",
            "origem",
            "origem_display",
            "criado_em",
            "proximo_followup",
        ]

    def get_origem_display(self, obj):
        return obj.get_origem_display() if obj.origem else ""


class FunilSerializer(serializers.Serializer):
    """Serializer para o funil Kanban agrupado por status."""
    lead = serializers.ListField(child=serializers.DictField())
    contato = serializers.ListField(child=serializers.DictField())
    proposta = serializers.ListField(child=serializers.DictField())
    negociacao = serializers.ListField(child=serializers.DictField())
    fechado = serializers.ListField(child=serializers.DictField())
    perdido = serializers.ListField(child=serializers.DictField())
    totais = serializers.DictField()


# ─── Resumo do CRM ────────────────────────────────────────────────────────────

class ResumoClientesSerializer(serializers.Serializer):
    total_clientes = serializers.IntegerField()
    clientes_ativos = serializers.IntegerField()
    novos_este_mes = serializers.IntegerField()
    valor_total_gerado = serializers.DecimalField(max_digits=14, decimal_places=2)
    ticket_medio_geral = serializers.DecimalField(max_digits=14, decimal_places=2)
    followups_atrasados = serializers.IntegerField()
    clientes_por_status = serializers.DictField()


# ─── Mover no Funil ───────────────────────────────────────────────────────────

class MoverFunilSerializer(serializers.Serializer):
    status_funil = serializers.ChoiceField(choices=Cliente.STATUS_FUNIL)
