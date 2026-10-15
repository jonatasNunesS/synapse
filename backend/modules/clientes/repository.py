from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import (
    Avg, Case, Count, DecimalField, F, Max, Q, Sum, Value, When,
)
from django.utils import timezone

from .models import Cliente, InteracaoCliente
from .serializers import ClienteFunilCardSerializer

# Nomes dos meses em pt-BR (índice 1..12) para rótulos e comparativos.
MESES_PT = [
    "", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]


def _parse_int(valor):
    """Converte para int com segurança; retorna None se vazio/inválido."""
    if valor in (None, ""):
        return None
    try:
        return int(valor)
    except (TypeError, ValueError):
        return None


def _mes_anterior(mes: int, ano: int) -> tuple:
    """Mês/ano imediatamente anterior (vira o ano em janeiro)."""
    if mes == 1:
        return 12, ano - 1
    return mes - 1, ano


class ClienteRepository:
    """Camada de acesso a dados para o módulo de Clientes."""

    @staticmethod
    def listar_clientes(empresa_id, filtros: dict):
        """Retorna QuerySet de clientes com filtros aplicados."""
        qs = Cliente.objects.filter(empresa_id=empresa_id)

        # Filtro de status do funil
        status_funil = filtros.get("status_funil")
        if status_funil:
            qs = qs.filter(status_funil=status_funil)

        # Filtro de origem
        origem = filtros.get("origem")
        if origem:
            qs = qs.filter(origem=origem)

        # Filtro de ativo
        ativo = filtros.get("ativo")
        if ativo is not None:
            if isinstance(ativo, str):
                ativo = ativo.lower() in ("true", "1", "yes")
            qs = qs.filter(ativo=ativo)

        # Filtro de busca (nome, email, telefone, documento)
        busca = filtros.get("busca")
        if busca:
            qs = qs.filter(
                Q(nome__icontains=busca)
                | Q(email__icontains=busca)
                | Q(telefone__icontains=busca)
                | Q(documento__icontains=busca)
                | Q(nome_empresa__icontains=busca)
            )

        # Filtro de tags
        tags = filtros.get("tags")
        if tags:
            qs = qs.filter(tags__icontains=tags)

        # Filtro de follow-up atrasado
        followup_atrasado = filtros.get("tem_followup_atrasado")
        if followup_atrasado in (True, "true", "1"):
            qs = qs.filter(proximo_followup__lt=date.today())

        # Filtro de período por data de cadastro (mês/ano). Independentes:
        # ?ano=2026 filtra o ano; ?mes=7 filtra o mês; juntos, o mês/ano exato.
        ano = _parse_int(filtros.get("ano"))
        mes = _parse_int(filtros.get("mes"))
        if ano:
            qs = qs.filter(criado_em__year=ano)
        if mes:
            qs = qs.filter(criado_em__month=mes)

        return qs.select_related("criado_por").order_by("-criado_em")

    @staticmethod
    def obter_por_id(empresa_id, cliente_id):
        """Retorna um cliente específico verificando multi-tenant."""
        try:
            return Cliente.objects.select_related("criado_por").get(
                id=cliente_id, empresa_id=empresa_id
            )
        except Cliente.DoesNotExist:
            return None

    @staticmethod
    def criar_cliente(empresa_id, usuario_id, dados: dict) -> Cliente:
        """Cria um novo cliente."""
        return Cliente.objects.create(
            empresa_id=empresa_id,
            criado_por_id=usuario_id,
            **dados,
        )

    @staticmethod
    def atualizar_cliente(cliente: Cliente, dados: dict) -> Cliente:
        """Atualiza um cliente existente."""
        for field, value in dados.items():
            setattr(cliente, field, value)
        cliente.save()
        return cliente

    @staticmethod
    def soft_delete_cliente(cliente: Cliente) -> Cliente:
        """Soft delete: marca como inativo."""
        cliente.ativo = False
        cliente.save(update_fields=["ativo", "atualizado_em"])
        return cliente

    @staticmethod
    def mover_funil(cliente: Cliente, novo_status: str) -> Cliente:
        """Atualiza o status do funil de um cliente."""
        cliente.status_funil = novo_status
        cliente.save(update_fields=["status_funil", "atualizado_em"])
        return cliente

    @staticmethod
    def obter_funil(empresa_id) -> dict:
        """
        Retorna clientes agrupados por status_funil para o Kanban.
        Máximo 50 por coluna para performance.
        """
        STATUS_FUNIL = [
            "lead", "contato", "proposta", "negociacao", "fechado", "perdido"
        ]

        resultado = {}
        totais = {}

        for status in STATUS_FUNIL:
            clientes_status = Cliente.objects.filter(
                empresa_id=empresa_id,
                status_funil=status,
                ativo=True,
            ).order_by("-criado_em")[:50]

            # Calcular totais para a coluna
            agg = Cliente.objects.filter(
                empresa_id=empresa_id,
                status_funil=status,
                ativo=True,
            ).aggregate(
                count=Count("id"),
                valor_total=Sum("valor_total_compras"),
            )

            resultado[status] = ClienteFunilCardSerializer(
                clientes_status, many=True
            ).data
            totais[status] = {
                "count": agg["count"] or 0,
                "valor_total": str(agg["valor_total"] or 0),
            }

        resultado["totais"] = totais
        return resultado

    @staticmethod
    def _novos_no_periodo(empresa_id, mes: int, ano: int) -> int:
        return Cliente.objects.filter(
            empresa_id=empresa_id, criado_em__year=ano, criado_em__month=mes
        ).count()

    @staticmethod
    def _valor_gerado_no_periodo(empresa_id, mes: int, ano: int):
        """
        Receita gerada no mês = soma das VENDAS (não canceladas) do período.

        Lia `InteracaoCliente` tipo="venda" — o último leitor da fonte antiga
        a sobrar depois do B10, e o motivo de o cartão "Receita no Período" do
        CRM mostrar R$ 0 para um mês que teve venda. `data_venda` é `DateField`
        e o filtro por mês não tem conversão de fuso para errar.
        """
        from modules.vendas.models import Venda

        return (
            Venda.objects.filter(
                empresa_id=empresa_id,
                data_venda__year=ano,
                data_venda__month=mes,
            )
            .exclude(status_pagamento="cancelado")
            .aggregate(s=Sum("total"))["s"]
            or 0
        )

    @staticmethod
    def resumo_periodo(empresa_id, mes: int, ano: int) -> dict:
        """
        KPIs do período + comparativo automático com o mês anterior.
        followups_atrasados NÃO entra aqui (é sempre "hoje", vem do resumo base).
        """
        novos = ClienteRepository._novos_no_periodo(empresa_id, mes, ano)
        valor = ClienteRepository._valor_gerado_no_periodo(empresa_id, mes, ano)

        mes_ant, ano_ant = _mes_anterior(mes, ano)
        novos_ant = ClienteRepository._novos_no_periodo(empresa_id, mes_ant, ano_ant)

        return {
            "periodo": {
                "mes": mes,
                "ano": ano,
                "label": f"{MESES_PT[mes]} {ano}",
            },
            "novos_no_periodo": novos,
            "valor_gerado_no_periodo": valor,
            "comparativo": {
                "novos_mes_anterior": novos_ant,
                "novos_diff": novos - novos_ant,
                "mes_anterior_label": MESES_PT[mes_ant],
            },
        }

    @staticmethod
    def calcular_resumo(empresa_id, mes: int = None, ano: int = None) -> dict:
        """
        KPIs do CRM para a empresa. Se mes/ano forem informados, adiciona os
        KPIs do período (novos_no_periodo, valor_gerado_no_periodo) e o
        comparativo com o mês anterior — mantendo os campos base (retrocompatível).
        """
        hoje = timezone.localdate()
        inicio_mes = hoje.replace(day=1)

        base_qs = Cliente.objects.filter(empresa_id=empresa_id)

        total_clientes = base_qs.count()
        clientes_ativos = base_qs.filter(ativo=True).count()
        novos_este_mes = base_qs.filter(criado_em__date__gte=inicio_mes).count()

        agg = base_qs.filter(ativo=True).aggregate(
            valor_total=Sum("valor_total_compras"),
        )

        # Ticket médio é POR VENDA, não por cliente.
        #
        # Era `Avg("valor_total_compras")`: a média do quanto cada cliente
        # comprou, diluída por todo lead que nunca comprou nada. Dez clientes
        # e uma venda de R$ 450 davam R$ 45, e o cartão do dashboard chamava
        # isso de "Ticket médio". Não é — é receita média por cliente, que é
        # outra pergunta e ninguém estava fazendo.
        #
        # Agora é a conta que o nome promete: total das vendas ÷ número de
        # vendas. Canceladas ficam de fora, como em todo o resto do módulo.
        from modules.vendas.models import Venda

        vendas_qs = Venda.objects.filter(empresa_id=empresa_id).exclude(
            status_pagamento="cancelado"
        )
        ticket = vendas_qs.aggregate(m=Avg("total"))["m"]

        followups_atrasados = base_qs.filter(
            ativo=True,
            proximo_followup__lt=hoje,
        ).count()

        # O cartão "Follow-ups Hoje" do CRM lia um campo que o resumo nunca
        # devolveu, e por isso mostrava 0 sempre. Agora tem de onde ler.
        followups_hoje = base_qs.filter(
            ativo=True,
            proximo_followup=hoje,
        ).count()

        # Clientes por status
        por_status_qs = (
            base_qs.filter(ativo=True)
            .values("status_funil")
            .annotate(count=Count("id"))
        )
        clientes_por_status = {
            item["status_funil"]: item["count"] for item in por_status_qs
        }

        resumo = {
            "total_clientes": total_clientes,
            "clientes_ativos": clientes_ativos,
            "novos_este_mes": novos_este_mes,
            "valor_total_gerado": agg["valor_total"] or 0,
            "ticket_medio_geral": ticket or 0,
            "followups_atrasados": followups_atrasados,
            "followups_hoje": followups_hoje,
            "clientes_por_status": clientes_por_status,
        }

        # Período informado → anexa KPIs do mês + comparativo com o anterior.
        if mes and ano:
            resumo.update(ClienteRepository.resumo_periodo(empresa_id, mes, ano))

        return resumo

    @staticmethod
    def listar_followups_proximos(empresa_id, dias: int = 3):
        """Retorna clientes com follow-up nos próximos X dias."""
        hoje = date.today()
        limite = hoje + timedelta(days=dias)
        return Cliente.objects.filter(
            empresa_id=empresa_id,
            ativo=True,
            proximo_followup__gte=hoje,
            proximo_followup__lte=limite,
        ).order_by("proximo_followup")

    @staticmethod
    @transaction.atomic
    def criar_interacao(cliente_id, empresa_id, dados: dict, usuario_id) -> InteracaoCliente:
        """Cria uma interação. O follow-up é puxado pelo signal; compra, não."""
        return InteracaoCliente.objects.create(
            cliente_id=cliente_id,
            empresa_id=empresa_id,
            criado_por_id=usuario_id,
            **dados,
        )

    @staticmethod
    def obter_interacao(interacao_id, empresa_id, cliente_id=None):
        """Retorna uma interação verificando multi-tenant (empresa e cliente)."""
        qs = InteracaoCliente.objects.filter(
            id=interacao_id, empresa_id=empresa_id
        )
        if cliente_id is not None:
            qs = qs.filter(cliente_id=cliente_id)
        return qs.select_related("criado_por").first()

    @staticmethod
    @transaction.atomic
    def atualizar_interacao(interacao: InteracaoCliente, dados: dict) -> InteracaoCliente:
        """Atualiza uma interação."""
        for field, value in dados.items():
            setattr(interacao, field, value)
        interacao.save()
        return interacao

    @staticmethod
    @transaction.atomic
    def deletar_interacao(interacao: InteracaoCliente) -> None:
        """Remove uma interação. Agregado de compra não depende mais daqui."""
        interacao.delete()

    @staticmethod
    def recalcular_agregados_cliente(cliente_id) -> None:
        """
        Refaz os agregados de compra do cliente a partir das VENDAS dele.

        FONTE ÚNICA: `Venda`. Antes esta função lia `InteracaoCliente` do tipo
        "venda", e era só por isso que uma venda de R$ 450 registrada no fluxo
        novo deixava o cliente marcando R$ 0,00 — o B10. `Venda` tem itens,
        estoque e financeiro; a interação de venda era o registro simples que
        ela substituiu, e agora não entra mais na conta por caminho nenhum: a
        tela de Clientes deixou de oferecer "Venda" como tipo de interação, e
        `manage.py migrar_vendas` converte as que já existiam.

        QUEM CHAMA, E POR QUE NÃO É UM SIGNAL. Um `post_save` preso a uma
        entidade foi exatamente o que criou o B10: ele ficou em
        `InteracaoCliente`, `Venda` nasceu noutro módulo e ninguém reparou que
        o gatilho não a alcançava. Aqui a chamada é explícita, do service de
        `Venda`, dentro da mesma transação da escrita — de modo que uma
        reversão leve junto o agregado, e que esquecer de chamar apareça no
        teste de quem mexeu, não seis meses depois numa auditoria.

        RECÁLCULO COMPLETO, não incremental: a função lê tudo de novo. É mais
        caro por chamada e é o que faz criar, editar, apagar, confirmar,
        vincular e desvincular caírem todos no mesmo caminho, sem nenhum deles
        precisar saber o que o anterior deixou escrito.

        O SPLIT recebido/a-receber usa o que a `Venda` sabe e a interação não
        sabia — recebimento PARCIAL:

        - venda `pago`      → o total entrou, mesmo que `valor_recebido` seja
                              zero (venda de balcão não "confirma" nada);
        - venda `pendente`  → entrou `valor_recebido`, falta o saldo;
        - venda `cancelado` → fora da conta inteira, como no fluxo antigo.

        Com isso `total = recebido + a_receber` continua valendo, que é a
        invariante que a tela do cliente mostra em três cartões lado a lado.

        Venda fiada CONTA em quantidade e em total: é compra, e o que ainda
        não entrou aparece em "a receber", não some.
        """
        from modules.vendas.models import Venda

        vendas = Venda.objects.filter(cliente_id=cliente_id).exclude(
            status_pagamento="cancelado"
        )

        # Os apelidos não repetem nome de campo de propósito: um alias
        # chamado `total` sombreia a coluna `total` e o Django recusa a
        # expressão com "'total' is an aggregate".
        agg = vendas.aggregate(
            soma=Sum("total"),
            qtd=Count("id"),
            ultima=Max("data_venda"),
            # `pago` entra inteiro; `pendente` entra pelo que já foi recebido.
            recebido=Sum(
                Case(
                    When(status_pagamento="pago", then=F("total")),
                    default=F("valor_recebido"),
                    output_field=DecimalField(max_digits=12, decimal_places=2),
                )
            ),
            a_receber=Sum(
                Case(
                    When(
                        status_pagamento="pendente",
                        then=F("total") - F("valor_recebido"),
                    ),
                    default=Value(Decimal("0")),
                    output_field=DecimalField(max_digits=12, decimal_places=2),
                )
            ),
        )

        Cliente.objects.filter(pk=cliente_id).update(
            valor_total_compras=agg["soma"] or 0,
            valor_recebido=agg["recebido"] or 0,
            valor_a_receber=agg["a_receber"] or 0,
            quantidade_compras=agg["qtd"] or 0,
            ultima_compra=agg["ultima"],
        )

    # Status de funil que uma venda paga faz avançar. Quem já está em
    # "fechado" não tem para onde ir; "perdido" entra porque voltar a comprar
    # é justamente o que desfaz um perdido.
    FUNIL_PROMOVIVEL = ("lead", "contato", "proposta", "negociacao", "perdido")

    @staticmethod
    def promover_por_venda_paga(cliente_id, venda) -> bool:
        """
        Cliente que pagou uma venda vai para "fechado". Devolve se mudou.

        FEATURE NOVA, não restauração. A promoção automática nunca existiu —
        nem no fluxo antigo de interação. `status_funil` tinha três
        escritores, todos manuais (o arrastar do Kanban, a ação em massa do
        admin e o default "lead"). O diagnóstico do B10 foi atrás disso
        esperando encontrar um gatilho perdido na refatoração, e não havia
        nenhum.

        SÓ PARA A FRENTE, E NUNCA DE VOLTA. Promover é uma inferência segura:
        quem pagou fechou. Rebaixar não é — apagar a venda não significa que
        o negócio se desfez, e o dono pode ter movido o cliente à mão depois,
        por um motivo que o sistema não conhece. Um rebaixamento automático
        desfaria essa decisão sem avisar. Por isso não existe o caminho de
        volta: apagar ou cancelar a venda não mexe no funil.

        POR EVENTO, NÃO POR ESTADO. A chamada vem do momento em que o
        pagamento é confirmado — não de um recálculo. Se dependesse do
        estado, um recálculo qualquer re-promoveria um cliente que o dono
        tivesse acabado de mover para trás de propósito, que é a mesma
        violação pela porta dos fundos.

        Venda sem cliente não promove ninguém.
        """
        # O `filter(pk=None)` abaixo já devolveria vazio — este `if` existe
        # para a venda de balcão ser uma decisão escrita e não um efeito de
        # como o ORM trata `None`.
        if not cliente_id:
            return False

        cliente = Cliente.objects.filter(pk=cliente_id).first()
        if cliente is None:
            return False
        if cliente.status_funil not in ClienteRepository.FUNIL_PROMOVIVEL:
            return False

        anterior = cliente.get_status_funil_display()
        cliente.status_funil = "fechado"
        cliente.save(update_fields=["status_funil", "atualizado_em"])

        # A linha na timeline existe para a mudança não ser silenciosa: quem
        # abrir o funil amanhã e vir o cartão noutra coluna precisa achar o
        # porquê sem adivinhar. Tipo "outro" de propósito — "venda" deixou de
        # ser um tipo de interação nesta mesma leva.
        InteracaoCliente.objects.create(
            cliente_id=cliente_id,
            empresa_id=cliente.empresa_id,
            tipo="outro",
            titulo="Movido para Fechado automaticamente",
            descricao=(
                f"O pagamento de uma venda de R$ {venda.total} foi confirmado, "
                f"e o cliente passou de {anterior} para Fechado. "
                f"Mover de volta, se for o caso, é pelo funil."
            ),
        )
        return True

    @staticmethod
    def listar_interacoes(cliente_id, empresa_id, filtros: dict):
        """
        Retorna histórico de interações de um cliente.

        A interação que virou Venda na migração fica de fora: ela continua no
        banco, intacta, mas quem representa aquela venda agora é a Venda — que
        tem itens e integrações. Mostrar as duas faria o cliente aparecer com a
        mesma compra duas vezes, uma delas congelada.
        """
        qs = InteracaoCliente.objects.filter(
            cliente_id=cliente_id,
            empresa_id=empresa_id,
            migrada_para_venda__isnull=True,
        ).select_related(
            "criado_por", "movimentacao_estoque__produto", "lancamento_financeiro"
        )

        tipo = filtros.get("tipo")
        if tipo:
            qs = qs.filter(tipo=tipo)

        data_inicio = filtros.get("data_inicio")
        if data_inicio:
            qs = qs.filter(data_interacao__date__gte=data_inicio)

        data_fim = filtros.get("data_fim")
        if data_fim:
            qs = qs.filter(data_interacao__date__lte=data_fim)

        # Filtro de período (mês/ano) pela data da interação.
        ano = _parse_int(filtros.get("ano"))
        mes = _parse_int(filtros.get("mes"))
        if ano:
            qs = qs.filter(data_interacao__year=ano)
        if mes:
            qs = qs.filter(data_interacao__month=mes)

        # Filtro de controle de estoque: só vendas descontadas / não descontadas.
        # "nao_descontados" = venda com valor mas sem movimentação vinculada.
        estoque = filtros.get("estoque")
        if estoque == "descontados":
            qs = qs.filter(movimentacao_estoque__isnull=False)
        elif estoque == "nao_descontados":
            qs = qs.filter(
                tipo="venda", movimentacao_estoque__isnull=True, valor__gt=0
            )

        return qs.order_by("-data_interacao")

    @staticmethod
    def listar_followups_hoje(empresa_id):
        """Retorna clientes com follow-up agendado para hoje."""
        return Cliente.objects.filter(
            empresa_id=empresa_id,
            ativo=True,
            proximo_followup=date.today(),
        ).select_related("criado_por")

    @staticmethod
    def listar_followups_atrasados(empresa_id):
        """Retorna clientes com follow-up atrasado."""
        return Cliente.objects.filter(
            empresa_id=empresa_id,
            ativo=True,
            proximo_followup__lt=date.today(),
        ).select_related("criado_por")
