from datetime import date, timedelta
from django.db import transaction
from django.db.models import Count, Sum, Avg, Max, Q
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
        """Receita gerada no mês = soma das vendas (não canceladas) do período."""
        return (
            InteracaoCliente.objects.filter(
                empresa_id=empresa_id,
                tipo="venda",
                data_interacao__year=ano,
                data_interacao__month=mes,
            )
            .exclude(status_pagamento="cancelado")
            .aggregate(s=Sum("valor"))["s"]
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
        hoje = date.today()
        inicio_mes = hoje.replace(day=1)

        base_qs = Cliente.objects.filter(empresa_id=empresa_id)

        total_clientes = base_qs.count()
        clientes_ativos = base_qs.filter(ativo=True).count()
        novos_este_mes = base_qs.filter(criado_em__date__gte=inicio_mes).count()

        agg = base_qs.filter(ativo=True).aggregate(
            valor_total=Sum("valor_total_compras"),
            ticket_medio=Avg("valor_total_compras"),
        )

        followups_atrasados = base_qs.filter(
            ativo=True,
            proximo_followup__lt=hoje,
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
            "ticket_medio_geral": agg["ticket_medio"] or 0,
            "followups_atrasados": followups_atrasados,
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
        """Cria uma interação — o signal cuida de atualizar o cliente."""
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
        """Atualiza uma interação e recalcula os agregados de venda do cliente."""
        for field, value in dados.items():
            setattr(interacao, field, value)
        interacao.save()
        ClienteRepository._recalcular_agregados_venda(interacao.cliente_id)
        return interacao

    @staticmethod
    @transaction.atomic
    def deletar_interacao(interacao: InteracaoCliente) -> None:
        """Remove uma interação e recalcula os agregados de venda do cliente."""
        cliente_id = interacao.cliente_id
        interacao.delete()
        ClienteRepository._recalcular_agregados_venda(cliente_id)

    @staticmethod
    def _recalcular_agregados_venda(cliente_id) -> None:
        """
        Recalcula os agregados de venda do cliente a partir das interações
        reais (fonte única da verdade), em qualquer operação (criar/editar/
        apagar). Mantém tudo consistente sem lógica incremental.

        - valor_total_compras = recebido + a_receber (canceladas NÃO contam).
        - valor_recebido      = vendas pagas + vendas à vista (nao_se_aplica).
        - valor_a_receber     = vendas pendentes (fiado em aberto).

        Venda "nao_se_aplica" é venda à vista (fluxo rápido, sem fiado): o
        dinheiro já entrou, então conta como RECEBIDO. Sem isso, uma venda à
        vista aparecia no Total mas com Recebido = R$ 0,00 (o bug do painel de
        receita) e o Total deixava de bater com Recebido + A receber.
        """
        vendas = InteracaoCliente.objects.filter(
            cliente_id=cliente_id, tipo="venda"
        ).exclude(status_pagamento="cancelado")

        agg = vendas.aggregate(
            total=Sum("valor"),
            qtd=Count("id"),
            ultima=Max("data_interacao"),
        )
        recebido = vendas.filter(
            status_pagamento__in=["pago", "nao_se_aplica"]
        ).aggregate(s=Sum("valor"))["s"] or 0
        a_receber = vendas.filter(status_pagamento="pendente").aggregate(
            s=Sum("valor")
        )["s"] or 0

        Cliente.objects.filter(pk=cliente_id).update(
            valor_total_compras=agg["total"] or 0,
            valor_recebido=recebido,
            valor_a_receber=a_receber,
            quantidade_compras=agg["qtd"] or 0,
            ultima_compra=agg["ultima"].date() if agg["ultima"] else None,
        )

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
