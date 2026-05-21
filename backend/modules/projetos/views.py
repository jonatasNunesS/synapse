"""
Synapse — M6: Views do módulo Projetos e Tarefas.
Todas as views herdam EmpresaQuerySetMixin (multi-tenant obrigatório).
"""
import logging

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
    ChecklistItemSerializer,
    ComentarioCreateSerializer,
    ComentarioSerializer,
    KanbanSerializer,
    ProjetoCreateUpdateSerializer,
    ProjetoDetailSerializer,
    ProjetoListSerializer,
    ResumoProjetosSerializer,
    TarefaCreateSerializer,
    TarefaDetailSerializer,
    TarefaListSerializer,
    TarefaMoverSerializer,
)
from .services import ProjetoService

logger = logging.getLogger("synapse")


# ════════════════════════════════════════════════════════════
# PROJETOS
# ════════════════════════════════════════════════════════════

class ProjetoListCreateView(EmpresaQuerySetMixin, APIView):
    """GET /api/projetos/ — POST /api/projetos/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()

        filtros = {}
        for campo in ("status", "prioridade", "responsavel_id", "busca"):
            if request.query_params.get(campo):
                filtros[campo] = request.query_params[campo]
        if request.query_params.get("esta_atrasado"):
            filtros["esta_atrasado"] = request.query_params["esta_atrasado"]

        projetos = ProjetoService.listar_projetos(empresa_id, filtros)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(projetos, request)
        serializer = ProjetoListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        empresa_id = self.get_empresa_id()
        serializer = ProjetoCreateUpdateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        try:
            projeto = ProjetoService.criar_projeto(
                empresa_id, request.user.id, serializer.validated_data
            )
        except ValueError as e:
            return error_response("PROJETO_INVALIDO", str(e))
        return created_response(
            data=ProjetoDetailSerializer(projeto).data,
            message="Projeto criado com sucesso.",
        )


class ProjetoDetailView(EmpresaQuerySetMixin, APIView):
    """GET/PUT/PATCH/DELETE /api/projetos/{id}/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            projeto = ProjetoService.obter_projeto(empresa_id, pk)
        except ValueError as e:
            return error_response("PROJETO_NAO_ENCONTRADO", str(e), status_code=404)
        return success_response(data=ProjetoDetailSerializer(projeto).data)

    def put(self, request, pk):
        return self._update(request, pk, partial=False)

    def patch(self, request, pk):
        return self._update(request, pk, partial=True)

    def _update(self, request, pk, partial: bool):
        empresa_id = self.get_empresa_id()
        try:
            projeto = ProjetoService.obter_projeto(empresa_id, pk)
        except ValueError as e:
            return error_response("PROJETO_NAO_ENCONTRADO", str(e), status_code=404)

        serializer = ProjetoCreateUpdateSerializer(
            projeto, data=request.data, partial=partial, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        try:
            projeto = ProjetoService.atualizar_projeto(
                empresa_id, pk, serializer.validated_data
            )
        except ValueError as e:
            return error_response("PROJETO_INVALIDO", str(e))
        return success_response(
            data=ProjetoDetailSerializer(projeto).data,
            message="Projeto atualizado com sucesso.",
        )

    def delete(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            ProjetoService.deletar_projeto(empresa_id, pk)
        except ValueError as e:
            return error_response("PROJETO_NAO_ENCONTRADO", str(e), status_code=400)
        return success_response(message="Projeto removido com sucesso.")


class ProjetoKanbanView(EmpresaQuerySetMixin, APIView):
    """GET /api/projetos/{id}/kanban/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            ProjetoService.obter_projeto(empresa_id, pk)
        except ValueError as e:
            return error_response("PROJETO_NAO_ENCONTRADO", str(e), status_code=404)

        kanban = ProjetoService.obter_kanban(empresa_id, pk)
        serializer = KanbanSerializer(kanban)
        return success_response(
            data=serializer.data,
            message="Kanban carregado com sucesso.",
        )


class ProjetoTarefasView(EmpresaQuerySetMixin, APIView):
    """GET /api/projetos/{id}/tarefas/ — POST /api/projetos/{id}/tarefas/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            ProjetoService.obter_projeto(empresa_id, pk)
        except ValueError as e:
            return error_response("PROJETO_NAO_ENCONTRADO", str(e), status_code=404)

        filtros = {"projeto_id": pk}
        for campo in ("status", "prioridade", "responsavel_id", "busca"):
            if request.query_params.get(campo):
                filtros[campo] = request.query_params[campo]

        tarefas = ProjetoService.listar_tarefas(empresa_id, filtros)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(tarefas, request)
        serializer = TarefaListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request, pk):
        empresa_id = self.get_empresa_id()
        # Injeta o projeto_id no body
        data = request.data.copy()
        data["projeto"] = str(pk)

        serializer = TarefaCreateSerializer(
            data=data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        try:
            tarefa = ProjetoService.criar_tarefa(
                empresa_id, request.user.id, serializer.validated_data
            )
        except ValueError as e:
            return error_response("TAREFA_INVALIDA", str(e))
        return created_response(
            data=TarefaDetailSerializer(tarefa).data,
            message="Tarefa criada com sucesso.",
        )


class ProjetoResumoView(EmpresaQuerySetMixin, APIView):
    """GET /api/projetos/resumo/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()
        resumo = ProjetoService.obter_resumo(empresa_id, request.user.id)
        serializer = ResumoProjetosSerializer(data=resumo)
        serializer.is_valid()
        return success_response(
            data=resumo,
            message="Resumo de projetos carregado com sucesso.",
        )


# ════════════════════════════════════════════════════════════
# TAREFAS
# ════════════════════════════════════════════════════════════

class TarefaListView(EmpresaQuerySetMixin, APIView):
    """GET /api/tarefas/ — lista todas as tarefas da empresa"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()

        filtros = {}
        for campo in ("projeto_id", "status", "prioridade", "responsavel_id", "busca"):
            if request.query_params.get(campo):
                filtros[campo] = request.query_params[campo]
        if request.query_params.get("esta_atrasada"):
            filtros["esta_atrasada"] = request.query_params["esta_atrasada"]

        tarefas = ProjetoService.listar_tarefas(empresa_id, filtros)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(tarefas, request)
        serializer = TarefaListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class TarefaDetailView(EmpresaQuerySetMixin, APIView):
    """GET/PUT/PATCH/DELETE /api/tarefas/{id}/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            tarefa = ProjetoService.obter_tarefa(empresa_id, pk)
        except ValueError as e:
            return error_response("TAREFA_NAO_ENCONTRADA", str(e), status_code=404)
        return success_response(data=TarefaDetailSerializer(tarefa).data)

    def put(self, request, pk):
        return self._update(request, pk, partial=False)

    def patch(self, request, pk):
        return self._update(request, pk, partial=True)

    def _update(self, request, pk, partial: bool):
        empresa_id = self.get_empresa_id()
        try:
            tarefa = ProjetoService.obter_tarefa(empresa_id, pk)
        except ValueError as e:
            return error_response("TAREFA_NAO_ENCONTRADA", str(e), status_code=404)

        serializer = TarefaCreateSerializer(
            tarefa, data=request.data, partial=partial, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        try:
            tarefa = ProjetoService.atualizar_tarefa(
                empresa_id, pk, serializer.validated_data
            )
        except ValueError as e:
            return error_response("TAREFA_INVALIDA", str(e))
        return success_response(
            data=TarefaDetailSerializer(tarefa).data,
            message="Tarefa atualizada com sucesso.",
        )

    def delete(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            ProjetoService.deletar_tarefa(empresa_id, pk)
        except ValueError as e:
            return error_response("TAREFA_NAO_ENCONTRADA", str(e), status_code=404)
        return no_content_response()


class TarefaMoverView(EmpresaQuerySetMixin, APIView):
    """PATCH /api/tarefas/{id}/mover/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def patch(self, request, pk):
        empresa_id = self.get_empresa_id()
        serializer = TarefaMoverSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            tarefa = ProjetoService.mover_tarefa(
                empresa_id=empresa_id,
                tarefa_id=pk,
                novo_status=serializer.validated_data["status"],
                nova_ordem=serializer.validated_data.get("ordem", 0),
            )
        except ValueError as e:
            return error_response("TAREFA_NAO_ENCONTRADA", str(e), status_code=404)

        return success_response(
            data=TarefaListSerializer(tarefa).data,
            message="Tarefa movida com sucesso.",
        )


# ════════════════════════════════════════════════════════════
# COMENTÁRIOS
# ════════════════════════════════════════════════════════════

class ComentarioListCreateView(EmpresaQuerySetMixin, APIView):
    """GET/POST /api/tarefas/{id}/comentarios/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            comentarios = ProjetoService.listar_comentarios(empresa_id, pk)
        except ValueError as e:
            return error_response("TAREFA_NAO_ENCONTRADA", str(e), status_code=404)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(comentarios, request)
        serializer = ComentarioSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request, pk):
        empresa_id = self.get_empresa_id()
        serializer = ComentarioCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            comentario = ProjetoService.adicionar_comentario(
                empresa_id=empresa_id,
                tarefa_id=pk,
                autor_id=request.user.id,
                texto=serializer.validated_data["texto"],
            )
        except ValueError as e:
            return error_response("TAREFA_NAO_ENCONTRADA", str(e), status_code=404)

        return created_response(
            data=ComentarioSerializer(comentario).data,
            message="Comentário adicionado com sucesso.",
        )


class ComentarioDetailView(EmpresaQuerySetMixin, APIView):
    """PATCH/DELETE /api/tarefas/{tarefa_id}/comentarios/{cid}/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def patch(self, request, pk, cid):
        empresa_id = self.get_empresa_id()
        serializer = ComentarioCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            comentario = ProjetoService.editar_comentario(
                empresa_id=empresa_id,
                tarefa_id=pk,
                comentario_id=cid,
                autor_id=request.user.id,
                texto=serializer.validated_data["texto"],
            )
        except ValueError as e:
            return error_response("COMENTARIO_NAO_ENCONTRADO", str(e), status_code=404)
        except PermissionError as e:
            return error_response("PERMISSAO_NEGADA", str(e), status_code=403)

        return success_response(
            data=ComentarioSerializer(comentario).data,
            message="Comentário atualizado com sucesso.",
        )

    def delete(self, request, pk, cid):
        empresa_id = self.get_empresa_id()
        try:
            ProjetoService.deletar_comentario(
                empresa_id=empresa_id,
                tarefa_id=pk,
                comentario_id=cid,
                autor_id=request.user.id,
            )
        except ValueError as e:
            return error_response("COMENTARIO_NAO_ENCONTRADO", str(e), status_code=404)
        except PermissionError as e:
            return error_response("PERMISSAO_NEGADA", str(e), status_code=403)

        return no_content_response()


# ════════════════════════════════════════════════════════════
# CHECKLIST
# ════════════════════════════════════════════════════════════

class ChecklistCreateView(EmpresaQuerySetMixin, APIView):
    """POST /api/tarefas/{id}/checklist/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request, pk):
        empresa_id = self.get_empresa_id()
        texto = request.data.get("texto", "").strip()
        if not texto:
            return error_response("TEXTO_OBRIGATORIO", "O campo 'texto' é obrigatório.")
        ordem = request.data.get("ordem", 0)

        try:
            item = ProjetoService.adicionar_checklist_item(
                empresa_id=empresa_id,
                tarefa_id=pk,
                texto=texto,
                ordem=ordem,
            )
        except ValueError as e:
            return error_response("TAREFA_NAO_ENCONTRADA", str(e), status_code=404)

        return created_response(
            data=ChecklistItemSerializer(item).data,
            message="Item adicionado ao checklist.",
        )


class ChecklistDetailView(EmpresaQuerySetMixin, APIView):
    """PATCH/DELETE /api/tarefas/{tarefa_id}/checklist/{item_id}/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def patch(self, request, pk, item_id):
        empresa_id = self.get_empresa_id()
        try:
            item = ProjetoService.toggle_checklist_item(
                empresa_id=empresa_id,
                tarefa_id=pk,
                item_id=item_id,
            )
        except ValueError as e:
            return error_response("ITEM_NAO_ENCONTRADO", str(e), status_code=404)

        return success_response(
            data=ChecklistItemSerializer(item).data,
            message="Item atualizado.",
        )

    def delete(self, request, pk, item_id):
        empresa_id = self.get_empresa_id()
        try:
            ProjetoService.deletar_checklist_item(
                empresa_id=empresa_id,
                tarefa_id=pk,
                item_id=item_id,
            )
        except ValueError as e:
            return error_response("ITEM_NAO_ENCONTRADO", str(e), status_code=404)

        return no_content_response()
