"""
Synapse — Caixinhas: Views.
Todas herdam EmpresaQuerySetMixin (multi-tenant obrigatório).
"""
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from shared.authentication import CookieJWTAuthentication
from shared.pagination import StandardPagination
from shared.permissions import EmpresaQuerySetMixin, IsEmpresaMember
from shared.responses import (
    created_response,
    error_response,
    no_content_response,
    success_response,
)
from shared.exceptions import BusinessRuleViolation, ResourceNotFound

from .serializers import (
    CaixinhaCreateSerializer,
    CaixinhaSerializer,
    MovimentoCaixinhaSerializer,
    OperacaoCaixinhaSerializer,
)
from .services import CaixinhaService


class CaixinhaListCreateView(EmpresaQuerySetMixin, APIView):
    """GET /api/caixinhas/ — lista paginada | POST — cria caixinha."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()
        qs = CaixinhaService.listar(empresa_id)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = CaixinhaSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        empresa_id = self.get_empresa_id()
        serializer = CaixinhaCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
            )
        caixinha = CaixinhaService.criar(
            empresa_id=empresa_id,
            usuario_id=request.user.id,
            dados=serializer.validated_data,
        )
        return created_response(
            data=CaixinhaSerializer(caixinha).data,
            message="Caixinha criada com sucesso.",
        )


class CaixinhaDetailView(EmpresaQuerySetMixin, APIView):
    """GET/PATCH/DELETE /api/caixinhas/{id}/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            caixinha = CaixinhaService.obter(empresa_id, pk)
        except ResourceNotFound:
            return error_response(
                code="NOT_FOUND", message="Caixinha não encontrada.", status_code=404
            )
        return success_response(data=CaixinhaSerializer(caixinha).data)

    def patch(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            caixinha = CaixinhaService.obter(empresa_id, pk)
        except ResourceNotFound:
            return error_response(
                code="NOT_FOUND", message="Caixinha não encontrada.", status_code=404
            )
        serializer = CaixinhaCreateSerializer(
            caixinha, data=request.data, partial=True
        )
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
            )
        caixinha = CaixinhaService.atualizar(
            empresa_id, pk, dict(serializer.validated_data)
        )
        return success_response(
            data=CaixinhaSerializer(caixinha).data,
            message="Caixinha atualizada com sucesso.",
        )

    def delete(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            CaixinhaService.deletar(empresa_id, pk)
        except ResourceNotFound:
            return error_response(
                code="NOT_FOUND", message="Caixinha não encontrada.", status_code=404
            )
        except BusinessRuleViolation as e:
            return error_response(
                code=e.code, message=e.message, details=e.details
            )
        return no_content_response()


class _OperacaoBaseView(EmpresaQuerySetMixin, APIView):
    """Base de depósito/retirada: valida {valor, descricao?} e delega ao service."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]
    operacao = None  # "depositar" | "retirar"

    def post(self, request, pk):
        empresa_id = self.get_empresa_id()
        serializer = OperacaoCaixinhaSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
            )
        dados = serializer.validated_data
        try:
            metodo = getattr(CaixinhaService, self.operacao)
            movimento = metodo(
                empresa_id=empresa_id,
                caixinha_id=pk,
                valor=dados["valor"],
                descricao=dados.get("descricao", ""),
                usuario_id=request.user.id,
            )
        except BusinessRuleViolation as e:
            status_code = 404 if e.code == "NOT_FOUND" else 400
            return error_response(
                code=e.code, message=e.message, details=e.details,
                status_code=status_code,
            )
        caixinha = CaixinhaService.obter(empresa_id, pk)
        return created_response(
            data={
                "movimento": MovimentoCaixinhaSerializer(movimento).data,
                "caixinha": CaixinhaSerializer(caixinha).data,
            },
            message=(
                "Depósito realizado." if self.operacao == "depositar"
                else "Retirada realizada."
            ),
        )


class CaixinhaDepositarView(_OperacaoBaseView):
    """POST /api/caixinhas/{id}/depositar/ — body: {valor, descricao?}"""

    operacao = "depositar"


class CaixinhaRetirarView(_OperacaoBaseView):
    """POST /api/caixinhas/{id}/retirar/ — body: {valor, descricao?}"""

    operacao = "retirar"


class CaixinhaMovimentosView(EmpresaQuerySetMixin, APIView):
    """GET /api/caixinhas/{id}/movimentos/ — histórico paginado."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            qs = CaixinhaService.listar_movimentos(empresa_id, pk)
        except ResourceNotFound:
            return error_response(
                code="NOT_FOUND", message="Caixinha não encontrada.", status_code=404
            )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = MovimentoCaixinhaSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class CaixinhaResumoView(EmpresaQuerySetMixin, APIView):
    """GET /api/caixinhas/resumo/ — total em caixinhas da empresa."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()
        return success_response(data=CaixinhaService.obter_resumo(empresa_id))
