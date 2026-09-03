"""
Synapse — Vendas: Views.
Todas herdam EmpresaQuerySetMixin (multi-tenant obrigatório).
"""
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from shared.authentication import CookieJWTAuthentication
from shared.exceptions import BusinessRuleViolation, ResourceNotFound
from shared.pagination import StandardPagination
from shared.permissions import EmpresaQuerySetMixin, IsEmpresaMember
from shared.responses import (
    created_response,
    error_response,
    no_content_response,
    success_response,
)

from .serializers import VendaCreateSerializer, VendaSerializer
from .services import VendaService


class VendaListCreateView(EmpresaQuerySetMixin, APIView):
    """GET /api/vendas/ — lista paginada | POST — cria venda com itens."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()
        filtros = {
            "status_pagamento": request.query_params.get("status_pagamento"),
            "cliente_id": request.query_params.get("cliente_id"),
            "data_inicio": request.query_params.get("data_inicio"),
            "data_fim": request.query_params.get("data_fim"),
        }
        qs = VendaService.listar(empresa_id, filtros)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(VendaSerializer(page, many=True).data)

    def post(self, request):
        empresa_id = self.get_empresa_id()
        serializer = VendaCreateSerializer(data=request.data, empresa_id=empresa_id)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
            )
        venda = VendaService.criar(
            empresa_id=empresa_id,
            usuario_id=request.user.id,
            dados=dict(serializer.validated_data),
        )
        return created_response(
            data=VendaSerializer(venda).data,
            message="Venda registrada com sucesso.",
        )


class VendaDetailView(EmpresaQuerySetMixin, APIView):
    """GET/PATCH/DELETE /api/vendas/{id}/."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            venda = VendaService.obter(empresa_id, pk)
        except ResourceNotFound:
            return error_response("VENDA_NAO_ENCONTRADA", "Venda não encontrada.", status_code=404)
        return success_response(data=VendaSerializer(venda).data)

    def patch(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            venda = VendaService.obter(empresa_id, pk)
        except ResourceNotFound:
            return error_response("VENDA_NAO_ENCONTRADA", "Venda não encontrada.", status_code=404)

        serializer = VendaCreateSerializer(
            instance=venda, data=request.data, empresa_id=empresa_id, parcial=True
        )
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
            )
        venda = VendaService.atualizar(
            empresa_id, pk, dict(serializer.validated_data)
        )
        return success_response(
            data=VendaSerializer(venda).data,
            message="Venda atualizada com sucesso.",
        )

    def delete(self, request, pk):
        empresa_id = self.get_empresa_id()
        # Query params porque DELETE não carrega corpo de forma confiável. Sem
        # nada marcado, apaga só a venda — estornar estoque e mexer no
        # financeiro é decisão explícita de quem apaga.
        estornar = request.query_params.get("estornar_estoque") == "true"
        apagar_fin = request.query_params.get("apagar_financeiro") == "true"
        try:
            if estornar or apagar_fin:
                VendaService.apagar_com_ajustes(
                    empresa_id, request.user.id, pk,
                    estornar_estoque=estornar, apagar_financeiro=apagar_fin,
                )
            else:
                VendaService.deletar(empresa_id, pk)
        except ResourceNotFound:
            return error_response("VENDA_NAO_ENCONTRADA", "Venda não encontrada.", status_code=404)
        return no_content_response()


class VendaEstoqueView(EmpresaQuerySetMixin, APIView):
    """
    GET  /api/vendas/{id}/estoque/ — prévia: o que a baixa faria.
    POST /api/vendas/{id}/estoque/ — executa a baixa.

    A prévia existe para a pessoa ver o saldo antes e depois de cada produto
    antes de confirmar. Nada acontece sem o POST.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            previa = VendaService.previa_estoque(empresa_id, pk)
        except ResourceNotFound:
            return error_response("VENDA_NAO_ENCONTRADA", "Venda não encontrada.", status_code=404)
        return success_response(data=previa)

    def post(self, request, pk):
        empresa_id = self.get_empresa_id()
        # parcial=true é a resposta ao aviso de estoque insuficiente: baixa o
        # que há em vez de recusar tudo (mesma saída do fluxo antigo).
        parcial = request.data.get("parcial") is True
        try:
            movimentacoes = VendaService.baixar_estoque(
                empresa_id, request.user.id, pk, parcial=parcial
            )
        except ResourceNotFound:
            return error_response("VENDA_NAO_ENCONTRADA", "Venda não encontrada.", status_code=404)
        except BusinessRuleViolation as erro:
            return error_response(erro.code, erro.message, details=erro.details, status_code=400)

        venda = VendaService.obter(empresa_id, pk)
        return success_response(
            data=VendaSerializer(venda).data,
            message=f"{len(movimentacoes)} item(ns) baixado(s) do estoque.",
        )


class VendaConfirmarPagamentoView(EmpresaQuerySetMixin, APIView):
    """
    POST /api/vendas/{id}/confirmar-pagamento/ — recebeu (tudo ou parte).

    Body: { valor_recebido?, data_prevista_saldo? }. Sem valor_recebido,
    confirma o saldo inteiro. Com um valor menor, a venda segue pendente pelo
    resto, e `data_prevista_saldo` diz quando cobrar de novo.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request, pk):
        from decimal import Decimal, InvalidOperation

        empresa_id = self.get_empresa_id()

        valor_raw = request.data.get("valor_recebido")
        valor_recebido = None
        if valor_raw not in (None, ""):
            try:
                valor_recebido = Decimal(str(valor_raw))
            except (InvalidOperation, ValueError):
                return error_response("VALIDATION_ERROR", "Valor recebido inválido.")

        data_saldo = request.data.get("data_prevista_saldo") or None
        if isinstance(data_saldo, str):
            from django.utils.dateparse import parse_date

            data_saldo = parse_date(data_saldo)
            if data_saldo is None:
                return error_response("VALIDATION_ERROR", "Data do saldo inválida.")

        try:
            resultado = VendaService.confirmar_pagamento(
                empresa_id, request.user.id, pk,
                valor_recebido=valor_recebido,
                data_prevista_saldo=data_saldo,
            )
        except ResourceNotFound:
            return error_response("VENDA_NAO_ENCONTRADA", "Venda não encontrada.", status_code=404)
        except BusinessRuleViolation as erro:
            return error_response(erro.code, erro.message, details=erro.details, status_code=400)

        venda = VendaService.obter(empresa_id, pk)
        return success_response(
            data={
                "venda": VendaSerializer(venda).data,
                "recebido": str(resultado["recebido"]),
                "saldo_devedor": str(resultado["saldo_devedor"]),
                "quitou": resultado["quitou"],
            },
            message=(
                "Pagamento confirmado."
                if resultado["quitou"]
                else f"Recebimento registrado. Falta R$ {resultado['saldo_devedor']}."
            ),
        )


class VendaAdiarPagamentoView(EmpresaQuerySetMixin, APIView):
    """POST /api/vendas/{id}/adiar-pagamento/ — Body: { dias }."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request, pk):
        try:
            dias = int(request.data.get("dias", 3))
        except (ValueError, TypeError):
            return error_response("VALIDATION_ERROR", "Número de dias inválido.")
        if dias < 1:
            return error_response("VALIDATION_ERROR", "Informe ao menos 1 dia.")

        try:
            venda = VendaService.adiar_pagamento(self.get_empresa_id(), pk, dias)
        except ResourceNotFound:
            return error_response("VENDA_NAO_ENCONTRADA", "Venda não encontrada.", status_code=404)
        except BusinessRuleViolation as erro:
            return error_response(erro.code, erro.message, details=erro.details, status_code=400)

        return success_response(
            data=VendaSerializer(venda).data,
            message=f"Cobrança adiada por {dias} dia(s).",
        )


class VendaCancelarPagamentoView(EmpresaQuerySetMixin, APIView):
    """POST /api/vendas/{id}/cancelar-pagamento/ — não cobra mais."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request, pk):
        try:
            venda = VendaService.cancelar_pagamento(self.get_empresa_id(), pk)
        except ResourceNotFound:
            return error_response("VENDA_NAO_ENCONTRADA", "Venda não encontrada.", status_code=404)
        except BusinessRuleViolation as erro:
            return error_response(erro.code, erro.message, details=erro.details, status_code=400)

        return success_response(
            data=VendaSerializer(venda).data,
            message="Essa venda não será cobrada.",
        )


class VendaFinanceiroView(EmpresaQuerySetMixin, APIView):
    """POST /api/vendas/{id}/financeiro/ — lança a receita da venda."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            VendaService.lancar_financeiro(empresa_id, request.user.id, pk)
        except ResourceNotFound:
            return error_response("VENDA_NAO_ENCONTRADA", "Venda não encontrada.", status_code=404)
        except BusinessRuleViolation as erro:
            return error_response(erro.code, erro.message, details=erro.details, status_code=400)

        venda = VendaService.obter(empresa_id, pk)
        return success_response(
            data=VendaSerializer(venda).data,
            message="Lançamento financeiro criado.",
        )
