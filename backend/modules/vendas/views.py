"""
Synapse — Vendas: Views.
Todas herdam EmpresaQuerySetMixin (multi-tenant obrigatório).
"""
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from shared.authentication import CookieJWTAuthentication
from shared.exceptions import ResourceNotFound
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
        try:
            VendaService.deletar(empresa_id, pk)
        except ResourceNotFound:
            return error_response("VENDA_NAO_ENCONTRADA", "Venda não encontrada.", status_code=404)
        return no_content_response()
