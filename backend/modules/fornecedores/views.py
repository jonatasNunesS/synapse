"""
M5 — Fornecedores: Views
Endpoints REST para fornecedores, categorias, compras, ranking e resumo.
"""
import logging

from rest_framework.views import APIView

from shared.authentication import CookieJWTAuthentication
from shared.permissions import IsEmpresaMember
from shared.pagination import StandardPagination
from shared.responses import success_response, created_response, no_content_response, error_response
from shared.exceptions import ResourceNotFound, BusinessRuleViolation

from .serializers import (
    CategoriaFornecedorSerializer,
    FornecedorListSerializer,
    FornecedorDetailSerializer,
    FornecedorCreateUpdateSerializer,
    AvaliacaoFornecedorSerializer,
    CompraFornecedorSerializer,
    CompraFornecedorCreateSerializer,
    RankingFornecedorSerializer,
    ResumoFornecedoresSerializer,
)
from .services import FornecedorService

logger = logging.getLogger(__name__)


# ─── Resumo / KPIs ───────────────────────────────────────────────────────────

class FornecedorResumoView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsEmpresaMember]

    def get(self, request):
        empresa_id = request.user.empresa_id
        resumo = FornecedorService.calcular_resumo(empresa_id)
        serializer = ResumoFornecedoresSerializer(resumo)
        return success_response(data=serializer.data)


# ─── Ranking ─────────────────────────────────────────────────────────────────

class FornecedorRankingView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsEmpresaMember]

    def get(self, request):
        empresa_id = request.user.empresa_id
        ranking = FornecedorService.obter_ranking(empresa_id)
        serializer = RankingFornecedorSerializer(ranking, many=True)
        return success_response(data=serializer.data)


# ─── Categorias ──────────────────────────────────────────────────────────────

class CategoriaFornecedorListCreateView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsEmpresaMember]

    def get(self, request):
        empresa_id = request.user.empresa_id
        categorias = FornecedorService.listar_categorias(empresa_id)
        serializer = CategoriaFornecedorSerializer(categorias, many=True)
        return success_response(data=serializer.data)

    def post(self, request):
        serializer = CategoriaFornecedorSerializer(
            data=request.data, context={"request": request}
        )
        if not serializer.is_valid():
            return error_response(
                "VALIDATION_ERROR",
                "Dados inválidos.",
                details=serializer.errors,
            )
        categoria = FornecedorService.criar_categoria(
            request.user.empresa_id, serializer.validated_data
        )
        return created_response(
            data=CategoriaFornecedorSerializer(categoria).data,
            message="Categoria criada com sucesso.",
        )


class CategoriaFornecedorDetailView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsEmpresaMember]

    def get(self, request, pk):
        try:
            categoria = FornecedorService.obter_categoria(request.user.empresa_id, pk)
            return success_response(data=CategoriaFornecedorSerializer(categoria).data)
        except ResourceNotFound as exc:
            return error_response("NOT_FOUND", str(exc), status_code=404)

    def patch(self, request, pk):
        try:
            categoria = FornecedorService.obter_categoria(request.user.empresa_id, pk)
        except ResourceNotFound as exc:
            return error_response("NOT_FOUND", str(exc), status_code=404)

        serializer = CategoriaFornecedorSerializer(
            categoria, data=request.data, partial=True, context={"request": request}
        )
        if not serializer.is_valid():
            return error_response("VALIDATION_ERROR", "Dados inválidos.", details=serializer.errors)

        categoria_atualizada = FornecedorService.atualizar_categoria(
            request.user.empresa_id, pk, serializer.validated_data
        )
        return success_response(
            data=CategoriaFornecedorSerializer(categoria_atualizada).data,
            message="Categoria atualizada com sucesso.",
        )

    def delete(self, request, pk):
        try:
            FornecedorService.deletar_categoria(request.user.empresa_id, pk)
            return no_content_response()
        except ResourceNotFound as exc:
            return error_response("NOT_FOUND", str(exc), status_code=404)
        except BusinessRuleViolation as exc:
            return error_response("BUSINESS_ERROR", str(exc))


# ─── Fornecedores ─────────────────────────────────────────────────────────────

class FornecedorListCreateView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsEmpresaMember]

    def get(self, request):
        empresa_id = request.user.empresa_id
        filtros = {
            "categoria_id": request.query_params.get("categoria_id"),
            "status": request.query_params.get("status"),
            "ativo": (
                True if request.query_params.get("ativo") == "true"
                else False if request.query_params.get("ativo") == "false"
                else None
            ),
            "busca": request.query_params.get("busca"),
            "tem_avaliacao": request.query_params.get("tem_avaliacao") == "true",
        }
        qs = FornecedorService.listar_fornecedores(empresa_id, filtros)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = FornecedorListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        serializer = FornecedorCreateUpdateSerializer(
            data=request.data, context={"request": request}
        )
        if not serializer.is_valid():
            return error_response("VALIDATION_ERROR", "Dados inválidos.", details=serializer.errors)

        fornecedor = FornecedorService.criar_fornecedor(
            request.user.empresa_id,
            request.user.id,
            serializer.validated_data,
        )
        return created_response(
            data=FornecedorDetailSerializer(fornecedor).data,
            message="Fornecedor criado com sucesso.",
        )


class FornecedorDetailView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsEmpresaMember]

    def get(self, request, pk):
        try:
            fornecedor = FornecedorService.obter_fornecedor(request.user.empresa_id, pk)
            return success_response(data=FornecedorDetailSerializer(fornecedor).data)
        except ResourceNotFound as exc:
            return error_response("NOT_FOUND", str(exc), status_code=404)

    def patch(self, request, pk):
        try:
            fornecedor = FornecedorService.obter_fornecedor(request.user.empresa_id, pk)
        except ResourceNotFound as exc:
            return error_response("NOT_FOUND", str(exc), status_code=404)

        serializer = FornecedorCreateUpdateSerializer(
            fornecedor, data=request.data, partial=True, context={"request": request}
        )
        if not serializer.is_valid():
            return error_response("VALIDATION_ERROR", "Dados inválidos.", details=serializer.errors)

        fornecedor_atualizado = FornecedorService.atualizar_fornecedor(
            request.user.empresa_id, pk, serializer.validated_data
        )
        return success_response(
            data=FornecedorDetailSerializer(fornecedor_atualizado).data,
            message="Fornecedor atualizado com sucesso.",
        )

    def delete(self, request, pk):
        try:
            FornecedorService.deletar_fornecedor(request.user.empresa_id, pk)
            return no_content_response()
        except ResourceNotFound as exc:
            return error_response("NOT_FOUND", str(exc), status_code=404)


# ─── Avaliação ────────────────────────────────────────────────────────────────

class FornecedorAvaliacaoView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsEmpresaMember]

    def post(self, request, pk):
        serializer = AvaliacaoFornecedorSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response("VALIDATION_ERROR", "Dados inválidos.", details=serializer.errors)

        try:
            fornecedor = FornecedorService.avaliar_fornecedor(
                empresa_id=request.user.empresa_id,
                fornecedor_id=pk,
                qualidade=serializer.validated_data["avaliacao_qualidade"],
                prazo=serializer.validated_data["avaliacao_prazo"],
                preco=serializer.validated_data["avaliacao_preco"],
            )
            return success_response(
                data=FornecedorDetailSerializer(fornecedor).data,
                message="Avaliação registrada com sucesso.",
            )
        except ResourceNotFound as exc:
            return error_response("NOT_FOUND", str(exc), status_code=404)


# ─── Compras ─────────────────────────────────────────────────────────────────

class CompraFornecedorListCreateView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsEmpresaMember]

    def get(self, request, fornecedor_pk):
        empresa_id = request.user.empresa_id
        filtros = {
            "status": request.query_params.get("status"),
            "data_inicio": request.query_params.get("data_inicio"),
            "data_fim": request.query_params.get("data_fim"),
        }
        try:
            qs = FornecedorService.listar_compras(empresa_id, fornecedor_pk, filtros)
        except ResourceNotFound as exc:
            return error_response("NOT_FOUND", str(exc), status_code=404)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = CompraFornecedorSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request, fornecedor_pk):
        empresa_id = request.user.empresa_id
        serializer = CompraFornecedorCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response("VALIDATION_ERROR", "Dados inválidos.", details=serializer.errors)

        # Remove fornecedor do payload (vem da URL)
        dados = {k: v for k, v in serializer.validated_data.items() if k != "fornecedor"}

        try:
            compra = FornecedorService.registrar_compra(
                empresa_id=empresa_id,
                fornecedor_id=fornecedor_pk,
                usuario_id=request.user.id,
                dados=dados,
            )
            return created_response(
                data=CompraFornecedorSerializer(compra).data,
                message="Compra registrada com sucesso.",
            )
        except ResourceNotFound as exc:
            return error_response("NOT_FOUND", str(exc), status_code=404)


class CompraFornecedorDetailView(APIView):
    """
    GET    /api/fornecedores/{fornecedor_pk}/compras/{pk}/  — detalhe
    PATCH  /api/fornecedores/{fornecedor_pk}/compras/{pk}/  — editar
    DELETE /api/fornecedores/{fornecedor_pk}/compras/{pk}/  — excluir
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsEmpresaMember]

    def get(self, request, fornecedor_pk, pk):
        empresa_id = request.user.empresa_id
        try:
            compra = FornecedorService.obter_compra(empresa_id, pk)
        except ResourceNotFound as exc:
            return error_response("NOT_FOUND", str(exc), status_code=404)
        return success_response(data=CompraFornecedorSerializer(compra).data)

    def patch(self, request, fornecedor_pk, pk):
        empresa_id = request.user.empresa_id
        try:
            compra = FornecedorService.obter_compra(empresa_id, pk)
        except ResourceNotFound as exc:
            return error_response("NOT_FOUND", str(exc), status_code=404)

        serializer = CompraFornecedorCreateSerializer(
            compra, data=request.data, partial=True
        )
        if not serializer.is_valid():
            return error_response("VALIDATION_ERROR", "Dados inválidos.", details=serializer.errors)

        dados = {k: v for k, v in serializer.validated_data.items() if k != "fornecedor"}
        try:
            compra = FornecedorService.atualizar_compra(empresa_id, pk, dados)
            return success_response(
                data=CompraFornecedorSerializer(compra).data,
                message="Compra atualizada com sucesso.",
            )
        except ResourceNotFound as exc:
            return error_response("NOT_FOUND", str(exc), status_code=404)

    def delete(self, request, fornecedor_pk, pk):
        empresa_id = request.user.empresa_id
        try:
            FornecedorService.excluir_compra(empresa_id, pk)
            return no_content_response()
        except ResourceNotFound as exc:
            return error_response("NOT_FOUND", str(exc), status_code=404)
