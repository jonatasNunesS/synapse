"""
Synapse — Módulo Financeiro: Views
Todas as views herdam EmpresaQuerySetMixin (multi-tenant obrigatório).
"""
import logging
from datetime import date, timedelta

from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
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

from .serializers import (
    CategoriaSerializer,
    DRESerializer,
    FluxoCaixaDiaSerializer,
    LancamentoCreateSerializer,
    LancamentoSerializer,
    ResumoFinanceiroSerializer,
)
from .services import FinanceiroService

logger = logging.getLogger("synapse")


# ════════════════════════════════════════════════════════════
# CATEGORIAS
# ════════════════════════════════════════════════════════════

class CategoriaListCreateView(EmpresaQuerySetMixin, APIView):
    """GET /api/financeiro/categorias/ — POST /api/financeiro/categorias/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()
        categorias = FinanceiroService.listar_categorias(empresa_id)
        serializer = CategoriaSerializer(categorias, many=True)
        return success_response(
            data=serializer.data,
            message="Categorias listadas com sucesso.",
        )

    def post(self, request):
        empresa_id = self.get_empresa_id()
        serializer = CategoriaSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        try:
            categoria = FinanceiroService.criar_categoria(
                empresa_id, serializer.validated_data
            )
        except ValueError as e:
            return error_response("CATEGORIA_INVALIDA", str(e))
        return created_response(
            data=CategoriaSerializer(categoria).data,
            message="Categoria criada com sucesso.",
        )


class CategoriaDetailView(EmpresaQuerySetMixin, APIView):
    """GET/PUT/PATCH/DELETE /api/financeiro/categorias/{id}/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def _get_categoria(self, empresa_id, pk):
        from .repository import FinanceiroRepository
        cat = FinanceiroRepository.get_categoria(empresa_id, pk)
        if not cat:
            raise NotFound("Categoria não encontrada.")
        return cat

    def get(self, request, pk):
        empresa_id = self.get_empresa_id()
        categoria = self._get_categoria(empresa_id, pk)
        return success_response(data=CategoriaSerializer(categoria).data)

    def put(self, request, pk):
        return self._update(request, pk, partial=False)

    def patch(self, request, pk):
        return self._update(request, pk, partial=True)

    def _update(self, request, pk, partial: bool):
        empresa_id = self.get_empresa_id()
        categoria = self._get_categoria(empresa_id, pk)
        serializer = CategoriaSerializer(
            categoria,
            data=request.data,
            partial=partial,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        try:
            categoria = FinanceiroService.atualizar_categoria(
                empresa_id, pk, serializer.validated_data
            )
        except ValueError as e:
            return error_response("CATEGORIA_INVALIDA", str(e))
        return success_response(
            data=CategoriaSerializer(categoria).data,
            message="Categoria atualizada com sucesso.",
        )

    def delete(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            FinanceiroService.deletar_categoria(empresa_id, pk)
        except ValueError as e:
            return error_response("CATEGORIA_NAO_ENCONTRADA", str(e), status_code=404)
        return success_response(message="Categoria desativada com sucesso.")


# ════════════════════════════════════════════════════════════
# LANÇAMENTOS
# ════════════════════════════════════════════════════════════

class LancamentoListCreateView(EmpresaQuerySetMixin, APIView):
    """GET /api/financeiro/lancamentos/ — POST /api/financeiro/lancamentos/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()

        # Extrair filtros dos query params
        filtros = {}
        if request.query_params.get("tipo"):
            filtros["tipo"] = request.query_params["tipo"]
        if request.query_params.get("status"):
            filtros["status"] = request.query_params["status"]
        if request.query_params.get("categoria_id"):
            filtros["categoria_id"] = request.query_params["categoria_id"]
        if request.query_params.get("data_inicio"):
            filtros["data_inicio"] = request.query_params["data_inicio"]
        if request.query_params.get("data_fim"):
            filtros["data_fim"] = request.query_params["data_fim"]
        if request.query_params.get("busca"):
            filtros["busca"] = request.query_params["busca"]

        lancamentos = FinanceiroService.listar_lancamentos(empresa_id, filtros)

        # Paginação obrigatória
        paginator = StandardPagination()
        page = paginator.paginate_queryset(lancamentos, request)
        serializer = LancamentoSerializer(page, many=True)

        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        empresa_id = self.get_empresa_id()
        serializer = LancamentoCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        try:
            lancamento = FinanceiroService.criar_lancamento(
                empresa_id, request.user.id, serializer.validated_data
            )
        except ValueError as e:
            return error_response("LANCAMENTO_INVALIDO", str(e))
        return created_response(
            data=LancamentoSerializer(lancamento).data,
            message="Lançamento criado com sucesso.",
        )


class LancamentoDetailView(EmpresaQuerySetMixin, APIView):
    """GET/PUT/PATCH/DELETE /api/financeiro/lancamentos/{id}/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def _get_lancamento(self, empresa_id, pk):
        from .repository import FinanceiroRepository
        lancamento = FinanceiroRepository.get_lancamento(empresa_id, pk)
        if not lancamento:
            raise NotFound("Lançamento não encontrado.")
        return lancamento

    def get(self, request, pk):
        empresa_id = self.get_empresa_id()
        lancamento = self._get_lancamento(empresa_id, pk)
        return success_response(data=LancamentoSerializer(lancamento).data)

    def put(self, request, pk):
        return self._update(request, pk, partial=False)

    def patch(self, request, pk):
        return self._update(request, pk, partial=True)

    def _update(self, request, pk, partial: bool):
        empresa_id = self.get_empresa_id()
        lancamento = self._get_lancamento(empresa_id, pk)
        serializer = LancamentoCreateSerializer(
            lancamento,
            data=request.data,
            partial=partial,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        try:
            lancamento = FinanceiroService.atualizar_lancamento(
                empresa_id, pk, serializer.validated_data
            )
        except ValueError as e:
            return error_response("LANCAMENTO_INVALIDO", str(e))
        return success_response(
            data=LancamentoSerializer(lancamento).data,
            message="Lançamento atualizado com sucesso.",
        )

    def delete(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            FinanceiroService.deletar_lancamento(empresa_id, pk)
        except ValueError as e:
            return error_response("LANCAMENTO_NAO_ENCONTRADO", str(e), status_code=404)
        return no_content_response()


class LancamentoPagarView(EmpresaQuerySetMixin, APIView):
    """POST /api/financeiro/lancamentos/{id}/pagar/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request, pk):
        empresa_id = self.get_empresa_id()

        data_pagamento_str = request.data.get("data_pagamento")
        if not data_pagamento_str:
            return error_response(
                "DATA_PAGAMENTO_OBRIGATORIA",
                "O campo 'data_pagamento' é obrigatório.",
            )

        try:
            from datetime import date as date_type
            data_pagamento = date_type.fromisoformat(data_pagamento_str)
        except ValueError:
            return error_response(
                "DATA_INVALIDA",
                "Formato de data inválido. Use YYYY-MM-DD.",
            )

        try:
            lancamento = FinanceiroService.marcar_como_pago(
                empresa_id, pk, data_pagamento
            )
        except ValueError as e:
            return error_response("PAGAMENTO_INVALIDO", str(e))

        return success_response(
            data=LancamentoSerializer(lancamento).data,
            message="Lançamento marcado como pago.",
        )


# ════════════════════════════════════════════════════════════
# RELATÓRIOS
# ════════════════════════════════════════════════════════════

class ResumoFinanceiroView(EmpresaQuerySetMixin, APIView):
    """GET /api/financeiro/resumo/?mes=1&ano=2026"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()
        hoje = date.today()

        try:
            mes = int(request.query_params.get("mes", hoje.month))
            ano = int(request.query_params.get("ano", hoje.year))
        except (ValueError, TypeError):
            return error_response("PARAMETROS_INVALIDOS", "Mês e ano devem ser números inteiros.")

        if not (1 <= mes <= 12):
            return error_response("MES_INVALIDO", "O mês deve estar entre 1 e 12.")

        resumo = FinanceiroService.obter_resumo(empresa_id, mes, ano)
        serializer = ResumoFinanceiroSerializer(data=resumo)
        serializer.is_valid()
        return success_response(
            data=resumo,
            message=f"Resumo financeiro de {mes:02d}/{ano}.",
        )


class FluxoCaixaView(EmpresaQuerySetMixin, APIView):
    """GET /api/financeiro/fluxo-caixa/?data_inicio=&data_fim="""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()
        hoje = date.today()

        data_inicio_str = request.query_params.get(
            "data_inicio", str(hoje - timedelta(days=30))
        )
        data_fim_str = request.query_params.get("data_fim", str(hoje))

        try:
            data_inicio = date.fromisoformat(data_inicio_str)
            data_fim = date.fromisoformat(data_fim_str)
        except ValueError:
            return error_response("DATA_INVALIDA", "Use o formato YYYY-MM-DD.")

        fluxo = FinanceiroService.obter_fluxo_caixa(empresa_id, data_inicio, data_fim)
        return success_response(
            data=fluxo,
            message="Fluxo de caixa calculado com sucesso.",
        )


class DREView(EmpresaQuerySetMixin, APIView):
    """GET /api/financeiro/dre/?mes=&ano="""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()
        hoje = date.today()

        try:
            mes = int(request.query_params.get("mes", hoje.month))
            ano = int(request.query_params.get("ano", hoje.year))
        except (ValueError, TypeError):
            return error_response("PARAMETROS_INVALIDOS", "Mês e ano devem ser números inteiros.")

        dre = FinanceiroService.obter_dre(empresa_id, mes, ano)
        return success_response(
            data=dre,
            message=f"DRE de {mes:02d}/{ano} calculado com sucesso.",
        )


class VencimentosView(EmpresaQuerySetMixin, APIView):
    """GET /api/financeiro/vencimentos/?dias=7"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()

        try:
            dias = int(request.query_params.get("dias", 7))
        except (ValueError, TypeError):
            dias = 7

        vencimentos = FinanceiroService.obter_vencimentos_proximos(empresa_id, dias)
        serializer = LancamentoSerializer(vencimentos, many=True)
        return success_response(
            data=serializer.data,
            message=f"Próximos vencimentos ({dias} dias).",
        )
