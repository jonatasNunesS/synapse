"""
Synapse — M8 Dashboard: Views
Endpoints consolidados do Dashboard Executivo.

Rotas:
  GET /api/dashboard/resumo/           → KPIs de todos os módulos
  GET /api/dashboard/fluxo-caixa/      → Fluxo de caixa (últimos N dias)
  GET /api/dashboard/funil-vendas/     → Funil de vendas CRM
  GET /api/dashboard/vencimentos/      → Lançamentos com vencimento próximo
  GET /api/dashboard/followups/        → Clientes com follow-up próximo
  GET /api/dashboard/minhas-tarefas/   → Tarefas pendentes do usuário
  GET /api/dashboard/alertas-estoque/  → Produtos com estoque crítico
  GET /api/dashboard/projetos/         → Projetos em andamento
  GET /api/dashboard/atividade/        → Feed de atividade recente
"""
import logging

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from shared.authentication import CookieJWTAuthentication
from shared.permissions import EmpresaQuerySetMixin, IsEmpresaMember
from shared.responses import error_response, success_response

from .serializers import (
    AtividadeQuerySerializer,
    FluxoCaixaQuerySerializer,
    FollowUpsQuerySerializer,
    VencimentosQuerySerializer,
)
from .services import DashboardService

logger = logging.getLogger("synapse")


class DashboardResumoView(EmpresaQuerySetMixin, APIView):
    """GET /api/dashboard/resumo/ — KPIs consolidados de todos os módulos."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()
        usuario_id = request.user.id

        try:
            resumo = DashboardService.obter_resumo_principal(empresa_id, usuario_id)
            return success_response(
                data=resumo,
                message="Resumo do dashboard obtido com sucesso.",
            )
        except Exception as e:
            logger.error(f"Dashboard resumo error: {e}", exc_info=True)
            return error_response(
                code="DASHBOARD_ERROR",
                message="Erro ao carregar o dashboard.",
                details={"error": str(e)},
                status_code=500,
            )


class DashboardFluxoCaixaView(EmpresaQuerySetMixin, APIView):
    """GET /api/dashboard/fluxo-caixa/?dias=30 — Fluxo de caixa para gráfico."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()

        serializer = FluxoCaixaQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Parâmetros inválidos.",
                details=serializer.errors,
            )

        dias = serializer.validated_data.get("dias", 30)

        try:
            fluxo = DashboardService.obter_fluxo_caixa(empresa_id, dias)
            return success_response(
                data={"fluxo": fluxo, "dias": dias},
                message="Fluxo de caixa obtido com sucesso.",
            )
        except Exception as e:
            logger.error(f"Dashboard fluxo-caixa error: {e}", exc_info=True)
            return error_response(
                code="DASHBOARD_ERROR",
                message="Erro ao carregar fluxo de caixa.",
                details={"error": str(e)},
                status_code=500,
            )


class DashboardFunilVendasView(EmpresaQuerySetMixin, APIView):
    """GET /api/dashboard/funil-vendas/ — Funil de vendas CRM."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()

        try:
            funil = DashboardService.obter_funil_vendas(empresa_id)
            return success_response(
                data=funil,
                message="Funil de vendas obtido com sucesso.",
            )
        except Exception as e:
            logger.error(f"Dashboard funil-vendas error: {e}", exc_info=True)
            return error_response(
                code="DASHBOARD_ERROR",
                message="Erro ao carregar funil de vendas.",
                details={"error": str(e)},
                status_code=500,
            )


class DashboardVencimentosView(EmpresaQuerySetMixin, APIView):
    """GET /api/dashboard/vencimentos/?dias=7 — Lançamentos com vencimento próximo."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()

        serializer = VencimentosQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Parâmetros inválidos.",
                details=serializer.errors,
            )

        dias = serializer.validated_data.get("dias", 7)

        try:
            vencimentos = DashboardService.obter_vencimentos_proximos(empresa_id, dias)
            return success_response(
                data={"vencimentos": vencimentos, "dias": dias},
                message="Vencimentos próximos obtidos com sucesso.",
            )
        except Exception as e:
            logger.error(f"Dashboard vencimentos error: {e}", exc_info=True)
            return error_response(
                code="DASHBOARD_ERROR",
                message="Erro ao carregar vencimentos.",
                details={"error": str(e)},
                status_code=500,
            )


class DashboardFollowUpsView(EmpresaQuerySetMixin, APIView):
    """GET /api/dashboard/followups/?dias=3 — Clientes com follow-up próximo."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()

        serializer = FollowUpsQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Parâmetros inválidos.",
                details=serializer.errors,
            )

        dias = serializer.validated_data.get("dias", 3)

        try:
            followups = DashboardService.obter_followups_proximos(empresa_id, dias)
            return success_response(
                data={"followups": followups, "dias": dias},
                message="Follow-ups próximos obtidos com sucesso.",
            )
        except Exception as e:
            logger.error(f"Dashboard followups error: {e}", exc_info=True)
            return error_response(
                code="DASHBOARD_ERROR",
                message="Erro ao carregar follow-ups.",
                details={"error": str(e)},
                status_code=500,
            )


class DashboardMinhasTarefasView(EmpresaQuerySetMixin, APIView):
    """GET /api/dashboard/minhas-tarefas/ — Tarefas pendentes do usuário logado."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()
        usuario_id = request.user.id

        try:
            tarefas = DashboardService.obter_minhas_tarefas(empresa_id, usuario_id)
            return success_response(
                data={"tarefas": tarefas},
                message="Minhas tarefas obtidas com sucesso.",
            )
        except Exception as e:
            logger.error(f"Dashboard minhas-tarefas error: {e}", exc_info=True)
            return error_response(
                code="DASHBOARD_ERROR",
                message="Erro ao carregar tarefas.",
                details={"error": str(e)},
                status_code=500,
            )


class DashboardAlertasEstoqueView(EmpresaQuerySetMixin, APIView):
    """GET /api/dashboard/alertas-estoque/ — Produtos com estoque crítico."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()

        try:
            alertas = DashboardService.obter_alertas_estoque(empresa_id)
            return success_response(
                data={"alertas": alertas},
                message="Alertas de estoque obtidos com sucesso.",
            )
        except Exception as e:
            logger.error(f"Dashboard alertas-estoque error: {e}", exc_info=True)
            return error_response(
                code="DASHBOARD_ERROR",
                message="Erro ao carregar alertas de estoque.",
                details={"error": str(e)},
                status_code=500,
            )


class DashboardProjetosView(EmpresaQuerySetMixin, APIView):
    """GET /api/dashboard/projetos/ — Projetos em andamento com progresso."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()

        try:
            projetos = DashboardService.obter_projetos_em_andamento(empresa_id)
            return success_response(
                data={"projetos": projetos},
                message="Projetos em andamento obtidos com sucesso.",
            )
        except Exception as e:
            logger.error(f"Dashboard projetos error: {e}", exc_info=True)
            return error_response(
                code="DASHBOARD_ERROR",
                message="Erro ao carregar projetos.",
                details={"error": str(e)},
                status_code=500,
            )


class DashboardAtividadeView(EmpresaQuerySetMixin, APIView):
    """GET /api/dashboard/atividade/?limit=10 — Feed de atividade recente."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()

        serializer = AtividadeQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Parâmetros inválidos.",
                details=serializer.errors,
            )

        limit = serializer.validated_data.get("limit", 10)

        try:
            atividade = DashboardService.obter_atividade_recente(empresa_id, limit)
            return success_response(
                data={"eventos": atividade},
                message="Atividade recente obtida com sucesso.",
            )
        except Exception as e:
            logger.error(f"Dashboard atividade error: {e}", exc_info=True)
            return error_response(
                code="DASHBOARD_ERROR",
                message="Erro ao carregar atividade recente.",
                details={"error": str(e)},
                status_code=500,
            )
