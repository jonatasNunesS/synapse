from datetime import date, timedelta
from django.db import transaction
from django.db.models import Count, Sum, Avg, Max, Q
from django.utils import timezone

from .models import Cliente, InteracaoCliente
from .serializers import ClienteFunilCardSerializer


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
    def calcular_resumo(empresa_id) -> dict:
        """Calcula KPIs do CRM para a empresa."""
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

        return {
            "total_clientes": total_clientes,
            "clientes_ativos": clientes_ativos,
            "novos_este_mes": novos_este_mes,
            "valor_total_gerado": agg["valor_total"] or 0,
            "ticket_medio_geral": agg["ticket_medio"] or 0,
            "followups_atrasados": followups_atrasados,
            "clientes_por_status": clientes_por_status,
        }

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
        Recalcula valor_total_compras, quantidade_compras e ultima_compra do
        cliente a partir das interações do tipo 'venda' existentes.

        O signal post_save atualiza esses campos de forma incremental na criação;
        em edição/exclusão recalculamos a partir da verdade (as interações reais)
        para manter a consistência (ex.: apagar uma venda reduz o total).
        """
        agg = InteracaoCliente.objects.filter(
            cliente_id=cliente_id, tipo="venda"
        ).aggregate(
            total=Sum("valor"),
            qtd=Count("id"),
            ultima=Max("data_interacao"),
        )
        Cliente.objects.filter(pk=cliente_id).update(
            valor_total_compras=agg["total"] or 0,
            quantidade_compras=agg["qtd"] or 0,
            ultima_compra=agg["ultima"].date() if agg["ultima"] else None,
        )

    @staticmethod
    def listar_interacoes(cliente_id, empresa_id, filtros: dict):
        """Retorna histórico de interações de um cliente."""
        qs = InteracaoCliente.objects.filter(
            cliente_id=cliente_id,
            empresa_id=empresa_id,
        ).select_related("criado_por")

        tipo = filtros.get("tipo")
        if tipo:
            qs = qs.filter(tipo=tipo)

        data_inicio = filtros.get("data_inicio")
        if data_inicio:
            qs = qs.filter(data_interacao__date__gte=data_inicio)

        data_fim = filtros.get("data_fim")
        if data_fim:
            qs = qs.filter(data_interacao__date__lte=data_fim)

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
