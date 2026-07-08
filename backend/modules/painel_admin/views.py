"""
Synapse — Painel Administrativo: Views (visão de plataforma).

Todas protegidas por IsStaffSynapse. NÃO usam EmpresaQuerySetMixin — é uma
visão cross-tenant consciente, restrita ao staff da plataforma.
"""
import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from shared.authentication import CookieJWTAuthentication
from shared.permissions import IsStaffSynapse
from shared.pagination import StandardPagination
from shared.responses import success_response, error_response
from shared.exceptions import ResourceNotFound

from .services import PainelAdminService
from .serializers import (
    EmpresaAdminListSerializer,
    EmpresaAdminDetailSerializer,
    LogAlteracaoPlanoSerializer,
    TrocarPlanoSerializer,
)

logger = logging.getLogger("synapse")


class EmpresasListView(APIView):
    """GET /api/painel-admin/empresas/ — lista paginada com contadores."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsStaffSynapse]

    def get(self, request):
        qs = PainelAdminService.listar_empresas()
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = EmpresaAdminListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class EmpresaDetailView(APIView):
    """GET /api/painel-admin/empresas/{id}/ — detalhe + usuários."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsStaffSynapse]

    def get(self, request, empresa_id):
        try:
            empresa = PainelAdminService.obter_empresa(empresa_id)
        except ResourceNotFound:
            return error_response(
                code="NOT_FOUND",
                message="Empresa não encontrada.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return success_response(data=EmpresaAdminDetailSerializer(empresa).data)


class TrocarPlanoView(APIView):
    """
    POST /api/painel-admin/empresas/{id}/trocar-plano/
    Body: {plano_novo, observacao?}. Rate limit: 10 trocas/min por staff.
    Toda troca gera LogAlteracaoPlano (sucesso ou erro).
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsStaffSynapse]
    throttle_scope = "painel_trocar_plano"

    def post(self, request, empresa_id):
        serializer = TrocarPlanoSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            empresa, log = PainelAdminService.trocar_plano(
                empresa_id=empresa_id,
                plano_novo=serializer.validated_data["plano_novo"],
                usuario=request.user,
                observacao=serializer.validated_data.get("observacao", ""),
            )
        except ResourceNotFound:
            return error_response(
                code="NOT_FOUND",
                message="Empresa não encontrada.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            # A tentativa já foi registrada (status=erro) pelo service.
            logger.error("Painel: erro ao trocar plano — %s", e, exc_info=True)
            return error_response(
                code="TROCA_PLANO_ERRO",
                message="Não foi possível trocar o plano. A tentativa foi registrada.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return success_response(
            data={
                "empresa": EmpresaAdminDetailSerializer(empresa).data,
                "log": LogAlteracaoPlanoSerializer(log).data,
            },
            message=f"Plano alterado para '{empresa.plano}'.",
        )


class HistoricoPlanoView(APIView):
    """GET /api/painel-admin/empresas/{id}/historico/ — ordem cronológica reversa."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsStaffSynapse]

    def get(self, request, empresa_id):
        try:
            qs = PainelAdminService.listar_historico(empresa_id)
        except ResourceNotFound:
            return error_response(
                code="NOT_FOUND",
                message="Empresa não encontrada.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = LogAlteracaoPlanoSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
