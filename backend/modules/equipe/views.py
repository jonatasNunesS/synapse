"""
Synapse — M7: Views do módulo Equipe.
View → Service → Repository → Model (Clean Architecture).
"""
import logging
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from shared.authentication import CookieJWTAuthentication
from shared.pagination import StandardPagination
from shared.permissions import IsEmpresaMember
from shared.responses import success_response, error_response, no_content_response
from .models import MembroEquipe, MetaMembro
from .repository import EquipeRepository
from .serializers import (
    MembroEquipeListSerializer,
    MembroEquipeDetailSerializer,
    MembroEquipeCreateSerializer,
    ConvidarMembroSerializer,
    MetaMembroSerializer,
    ResumoEquipeSerializer,
)
from .services import EquipeService

logger = logging.getLogger("synapse")


class MembroListCreateView(APIView):
    """GET /api/equipe/membros/ | POST /api/equipe/membros/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = str(request.user.empresa_id)
        filtros = {
            "departamento": request.query_params.get("departamento"),
            "perfil": request.query_params.get("perfil"),
            "ativo": request.query_params.get("ativo"),
            "busca": request.query_params.get("busca"),
        }
        if filtros["ativo"] is not None:
            filtros["ativo"] = filtros["ativo"].lower() == "true"

        qs = EquipeRepository.listar(empresa_id, filtros)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = MembroEquipeListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        serializer = MembroEquipeCreateSerializer(
            data=request.data, context={"request": request}
        )
        if not serializer.is_valid():
            return error_response("VALIDATION_ERROR", "Dados inválidos.", serializer.errors, 400)

        dados = serializer.validated_data
        usuario_id = str(dados.pop("usuario_id"))
        membro = EquipeService.adicionar_membro(
            str(request.user.empresa_id), usuario_id, dados
        )
        return success_response(
            MembroEquipeDetailSerializer(membro).data,
            "Membro adicionado à equipe.",
            status_code=201,
        )


class MembroDetailView(APIView):
    """GET/PATCH/DELETE /api/equipe/membros/{id}/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, pk):
        try:
            membro = EquipeRepository.obter(str(pk), str(request.user.empresa_id))
            return success_response(MembroEquipeDetailSerializer(membro).data)
        except MembroEquipe.DoesNotExist:
            return error_response("NOT_FOUND", "Membro não encontrado.", status_code=404)

    def patch(self, request, pk):
        try:
            membro = EquipeRepository.obter(str(pk), str(request.user.empresa_id))
        except MembroEquipe.DoesNotExist:
            return error_response("NOT_FOUND", "Membro não encontrado.", status_code=404)

        campos_permitidos = ["cargo", "departamento", "bio", "data_entrada", "ativo"]
        dados = {k: v for k, v in request.data.items() if k in campos_permitidos}
        membro = EquipeService.atualizar_membro(str(pk), str(request.user.empresa_id), dados)
        return success_response(MembroEquipeDetailSerializer(membro).data, "Membro atualizado.")

    def delete(self, request, pk):
        deleted = EquipeService.remover_membro(str(pk), str(request.user.empresa_id))
        if not deleted:
            return error_response("NOT_FOUND", "Membro não encontrado.", status_code=404)
        return no_content_response()


class ConvidarMembroView(APIView):
    """POST /api/equipe/convidar/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request):
        serializer = ConvidarMembroSerializer(
            data=request.data, context={"request": request}
        )
        if not serializer.is_valid():
            return error_response("VALIDATION_ERROR", "Dados inválidos.", serializer.errors, 400)

        dados = serializer.validated_data
        dados_usuario = {
            "email": dados["email"],
            "nome": dados["nome"],
            "perfil": dados["perfil"],
        }
        dados_membro = {
            "cargo": dados.get("cargo", ""),
            "departamento": dados.get("departamento", ""),
        }
        usuario, membro = EquipeService.convidar_membro(
            str(request.user.empresa_id), dados_usuario, dados_membro
        )
        return success_response(
            MembroEquipeDetailSerializer(membro).data,
            f"Convite enviado para {usuario.email}.",
            status_code=201,
        )


class ResumoEquipeView(APIView):
    """GET /api/equipe/resumo/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        resumo = EquipeService.obter_resumo(str(request.user.empresa_id))
        return success_response(resumo)


class MetaListCreateView(APIView):
    """GET/POST /api/equipe/membros/{id}/metas/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, membro_id):
        try:
            EquipeRepository.obter(str(membro_id), str(request.user.empresa_id))
        except MembroEquipe.DoesNotExist:
            return error_response("NOT_FOUND", "Membro não encontrado.", status_code=404)

        metas = EquipeRepository.listar_metas(str(membro_id), str(request.user.empresa_id))
        serializer = MetaMembroSerializer(metas, many=True)
        return success_response(serializer.data)

    def post(self, request, membro_id):
        try:
            EquipeRepository.obter(str(membro_id), str(request.user.empresa_id))
        except MembroEquipe.DoesNotExist:
            return error_response("NOT_FOUND", "Membro não encontrado.", status_code=404)

        serializer = MetaMembroSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response("VALIDATION_ERROR", "Dados inválidos.", serializer.errors, 400)

        meta = EquipeService.criar_meta(
            str(membro_id), str(request.user.empresa_id), serializer.validated_data
        )
        return success_response(MetaMembroSerializer(meta).data, "Meta criada.", status_code=201)


class MetaDetailView(APIView):
    """GET/PATCH/DELETE /api/equipe/membros/{id}/metas/{meta_id}/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, membro_id, meta_id):
        try:
            meta = EquipeRepository.obter_meta(
                str(meta_id), str(membro_id), str(request.user.empresa_id)
            )
            return success_response(MetaMembroSerializer(meta).data)
        except MetaMembro.DoesNotExist:
            return error_response("NOT_FOUND", "Meta não encontrada.", status_code=404)

    def patch(self, request, membro_id, meta_id):
        try:
            meta = EquipeRepository.obter_meta(
                str(meta_id), str(membro_id), str(request.user.empresa_id)
            )
        except MetaMembro.DoesNotExist:
            return error_response("NOT_FOUND", "Meta não encontrada.", status_code=404)

        serializer = MetaMembroSerializer(meta, data=request.data, partial=True)
        if not serializer.is_valid():
            return error_response("VALIDATION_ERROR", "Dados inválidos.", serializer.errors, 400)

        meta = EquipeService.atualizar_meta(
            str(meta_id), str(membro_id), str(request.user.empresa_id),
            serializer.validated_data
        )
        return success_response(MetaMembroSerializer(meta).data, "Meta atualizada.")

    def delete(self, request, membro_id, meta_id):
        deleted = EquipeService.deletar_meta(
            str(meta_id), str(membro_id), str(request.user.empresa_id)
        )
        if not deleted:
            return error_response("NOT_FOUND", "Meta não encontrada.", status_code=404)
        return no_content_response()
