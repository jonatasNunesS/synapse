"""
Synapse — Painel Administrativo: Views (visão de plataforma).

Protegidas por IsStaffSynapse (exceção: PlanosPublicosView, que a landing
consome sem login). NÃO usam EmpresaQuerySetMixin — é uma visão cross-tenant
consciente, restrita ao staff da plataforma.
"""
import logging

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from shared.authentication import CookieJWTAuthentication
from shared.permissions import IsStaffSynapse
from shared.pagination import StandardPagination
from shared.responses import (
    created_response,
    error_response,
    success_response,
)
from shared.exceptions import BusinessRuleViolation, ResourceNotFound

from .services import ConfiguracaoPlanoService, PainelAdminService
from .serializers import (
    ConfiguracaoPlanoSerializer,
    CriarEmpresaSerializer,
    EditarConfiguracaoPlanoSerializer,
    EditarEmpresaSerializer,
    EditarUsuarioSerializer,
    EmpresaAdminDetailSerializer,
    EmpresaAdminListSerializer,
    LogAlteracaoPlanoSerializer,
    ReativarSerializer,
    SuspenderSerializer,
    TrocarPlanoSerializer,
    UsuarioAdminSerializer,
)

logger = logging.getLogger("synapse")


def _404(msg="Empresa não encontrada."):
    return error_response(code="NOT_FOUND", message=msg, status_code=status.HTTP_404_NOT_FOUND)


def _404_usuario_ou_empresa(exc):
    """404 com a mensagem certa conforme o recurso não encontrado."""
    resource = exc.details.get("resource") if exc.details else None
    if resource == "Usuário":
        return _404("Usuário não encontrado.")
    return _404("Empresa não encontrada.")


class EmpresasListView(APIView):
    """
    GET  /api/painel-admin/empresas/ — lista paginada, com busca/filtros/ordem.
    POST /api/painel-admin/empresas/ — cria empresa + admin.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsStaffSynapse]

    def get(self, request):
        filtros = {
            "busca": request.query_params.get("busca"),
            "plano": request.query_params.get("plano"),
            "status": request.query_params.get("status"),
            "ordenar": request.query_params.get("ordenar"),
        }
        qs = PainelAdminService.listar_empresas(filtros)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = EmpresaAdminListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        serializer = CriarEmpresaSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        empresa, admin = PainelAdminService.criar_empresa(
            dados=serializer.validated_data, usuario=request.user
        )
        return created_response(
            data={
                "empresa": EmpresaAdminDetailSerializer(empresa).data,
                "usuario": UsuarioAdminSerializer(admin).data,
            },
            message=f"Empresa {empresa.nome} criada com sucesso.",
        )


class EmpresaDetailView(APIView):
    """
    GET    /api/painel-admin/empresas/{id}/ — detalhe + usuários.
    PATCH  /api/painel-admin/empresas/{id}/ — edita nome/segmento.
    DELETE /api/painel-admin/empresas/{id}/ — hard delete (trava de 30 dias).
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsStaffSynapse]

    def get(self, request, empresa_id):
        try:
            empresa = PainelAdminService.obter_empresa(empresa_id)
        except ResourceNotFound:
            return _404()
        return success_response(data=EmpresaAdminDetailSerializer(empresa).data)

    def patch(self, request, empresa_id):
        serializer = EditarEmpresaSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            empresa = PainelAdminService.editar_empresa(
                empresa_id, serializer.validated_data
            )
        except ResourceNotFound:
            return _404()
        return success_response(
            data=EmpresaAdminDetailSerializer(empresa).data,
            message="Empresa atualizada com sucesso.",
        )

    def delete(self, request, empresa_id):
        try:
            nome = PainelAdminService.excluir_empresa(empresa_id, request.user)
        except ResourceNotFound:
            return _404()
        except BusinessRuleViolation as exc:
            return error_response(
                code=exc.code, message=exc.message, details=exc.details,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        return success_response(message=f"Empresa {nome} excluída definitivamente.")


class SuspenderEmpresaView(APIView):
    """POST /api/painel-admin/empresas/{id}/suspender/ — Body: {motivo}."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsStaffSynapse]

    def post(self, request, empresa_id):
        serializer = SuspenderSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Informe um motivo com pelo menos 10 caracteres.",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            empresa = PainelAdminService.suspender(
                empresa_id, serializer.validated_data["motivo"], request.user
            )
        except ResourceNotFound:
            return _404()
        return success_response(
            data=EmpresaAdminDetailSerializer(empresa).data,
            message="Empresa suspensa.",
        )


class ReativarEmpresaView(APIView):
    """POST /api/painel-admin/empresas/{id}/reativar/ — Body: {motivo?}."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsStaffSynapse]

    def post(self, request, empresa_id):
        serializer = ReativarSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            empresa = PainelAdminService.reativar(
                empresa_id, request.user, serializer.validated_data.get("motivo", "")
            )
        except ResourceNotFound:
            return _404()
        return success_response(
            data=EmpresaAdminDetailSerializer(empresa).data,
            message="Empresa reativada.",
        )


class UsuariosEmpresaView(APIView):
    """GET /api/painel-admin/empresas/{id}/usuarios/ — usuários da empresa."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsStaffSynapse]

    def get(self, request, empresa_id):
        try:
            PainelAdminService.obter_empresa(empresa_id)
        except ResourceNotFound:
            return _404()
        qs = PainelAdminService.usuarios_da_empresa(empresa_id)
        return success_response(data=UsuarioAdminSerializer(qs, many=True).data)


class UsuarioEmpresaDetailView(APIView):
    """PATCH /api/painel-admin/empresas/{id}/usuarios/{uid}/ — perfil/is_active."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsStaffSynapse]

    def patch(self, request, empresa_id, usuario_id):
        serializer = EditarUsuarioSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            u = PainelAdminService.editar_usuario(
                empresa_id, usuario_id, serializer.validated_data
            )
        except ResourceNotFound as exc:
            return _404_usuario_ou_empresa(exc)
        except BusinessRuleViolation as exc:
            return error_response(
                code=exc.code, message=exc.message, details=exc.details,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        return success_response(
            data=UsuarioAdminSerializer(u).data,
            message="Usuário atualizado.",
        )


class RedefinirSenhaUsuarioView(APIView):
    """
    POST /api/painel-admin/empresas/{id}/usuarios/{uid}/redefinir-senha/
    Gera e retorna uma senha temporária (exibida uma única vez).
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsStaffSynapse]

    def post(self, request, empresa_id, usuario_id):
        try:
            u, nova_senha = PainelAdminService.redefinir_senha_usuario(
                empresa_id, usuario_id
            )
        except ResourceNotFound as exc:
            return _404_usuario_ou_empresa(exc)
        except BusinessRuleViolation as exc:
            return error_response(
                code=exc.code, message=exc.message, details=exc.details,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        return success_response(
            data={"usuario": UsuarioAdminSerializer(u).data, "senha_temporaria": nova_senha},
            message="Senha redefinida. Copie a senha temporária agora.",
        )


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
            return _404()
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
            return _404()
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = LogAlteracaoPlanoSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


# ════════════════════════════════════════════════════════════════════════════
# PLANOS — leitura pública (landing) + edição pelo staff
# ════════════════════════════════════════════════════════════════════════════


class PlanosPublicosView(APIView):
    """
    GET /api/planos/ — preços e limites dos 3 planos. SEM autenticação:
    é o que a landing pública consome. Campos ainda não definidos vêm null.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        planos = ConfiguracaoPlanoService.listar()
        return success_response(data=ConfiguracaoPlanoSerializer(planos, many=True).data)


class ConfiguracaoPlanoDetailView(APIView):
    """
    PATCH /api/painel-admin/planos/{plano}/ — edita preço, limites e suporte.
    Restrito ao staff da plataforma.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsStaffSynapse]

    def get(self, request, plano):
        try:
            config = ConfiguracaoPlanoService.obter(plano)
        except ResourceNotFound:
            return _404("Plano não encontrado.")
        return success_response(data=ConfiguracaoPlanoSerializer(config).data)

    def patch(self, request, plano):
        serializer = EditarConfiguracaoPlanoSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            config = ConfiguracaoPlanoService.atualizar(plano, serializer.validated_data)
        except ResourceNotFound:
            return _404("Plano não encontrado.")
        return success_response(
            data=ConfiguracaoPlanoSerializer(config).data,
            message="Plano atualizado com sucesso.",
        )
