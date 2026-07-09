"""
Synapse - AI Hub Views
Endpoints:
  POST /api/ai/gerar/          → Solicitar geração (retorna TaskIA)
  GET  /api/ai/status/{id}/    → Polling de status da TaskIA
  GET  /api/ai/historico/      → Listar conteúdos gerados
  POST /api/ai/favoritar/{id}/ → Toggle favorito
  GET  /api/ai/uso/            → Uso mensal e limite do plano
  GET  /api/ai/insight/        → Último insight semanal
"""
import logging

from rest_framework.views import APIView
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from shared.responses import success_response, error_response
from shared.pagination import StandardPagination
from shared.authentication import CookieJWTAuthentication
from shared.permissions import IsEmpresaMember

from .serializers import (
    ConteudoGeradoSerializer,
    TaskIASerializer,
    SolicitacaoConteudoSerializer,
    PerguntaChatSerializer,
)
from .services import AIHubService
from .creditos import CreditosService, SemCreditosError
from .analise.service import AnaliseFinanceiraService, ComparacaoSemDadosError
from .analise.context import listar_meses_com_dados
from .chat.service import ChatFinanceiroService

logger = logging.getLogger("synapse")


class GerarConteudoView(APIView):
    """POST /api/ai/gerar/ — Solicita geração assíncrona de conteúdo."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]
    # R2: 10 requisições/minuto por usuário autenticado (ScopedRateThrottle)
    throttle_scope = "ai_gerar"

    def post(self, request):
        serializer = SolicitacaoConteudoSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        empresa_id = request.user.empresa_id
        usuario_id = request.user.id
        tipo = serializer.validated_data["tipo"]
        parametros = serializer.validated_data["parametros"]

        try:
            task_ia = AIHubService.solicitar_geracao(
                empresa_id=empresa_id,
                usuario_id=usuario_id,
                tipo=tipo,
                parametros=parametros,
            )
        except SemCreditosError as e:
            return error_response(
                code=e.code,
                message=e.message,
                details=e.details,
                status_code=e.status_code,  # 402
            )
        except Exception as e:
            logger.error(f"AI Hub: erro ao solicitar geração — {e}", exc_info=True)
            return error_response(
                code="AI_ERROR",
                message="Erro ao iniciar geração.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return success_response(
            data=TaskIASerializer(task_ia).data,
            message="Geração iniciada. Faça polling em /api/ai/status/{id}/",
            status_code=status.HTTP_202_ACCEPTED,
        )


class AnaliseFinanceiraView(APIView):
    """
    POST /api/ai/analise-financeira/ — Solicita a análise financeira.
    Aceita comparação seletiva de dois períodos por query params:
      ?mes=7&ano=2026&comparar_mes=6&comparar_ano=2026
    Sem os params de comparação: compara com o mês anterior (retrocompatível).
    Respostas possíveis (campo `status` no data):
      - sem_dados    → não há movimento suficiente (estado tratado, não erro)
      - concluido    → análise em cache (retorna `analise` na hora)
      - processando  → disparou a IA; faça polling em /api/ai/status/{task_id}/
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]
    throttle_scope = "ai_gerar"

    @staticmethod
    def _int_param(request, nome):
        valor = request.query_params.get(nome)
        if valor in (None, ""):
            return None
        try:
            return int(valor)
        except (TypeError, ValueError):
            return None

    def post(self, request):
        empresa_id = request.user.empresa_id
        mes = self._int_param(request, "mes")
        ano = self._int_param(request, "ano")
        comparar_mes = self._int_param(request, "comparar_mes")
        comparar_ano = self._int_param(request, "comparar_ano")
        try:
            resultado = AnaliseFinanceiraService.solicitar(
                empresa_id=empresa_id,
                usuario_id=request.user.id,
                mes=mes,
                ano=ano,
                comparar_mes=comparar_mes,
                comparar_ano=comparar_ano,
            )
        except SemCreditosError as e:
            return error_response(
                code=e.code,
                message=e.message,
                details=e.details,
                status_code=e.status_code,  # 402
            )
        except ComparacaoSemDadosError as e:
            return error_response(
                code=e.code,
                message=e.message,
                details=e.details,
                status_code=e.status_code,  # 400
            )
        except Exception as e:
            logger.error(f"AI Hub: erro ao solicitar análise — {e}", exc_info=True)
            return error_response(
                code="AI_ERROR",
                message="Erro ao iniciar a análise financeira.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        status_code = (
            status.HTTP_202_ACCEPTED
            if resultado.get("status") == "processando"
            else status.HTTP_200_OK
        )
        return success_response(data=resultado, status_code=status_code)


class MesesComDadosView(APIView):
    """
    GET /api/ai/analise-financeira/meses/ — Meses que têm lançamentos, do mais
    recente ao mais antigo. Alimenta os seletores de período da Análise.
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        meses = listar_meses_com_dados(request.user.empresa_id)
        return success_response(data=meses)


class ChatFinanceiroPerguntaView(APIView):
    """
    POST /api/ai/chat-financeiro/pergunta/ — Uma pergunta ao consultor
    financeiro conversacional (restrito ao financeiro do próprio negócio).
    Body: { pergunta: str, historico: [{role, content}, ...] }
    Reserva 2 créditos (operacao chat_financeiro), dispara a IA e devolve o
    task_id para polling em /api/ai/status/{id}/. 402 se não houver saldo.
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]
    throttle_scope = "ai_gerar"

    def post(self, request):
        serializer = PerguntaChatSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Pergunta inválida.",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        empresa_id = request.user.empresa_id
        try:
            resultado = ChatFinanceiroService.solicitar(
                empresa_id=empresa_id,
                usuario_id=request.user.id,
                pergunta=serializer.validated_data["pergunta"],
                historico=serializer.validated_data.get("historico", []),
            )
        except SemCreditosError as e:
            return error_response(
                code=e.code,
                message=e.message,
                details=e.details,
                status_code=e.status_code,  # 402
            )
        except Exception as e:
            logger.error(f"AI Hub: erro no chat financeiro — {e}", exc_info=True)
            return error_response(
                code="AI_ERROR",
                message="Erro ao processar a pergunta.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return success_response(
            data=resultado,
            message="Pergunta recebida. Faça polling em /api/ai/status/{id}/",
            status_code=status.HTTP_202_ACCEPTED,
        )


class StatusTaskView(APIView):
    """GET /api/ai/status/{task_id}/ — Polling de status da TaskIA."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, task_id):
        empresa_id = request.user.empresa_id
        try:
            task_ia = AIHubService.obter_status_task(empresa_id, task_id)
        except Exception as e:
            return error_response(
                code="NOT_FOUND",
                message=str(e),
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return success_response(data=TaskIASerializer(task_ia).data)


class HistoricoConteudosView(APIView):
    """GET /api/ai/historico/ — Lista conteúdos gerados com paginação."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = request.user.empresa_id
        tipo = request.query_params.get("tipo")
        favorito_param = request.query_params.get("favorito")
        favorito = None
        if favorito_param is not None:
            favorito = favorito_param.lower() in ("true", "1")

        qs = AIHubService.listar_conteudos(empresa_id, tipo=tipo, favorito=favorito)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = ConteudoGeradoSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class FavoritarConteudoView(APIView):
    """POST /api/ai/favoritar/{conteudo_id}/ — Toggle favorito."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request, conteudo_id):
        empresa_id = request.user.empresa_id
        try:
            conteudo = AIHubService.toggle_favorito(empresa_id, conteudo_id)
        except Exception as e:
            return error_response(
                code="NOT_FOUND",
                message=str(e),
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return success_response(
            data=ConteudoGeradoSerializer(conteudo).data,
            message="Favorito atualizado.",
        )


class CreditosView(APIView):
    """
    GET /api/ai/creditos/ — Saldo de créditos DIÁRIOS de IA da empresa.
    Retorna: usado, limite, restante, plano, ilimitado, renova_em.
    (/api/ai/uso/ é um alias legado que retorna o mesmo payload.)
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        return success_response(data=CreditosService.saldo(request.user.empresa_id))


class InsightSemanalView(APIView):
    """GET /api/ai/insight/ — Último insight semanal gerado."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = request.user.empresa_id
        insight = AIHubService.obter_insight_semanal(empresa_id)
        if not insight:
            return success_response(
                data=None,
                message="Nenhum insight disponível ainda. O insight semanal é gerado automaticamente toda semana.",
            )
        return success_response(data=ConteudoGeradoSerializer(insight).data)
