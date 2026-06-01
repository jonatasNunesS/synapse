"""
Synapse — M4: Views do CRM (Clientes)
Todas as views herdam EmpresaQuerySetMixin (multi-tenant obrigatório).
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from shared.authentication import CookieJWTAuthentication
from shared.permissions import IsEmpresaMember, EmpresaQuerySetMixin
from shared.pagination import StandardPagination
from shared.responses import success_response, created_response, no_content_response, error_response
from shared.exceptions import ResourceNotFound

from .services import ClienteService
from .serializers import (
    ClienteListSerializer,
    ClienteDetailSerializer,
    ClienteCreateUpdateSerializer,
    InteracaoClienteSerializer,
    InteracaoClienteCreateSerializer,
    FunilSerializer,
    ResumoClientesSerializer,
    MoverFunilSerializer,
)


class ClienteListCreateView(EmpresaQuerySetMixin, APIView):
    """GET /api/clientes/ — lista paginada | POST — cria cliente."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()
        filtros = {
            "status_funil": request.query_params.get("status_funil"),
            "origem": request.query_params.get("origem"),
            "ativo": request.query_params.get("ativo"),
            "busca": request.query_params.get("busca"),
            "tags": request.query_params.get("tags"),
            "tem_followup_atrasado": request.query_params.get("followup_atrasado"),
            "mes": request.query_params.get("mes"),
            "ano": request.query_params.get("ano"),
        }
        # Remove filtros nulos
        filtros = {k: v for k, v in filtros.items() if v is not None}

        qs, _ = ClienteService.listar_clientes(empresa_id, filtros)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = ClienteListSerializer(page, many=True)

        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        empresa_id = self.get_empresa_id()
        serializer = ClienteCreateUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
            )

        cliente = ClienteService.criar_cliente(
            empresa_id=empresa_id,
            usuario_id=request.user.id,
            dados=serializer.validated_data,
        )
        return created_response(
            data=ClienteDetailSerializer(cliente).data,
            message="Cliente criado com sucesso.",
        )


class ClienteDetailView(EmpresaQuerySetMixin, APIView):
    """GET/PATCH/PUT/DELETE /api/clientes/{id}/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            cliente = ClienteService.obter_cliente(empresa_id, pk)
        except ResourceNotFound:
            return error_response(
                code="NOT_FOUND",
                message="Cliente não encontrado.",
                status_code=404,
            )
        return success_response(
            data=ClienteDetailSerializer(cliente).data,
        )

    def patch(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            cliente = ClienteService.obter_cliente(empresa_id, pk)
        except ResourceNotFound:
            return error_response(
                code="NOT_FOUND",
                message="Cliente não encontrado.",
                status_code=404,
            )

        serializer = ClienteCreateUpdateSerializer(
            cliente, data=request.data, partial=True
        )
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
            )

        cliente = ClienteService.atualizar_cliente(
            empresa_id=empresa_id,
            cliente_id=pk,
            dados=serializer.validated_data,
        )
        return success_response(
            data=ClienteDetailSerializer(cliente).data,
            message="Cliente atualizado com sucesso.",
        )

    def put(self, request, pk):
        return self.patch(request, pk)

    def delete(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            ClienteService.deletar_cliente(empresa_id, pk)
        except ResourceNotFound:
            return error_response(
                code="NOT_FOUND",
                message="Cliente não encontrado.",
                status_code=404,
            )
        return no_content_response()


class ClienteMoverFunilView(EmpresaQuerySetMixin, APIView):
    """PATCH /api/clientes/{id}/mover-funil/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def patch(self, request, pk):
        serializer = MoverFunilSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Status do funil inválido.",
                details=serializer.errors,
            )

        try:
            cliente = ClienteService.mover_funil(
                empresa_id=self.get_empresa_id(),
                cliente_id=pk,
                novo_status=serializer.validated_data["status_funil"],
            )
        except ResourceNotFound:
            return error_response(
                code="NOT_FOUND",
                message="Cliente não encontrado.",
                status_code=404,
            )

        return success_response(
            data=ClienteDetailSerializer(cliente).data,
            message=f"Cliente movido para '{cliente.get_status_funil_display()}' com sucesso.",
        )


class ClienteFunilView(EmpresaQuerySetMixin, APIView):
    """GET /api/clientes/funil/ — dados do Kanban agrupados por status."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        funil = ClienteService.obter_funil(self.get_empresa_id())
        return success_response(
            data=funil,
            message="Funil carregado com sucesso.",
        )


class ClienteResumoView(EmpresaQuerySetMixin, APIView):
    """GET /api/clientes/resumo/ — KPIs do CRM."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        filtros = {
            "mes": request.query_params.get("mes"),
            "ano": request.query_params.get("ano"),
        }
        resumo = ClienteService.obter_resumo(self.get_empresa_id(), filtros)
        serializer = ResumoClientesSerializer(resumo)
        return success_response(
            data=serializer.data,
            message="Resumo carregado com sucesso.",
        )


class ClienteFollowupsView(EmpresaQuerySetMixin, APIView):
    """GET /api/clientes/followups/ — próximos follow-ups."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        try:
            dias = int(request.query_params.get("dias", 3))
        except (ValueError, TypeError):
            dias = 3

        qs = ClienteService.listar_followups(self.get_empresa_id(), dias)
        serializer = ClienteListSerializer(qs, many=True)
        return success_response(
            data=serializer.data,
            message=f"Follow-ups dos próximos {dias} dias.",
        )


class InteracaoListCreateView(EmpresaQuerySetMixin, APIView):
    """
    GET  /api/clientes/{id}/interacoes/ — histórico paginado
    POST /api/clientes/{id}/interacoes/ — registrar interação
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, pk):
        empresa_id = self.get_empresa_id()
        filtros = {
            "tipo": request.query_params.get("tipo"),
            "data_inicio": request.query_params.get("data_inicio"),
            "data_fim": request.query_params.get("data_fim"),
        }
        filtros = {k: v for k, v in filtros.items() if v is not None}

        try:
            qs = ClienteService.listar_interacoes(
                empresa_id=empresa_id,
                cliente_id=pk,
                filtros=filtros,
            )
        except ResourceNotFound:
            return error_response(
                code="NOT_FOUND",
                message="Cliente não encontrado.",
                status_code=404,
            )

        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = InteracaoClienteSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request, pk):
        empresa_id = self.get_empresa_id()
        serializer = InteracaoClienteCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
            )

        dados = serializer.validated_data
        dados.pop("cliente", None)  # cliente vem da URL

        try:
            interacao = ClienteService.registrar_interacao(
                empresa_id=empresa_id,
                usuario_id=request.user.id,
                cliente_id=pk,
                dados=dados,
            )
        except ResourceNotFound:
            return error_response(
                code="NOT_FOUND",
                message="Cliente não encontrado.",
                status_code=404,
            )

        return created_response(
            data=InteracaoClienteSerializer(interacao).data,
            message="Interação registrada com sucesso.",
        )
