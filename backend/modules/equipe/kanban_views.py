"""
Synapse — Equipe: Views do Kanban da equipe.

Colunas, tarefas pessoais e o board consolidado. Multi-tenant via
request.user.empresa_id + IsEmpresaMember. Permissões finas (admin vs membro)
ficam no KanbanEquipeService.
"""
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from shared.authentication import CookieJWTAuthentication
from shared.permissions import IsEmpresaMember
from shared.responses import (
    created_response,
    error_response,
    no_content_response,
    success_response,
)

from .exceptions import PermissaoNegadaError, RegraKanbanError
from .kanban_service import KanbanEquipeService
from .kanban_serializers import (
    ColunaCreateUpdateSerializer,
    ColunaKanbanSerializer,
    MoverTarefaSerializer,
    ReordenarColunasSerializer,
    TarefaPessoalCreateSerializer,
    TarefaPessoalSerializer,
)


def _err_permissao(exc):
    return error_response(
        code="PERMISSAO_NEGADA", message=exc.message,
        status_code=status.HTTP_403_FORBIDDEN,
    )


def _err_regra(exc):
    return error_response(
        code="REGRA_KANBAN", message=exc.message, details=getattr(exc, "details", {}),
        status_code=status.HTTP_400_BAD_REQUEST,
    )


class ColunasListCreateView(APIView):
    """GET/POST /api/equipe/kanban/colunas/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = str(request.user.empresa_id)
        qs = KanbanEquipeService.listar_colunas(empresa_id)
        return success_response(data=ColunaKanbanSerializer(qs, many=True).data)

    def post(self, request):
        serializer = ColunaCreateUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR", message="Dados inválidos.",
                details=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            coluna = KanbanEquipeService.criar_coluna(
                str(request.user.empresa_id), request.user, dict(serializer.validated_data)
            )
        except PermissaoNegadaError as e:
            return _err_permissao(e)
        return created_response(
            data=ColunaKanbanSerializer(coluna).data, message="Coluna criada."
        )


class ColunaDetailView(APIView):
    """PATCH/DELETE /api/equipe/kanban/colunas/{id}/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def patch(self, request, coluna_id):
        serializer = ColunaCreateUpdateSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR", message="Dados inválidos.",
                details=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            coluna = KanbanEquipeService.atualizar_coluna(
                str(request.user.empresa_id), request.user, coluna_id,
                dict(serializer.validated_data),
            )
        except PermissaoNegadaError as e:
            return _err_permissao(e)
        except RegraKanbanError as e:
            return _err_regra(e)
        return success_response(
            data=ColunaKanbanSerializer(coluna).data, message="Coluna atualizada."
        )

    def delete(self, request, coluna_id):
        mover_para = request.data.get("mover_para") if request.data else None
        try:
            KanbanEquipeService.excluir_coluna(
                str(request.user.empresa_id), request.user, coluna_id, mover_para
            )
        except PermissaoNegadaError as e:
            return _err_permissao(e)
        except RegraKanbanError as e:
            return _err_regra(e)
        return no_content_response()


class ReordenarColunasView(APIView):
    """POST /api/equipe/kanban/colunas/reordenar/ — Body: [{id, ordem}, ...]"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request):
        serializer = ReordenarColunasSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR", message="Dados inválidos.",
                details=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            colunas = KanbanEquipeService.reordenar_colunas(
                str(request.user.empresa_id), request.user,
                serializer.validated_data["itens"],
            )
        except PermissaoNegadaError as e:
            return _err_permissao(e)
        return success_response(
            data=ColunaKanbanSerializer(colunas, many=True).data,
            message="Colunas reordenadas.",
        )


class TarefasPessoaisListCreateView(APIView):
    """GET/POST /api/equipe/tarefas/?membro=&coluna="""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        filtros = {
            "membro": request.query_params.get("membro"),
            "coluna": request.query_params.get("coluna"),
        }
        qs = KanbanEquipeService.listar_tarefas(str(request.user.empresa_id), filtros)
        return success_response(data=TarefaPessoalSerializer(qs, many=True).data)

    def post(self, request):
        serializer = TarefaPessoalCreateSerializer(
            data=request.data, context={"request": request}
        )
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR", message="Dados inválidos.",
                details=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            tarefa = KanbanEquipeService.criar_tarefa(
                str(request.user.empresa_id), request.user, dict(serializer.validated_data)
            )
        except PermissaoNegadaError as e:
            return _err_permissao(e)
        except RegraKanbanError as e:
            return _err_regra(e)
        return created_response(
            data=TarefaPessoalSerializer(tarefa).data, message="Tarefa criada."
        )


class TarefaPessoalDetailView(APIView):
    """PATCH/DELETE /api/equipe/tarefas/{id}/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def patch(self, request, tarefa_id):
        serializer = TarefaPessoalCreateSerializer(
            data=request.data, partial=True, context={"request": request}
        )
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR", message="Dados inválidos.",
                details=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            tarefa = KanbanEquipeService.atualizar_tarefa(
                str(request.user.empresa_id), request.user, tarefa_id,
                dict(serializer.validated_data),
            )
        except PermissaoNegadaError as e:
            return _err_permissao(e)
        except RegraKanbanError as e:
            return _err_regra(e)
        return success_response(
            data=TarefaPessoalSerializer(tarefa).data, message="Tarefa atualizada."
        )

    def delete(self, request, tarefa_id):
        try:
            KanbanEquipeService.deletar_tarefa(
                str(request.user.empresa_id), request.user, tarefa_id
            )
        except PermissaoNegadaError as e:
            return _err_permissao(e)
        except RegraKanbanError as e:
            return _err_regra(e)
        return no_content_response()


class MoverTarefaView(APIView):
    """POST /api/equipe/tarefas/{id}/mover/ — Body: {coluna_id, ordem_na_coluna}"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request, tarefa_id):
        serializer = MoverTarefaSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR", message="Dados inválidos.",
                details=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            tarefa = KanbanEquipeService.mover_tarefa(
                str(request.user.empresa_id), request.user, tarefa_id,
                str(serializer.validated_data["coluna_id"]),
                serializer.validated_data.get("ordem_na_coluna", 0),
            )
        except PermissaoNegadaError as e:
            return _err_permissao(e)
        except RegraKanbanError as e:
            return _err_regra(e)
        return success_response(
            data=TarefaPessoalSerializer(tarefa).data, message="Tarefa movida."
        )


class KanbanConsolidadoView(APIView):
    """GET /api/equipe/kanban/?membro={id} — board consolidado (cacheado 60s)."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        membro = request.query_params.get("membro")
        data = KanbanEquipeService.montar_kanban(str(request.user.empresa_id), membro)
        return success_response(data=data)
