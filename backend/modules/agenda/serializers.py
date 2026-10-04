"""
Synapse — Módulo Agenda: Serializers DRF
"""
import re

from rest_framework import serializers

from modules.clientes.models import Cliente
from shared.modulos import modulo_ativo

from .models import CategoriaEvento, Evento


class CategoriaEventoSerializer(serializers.ModelSerializer):
    """Saída de leitura da categoria, com quantos eventos a usam."""

    eventos_count = serializers.SerializerMethodField()

    class Meta:
        model = CategoriaEvento
        fields = ["id", "nome", "cor", "ativo", "ordem", "eventos_count", "criado_em"]
        read_only_fields = ["id", "eventos_count", "criado_em"]

    def get_eventos_count(self, obj) -> int:
        return obj.eventos.count()


class CategoriaEventoCreateSerializer(serializers.ModelSerializer):
    """Entrada de criação/edição da categoria."""

    class Meta:
        model = CategoriaEvento
        fields = ["nome", "cor", "ativo", "ordem"]

    def validate_nome(self, value):
        nome = (value or "").strip()
        if len(nome) < 2:
            raise serializers.ValidationError("O nome precisa de ao menos 2 letras.")
        return nome

    def validate_cor(self, value):
        # A cor vai direto para um style inline; um valor torto viraria um
        # evento sem cor nenhuma na tela, sem erro nenhum aparecendo.
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", value or ""):
            raise serializers.ValidationError("Cor inválida (use o formato #RRGGBB).")
        return value

    def validate(self, attrs):
        """Nome repetido na mesma empresa é erro de digitação, não escolha."""
        nome = attrs.get("nome")
        if not nome:
            return attrs
        request = self.context.get("request")
        empresa_id = getattr(request.user, "empresa_id", None) if request else None
        if not empresa_id:
            return attrs
        existe = CategoriaEvento.objects.filter(
            empresa_id=empresa_id, nome__iexact=nome
        )
        if self.instance:
            existe = existe.exclude(pk=self.instance.pk)
        if existe.exists():
            raise serializers.ValidationError(
                {"nome": "Já existe uma categoria com esse nome. "
                         "Se ela está desativada, reative em vez de criar outra."}
            )
        return attrs


class EventoSerializer(serializers.ModelSerializer):
    """Saída de leitura — inclui os vínculos (cliente, projeto, venda)."""

    cliente_nome = serializers.SerializerMethodField()
    projeto_nome = serializers.SerializerMethodField()
    venda_rotulo = serializers.SerializerMethodField()
    criado_por_nome = serializers.SerializerMethodField()
    categoria_nome = serializers.SerializerMethodField()
    # A cor que a tela pinta. Sai da categoria quando há uma; senão, do campo
    # `cor` do próprio evento. A regra mora no modelo (`cor_efetiva`) para o
    # dashboard e o serializer não calcularem cada um a sua versão.
    cor_efetiva = serializers.CharField(read_only=True)

    class Meta:
        model = Evento
        fields = [
            "id",
            "titulo",
            "descricao",
            "data_inicio",
            "data_fim",
            "dia_inteiro",
            "local",
            "cor",
            "cor_efetiva",
            "categoria",
            "categoria_nome",
            "lembrete_antecedencia",
            "cliente",
            "cliente_nome",
            "projeto",
            "projeto_nome",
            "venda",
            "venda_rotulo",
            "criado_por",
            "criado_por_nome",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = [
            "id",
            "cor_efetiva",
            "categoria_nome",
            "cliente_nome",
            "projeto_nome",
            "venda_rotulo",
            "criado_por",
            "criado_por_nome",
            "criado_em",
            "atualizado_em",
        ]

    def get_categoria_nome(self, obj):
        return obj.categoria.nome if obj.categoria_id else None

    def get_cliente_nome(self, obj):
        return obj.cliente.nome if obj.cliente_id else None

    def get_projeto_nome(self, obj):
        return obj.projeto.nome if obj.projeto_id else None

    def get_venda_rotulo(self, obj):
        """
        Como a tela chama esta venda. Venda não tem nome, tem data — é por ela
        que a pessoa reconhece qual é.

        Sem valor em dinheiro de propósito: formatar moeda é trabalho do front
        (`formatCurrency`), e devolver "R$ 150.00" daqui produziria o formato
        errado justamente no campo onde ele salta aos olhos.
        """
        if not obj.venda_id:
            return None
        if not obj.venda.data_venda:
            return "Venda"
        return f"Venda de {obj.venda.data_venda.strftime('%d/%m/%Y')}"

    def get_criado_por_nome(self, obj):
        if obj.criado_por_id:
            return obj.criado_por.nome or obj.criado_por.email
        return None


class EventoCreateSerializer(serializers.ModelSerializer):
    """Entrada de criação/edição. Valida intervalo e vínculo multi-tenant."""

    class Meta:
        model = Evento
        fields = [
            "titulo",
            "descricao",
            "data_inicio",
            "data_fim",
            "dia_inteiro",
            "local",
            "cor",
            "categoria",
            "lembrete_antecedencia",
            "cliente",
            "projeto",
            "venda",
        ]

    def _empresa_id(self):
        """A empresa de quem está mandando o request, ou None fora de request."""
        request = self.context.get("request")
        return getattr(request.user, "empresa_id", None) if request else None

    def _mesma_empresa(self, obj) -> bool:
        """
        O objeto vinculado é da empresa de quem pede?

        Sem request (shell, admin, follow-up do CRM) não há com quem comparar, e
        aí o vínculo passa — quem monta esses caminhos já escolheu o objeto.
        """
        empresa_id = self._empresa_id()
        if not empresa_id:
            return True
        return str(obj.empresa_id) == str(empresa_id)

    def validate_projeto(self, value):
        """
        Projeto da MESMA empresa, e — quando o vínculo MUDA — só com o módulo
        Projetos ligado.

        As duas guardas respondem a furos distintos, e por isso têm alcances
        distintos:

        • **Empresa**: vale SEMPRE. Mandar o id do projeto do vizinho vazaria
          que ele existe, e isso não depende de módulo nenhum.

        • **Módulo desligado**: vale só quando o valor MUDA. Criar ou trocar um
          vínculo com o módulo off produziria algo que nenhuma tela mostra —
          invisível para quem criou e vivo no banco. Mas MANTER o vínculo que
          já estava lá tem de passar.

        A diferença não é teórica. Sem ela, uma empresa que vinculasse eventos
        a projetos e depois desligasse o módulo não conseguia mais EDITAR esses
        eventos — nem para corrigir o título ou a hora. O formulário reenvia o
        vínculo atual (o estado inicial vem de `evento.projeto`,
        independentemente do gating), então todo PATCH chegava com o projeto
        preenchido e levava 400, culpando um módulo que a pessoa desligou de
        propósito. E a tela não oferecia saída: com o módulo off o seletor nem
        aparece, logo não havia como limpar o vínculo pela interface.

        Isso contradizia a filosofia do próprio sistema — desligar OCULTA, não
        apaga. O vínculo sobrevivia, mas o evento virava somente-leitura
        (CODE_HEALTH_AUDIT, PR54-01).
        """
        if value is None:
            return value
        if not self._mesma_empresa(value):
            raise serializers.ValidationError("Projeto não pertence à sua empresa.")

        # Mesmo projeto que já estava vinculado? Então não há vínculo novo
        # sendo criado, e o módulo desligado não tem o que impedir.
        if str(getattr(self.instance, "projeto_id", "") or "") == str(value.pk):
            return value

        request = self.context.get("request")
        empresa = getattr(request.user, "empresa", None) if request else None
        if empresa is not None and not modulo_ativo(empresa, "projetos"):
            raise serializers.ValidationError(
                "O módulo Projetos está desativado. Ative em Configurações "
                "para vincular eventos a projetos."
            )
        return value

    def validate_venda(self, value):
        """
        Venda da MESMA empresa.

        Sem gating de módulo aqui, de propósito: "vendas" não é um módulo
        opcional (não está em MODULOS_OPCIONAIS) e as próprias views de venda
        não têm `ModuloAtivo`. Barrar só na agenda deixaria uma empresa com
        vendas no banco sem poder vinculá-las, enquanto a API de vendas
        continuaria respondendo — inconsistência nova, não segurança. Quem
        decide se o seletor aparece é o front, pelo mesmo critério que a
        Sidebar já usa para o item Vendas.
        """
        if value is None:
            return value
        if not self._mesma_empresa(value):
            raise serializers.ValidationError("Venda não pertence à sua empresa.")
        return value

    def validate_categoria(self, value):
        """
        Categoria tem de ser da MESMA empresa. Sem isto, mandar o id da
        categoria do vizinho pintaria o evento com a cor dele — e mais: daria
        para descobrir que aquela categoria existe.
        """
        if value is None:
            return value
        request = self.context.get("request")
        empresa_id = getattr(request.user, "empresa_id", None) if request else None
        if empresa_id and str(value.empresa_id) != str(empresa_id):
            raise serializers.ValidationError("Categoria não pertence à sua empresa.")
        return value

    def validate_cliente(self, value):
        """Cliente vinculado deve pertencer à mesma empresa do usuário."""
        if value is None:
            return value
        request = self.context.get("request")
        empresa_id = getattr(request.user, "empresa_id", None) if request else None
        if empresa_id and str(value.empresa_id) != str(empresa_id):
            raise serializers.ValidationError(
                "Cliente não pertence à sua empresa."
            )
        return value

    def validate(self, attrs):
        # Em PATCH, cair para o valor atual da instância quando o campo não vem
        inicio = attrs.get("data_inicio") or getattr(self.instance, "data_inicio", None)
        fim = attrs.get("data_fim") or getattr(self.instance, "data_fim", None)
        dia_inteiro = attrs.get("dia_inteiro")
        if dia_inteiro is None:
            dia_inteiro = getattr(self.instance, "dia_inteiro", False)

        if inicio and fim:
            # Dia inteiro: a hora é normalizada no save e não significa nada
            # aqui. Comparar por data — senão um evento de um dia só, criado
            # perto da meia-noite, seria recusado por horas que ninguém
            # escolheu e que a tela sequer mostra.
            if dia_inteiro:
                from django.utils import timezone

                fora_de_ordem = (
                    timezone.localtime(fim).date() < timezone.localtime(inicio).date()
                )
            else:
                fora_de_ordem = fim < inicio
            if fora_de_ordem:
                raise serializers.ValidationError(
                    {"data_fim": "A data de término não pode ser anterior à de início."}
                )
        return attrs
