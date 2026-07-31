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
            # Período por data de cadastro (opcional; retrocompatível).
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
        def _int(v):
            try:
                return int(v)
            except (TypeError, ValueError):
                return None

        mes = _int(request.query_params.get("mes"))
        ano = _int(request.query_params.get("ano"))
        resumo = ClienteService.obter_resumo(self.get_empresa_id(), mes, ano)

        data = dict(ResumoClientesSerializer(resumo).data)
        # Campos do período (quando mes/ano informados) não estão no serializer
        # base — anexa direto do resumo para não quebrar a retrocompatibilidade.
        for chave in ("periodo", "novos_no_periodo", "valor_gerado_no_periodo", "comparativo"):
            if chave in resumo:
                data[chave] = resumo[chave]

        return success_response(
            data=data,
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
            "estoque": request.query_params.get("estoque"),
            "mes": request.query_params.get("mes"),
            "ano": request.query_params.get("ano"),
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


class InteracaoDetailView(EmpresaQuerySetMixin, APIView):
    """
    PATCH  /api/clientes/{pk}/interacoes/{interacao_id}/ — editar interação
    DELETE /api/clientes/{pk}/interacoes/{interacao_id}/ — excluir interação
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def patch(self, request, pk, interacao_id):
        empresa_id = self.get_empresa_id()
        try:
            interacao = ClienteService.obter_interacao(empresa_id, pk, interacao_id)
        except ResourceNotFound:
            return error_response(
                code="NOT_FOUND",
                message="Interação não encontrada.",
                status_code=404,
            )

        serializer = InteracaoClienteCreateSerializer(
            interacao, data=request.data, partial=True
        )
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
            )

        dados = dict(serializer.validated_data)
        interacao = ClienteService.atualizar_interacao(
            empresa_id=empresa_id,
            cliente_id=pk,
            interacao_id=interacao_id,
            dados=dados,
        )
        return success_response(
            data=InteracaoClienteSerializer(interacao).data,
            message="Interação atualizada com sucesso.",
        )

    def delete(self, request, pk, interacao_id):
        empresa_id = self.get_empresa_id()
        try:
            ClienteService.remover_interacao(empresa_id, pk, interacao_id)
        except ResourceNotFound:
            return error_response(
                code="NOT_FOUND",
                message="Interação não encontrada.",
                status_code=404,
            )
        return no_content_response()


class InteracaoBaixarEstoqueView(EmpresaQuerySetMixin, APIView):
    """
    POST /api/clientes/interacoes/{interacao_id}/baixar-estoque/
    Body: { produto_id: uuid, quantidade: Decimal }

    Cria uma saída de estoque a partir de uma interação de venda. Soft block:
    se o estoque for insuficiente, retorna 400 ESTOQUE_INSUFICIENTE com o
    saldo_atual nos details para o front oferecer baixar o que há.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request, interacao_id):
        from decimal import Decimal, InvalidOperation
        from shared.exceptions import BusinessRuleViolation
        from modules.estoque.serializers import MovimentacaoSerializer

        produto_id = request.data.get("produto_id")
        quantidade = request.data.get("quantidade")
        if not produto_id or quantidade in (None, ""):
            return error_response(
                code="VALIDATION_ERROR",
                message="produto_id e quantidade são obrigatórios.",
            )
        try:
            qtd = Decimal(str(quantidade))
        except (InvalidOperation, ValueError):
            return error_response(
                code="VALIDATION_ERROR", message="Quantidade inválida."
            )

        try:
            movimentacao = ClienteService.baixar_interacao_estoque(
                empresa_id=self.get_empresa_id(),
                usuario_id=request.user.id,
                interacao_id=interacao_id,
                produto_id=produto_id,
                quantidade=qtd,
            )
        except ResourceNotFound:
            return error_response(
                code="NOT_FOUND",
                message="Interação não encontrada.",
                status_code=404,
            )
        except BusinessRuleViolation as exc:
            return error_response(
                code=exc.code,
                message=exc.message,
                details=exc.details,
                status_code=400,
            )

        return created_response(
            data=MovimentacaoSerializer(movimentacao).data,
            message="Saída registrada no estoque.",
        )


class InteracaoConfirmarPagamentoView(EmpresaQuerySetMixin, APIView):
    """
    POST /api/clientes/interacoes/{interacao_id}/confirmar-pagamento/
    Body: { valor_confirmado?, criar_restante?, data_prevista_restante? }
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request, interacao_id):
        from decimal import Decimal, InvalidOperation
        from shared.exceptions import BusinessRuleViolation

        valor_raw = request.data.get("valor_confirmado")
        valor_confirmado = None
        if valor_raw not in (None, ""):
            try:
                valor_confirmado = Decimal(str(valor_raw))
            except (InvalidOperation, ValueError):
                return error_response("VALIDATION_ERROR", "Valor inválido.")
            if valor_confirmado < 0:
                return error_response("VALIDATION_ERROR", "Valor não pode ser negativo.")

        criar_restante = bool(request.data.get("criar_restante", False))
        data_prevista_restante = request.data.get("data_prevista_restante") or None

        try:
            interacao, nova = ClienteService.confirmar_pagamento(
                empresa_id=self.get_empresa_id(),
                interacao_id=interacao_id,
                valor_confirmado=valor_confirmado,
                criar_restante=criar_restante,
                data_prevista_restante=data_prevista_restante,
            )
        except ResourceNotFound:
            return error_response("NOT_FOUND", "Interação não encontrada.", status_code=404)
        except BusinessRuleViolation as exc:
            return error_response(exc.code, exc.message, details=exc.details, status_code=400)

        return success_response(
            data={
                "interacao": InteracaoClienteSerializer(interacao).data,
                "restante": InteracaoClienteSerializer(nova).data if nova else None,
            },
            message="Pagamento confirmado.",
        )


class InteracaoAdiarPagamentoView(EmpresaQuerySetMixin, APIView):
    """POST /api/clientes/interacoes/{interacao_id}/adiar-pagamento/ — Body: { dias }"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request, interacao_id):
        try:
            dias = int(request.data.get("dias", 3))
        except (ValueError, TypeError):
            return error_response("VALIDATION_ERROR", "Número de dias inválido.")
        if dias < 1:
            return error_response("VALIDATION_ERROR", "Informe ao menos 1 dia.")

        try:
            interacao = ClienteService.adiar_pagamento(
                empresa_id=self.get_empresa_id(),
                interacao_id=interacao_id,
                dias=dias,
            )
        except ResourceNotFound:
            return error_response("NOT_FOUND", "Interação não encontrada.", status_code=404)

        return success_response(
            data=InteracaoClienteSerializer(interacao).data,
            message=f"Pagamento adiado por {dias} dia(s).",
        )


class InteracaoCancelarPagamentoView(EmpresaQuerySetMixin, APIView):
    """POST /api/clientes/interacoes/{interacao_id}/cancelar-pagamento/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request, interacao_id):
        try:
            interacao = ClienteService.cancelar_pagamento(
                empresa_id=self.get_empresa_id(),
                interacao_id=interacao_id,
            )
        except ResourceNotFound:
            return error_response("NOT_FOUND", "Interação não encontrada.", status_code=404)

        return success_response(
            data=InteracaoClienteSerializer(interacao).data,
            message="Essa venda não será cobrada.",
        )


class InteracaoRegistrarFinanceiroView(EmpresaQuerySetMixin, APIView):
    """
    POST /api/clientes/interacoes/{interacao_id}/registrar-financeiro/
    Cria um lançamento de receita a partir de uma venda. Não duplica: interação
    já vinculada é recusada (VENDA_JA_COM_LANCAMENTO).
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request, interacao_id):
        from shared.exceptions import BusinessRuleViolation
        from modules.financeiro.serializers import LancamentoSerializer

        try:
            lancamento = ClienteService.registrar_interacao_no_financeiro(
                empresa_id=self.get_empresa_id(),
                usuario_id=request.user.id,
                interacao_id=interacao_id,
            )
        except ResourceNotFound:
            return error_response("NOT_FOUND", "Interação não encontrada.", status_code=404)
        except BusinessRuleViolation as exc:
            return error_response(exc.code, exc.message, details=exc.details, status_code=400)

        return created_response(
            data=LancamentoSerializer(lancamento).data,
            message="Receita registrada no financeiro.",
        )


class InteracaoApagarComAjustesView(EmpresaQuerySetMixin, APIView):
    """
    POST /api/clientes/interacoes/{interacao_id}/apagar-com-ajustes/
    Body: { estornar_estoque?: bool, apagar_financeiro?: bool }
    Estorna estoque e/ou ajusta o financeiro (na ordem), depois apaga a interação.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request, interacao_id):
        estornar_estoque = bool(request.data.get("estornar_estoque", False))
        apagar_financeiro = bool(request.data.get("apagar_financeiro", False))
        try:
            resumo = ClienteService.apagar_interacao_com_ajustes(
                empresa_id=self.get_empresa_id(),
                usuario_id=request.user.id,
                interacao_id=interacao_id,
                estornar_estoque=estornar_estoque,
                apagar_financeiro=apagar_financeiro,
            )
        except ResourceNotFound:
            return error_response("NOT_FOUND", "Interação não encontrada.", status_code=404)
        return success_response(data=resumo, message="Interação apagada.")


class ClienteCriarEventoFollowupView(EmpresaQuerySetMixin, APIView):
    """
    POST /api/clientes/{pk}/criar-evento-followup/
    Body: { atualizar?: bool }
    Cria (ou atualiza, se atualizar=True) um evento de Agenda a partir do
    proximo_followup do cliente. Não duplica sem intenção explícita.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request, pk):
        from shared.exceptions import BusinessRuleViolation
        from modules.agenda.serializers import EventoSerializer

        atualizar = bool(request.data.get("atualizar", False))
        try:
            evento, criado = ClienteService.criar_evento_followup(
                empresa_id=self.get_empresa_id(),
                usuario_id=request.user.id,
                cliente_id=pk,
                atualizar=atualizar,
            )
        except ResourceNotFound:
            return error_response("NOT_FOUND", "Cliente não encontrado.", status_code=404)
        except BusinessRuleViolation as exc:
            return error_response(exc.code, exc.message, details=exc.details, status_code=400)

        return success_response(
            data={"evento": EventoSerializer(evento).data, "criado": criado},
            message="Evento criado na Agenda." if criado else "Evento atualizado na Agenda.",
        )
