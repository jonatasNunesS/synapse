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
from modules.estoque.services import EstoqueService

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


class CompraAdicionarAoEstoqueView(APIView):
    """POST /api/fornecedores/<fornecedor_pk>/compras/<compra_pk>/adicionar-ao-estoque/"""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsEmpresaMember]

    def post(self, request, fornecedor_pk, compra_pk):
        empresa_id = request.user.empresa_id

        try:
            compra = FornecedorService.obter_compra(empresa_id, fornecedor_pk, compra_pk)
        except ResourceNotFound as exc:
            return error_response("NOT_FOUND", str(exc), status_code=404)

        produto_id = request.data.get("produto_id")
        quantidade = request.data.get("quantidade")
        criar_produto = request.data.get("criar_produto", False)
        dados_produto = request.data.get("dados_produto", {})

        if not quantidade:
            return error_response("VALIDATION_ERROR", "O campo 'quantidade' é obrigatório.")

        try:
            quantidade = float(quantidade)
            if quantidade <= 0:
                raise ValueError()
        except (ValueError, TypeError):
            return error_response("VALIDATION_ERROR", "Quantidade deve ser um número positivo.")

        try:
            if criar_produto:
                if not dados_produto.get("nome"):
                    return error_response("VALIDATION_ERROR", "Nome do produto é obrigatório.")
                produto = EstoqueService.criar_produto(
                    empresa_id,
                    request.user.id,
                    {
                        "nome": dados_produto["nome"],
                        "preco_custo": dados_produto.get("preco_custo", compra.valor),
                        "preco_venda": dados_produto.get("preco_venda", 0),
                        "estoque_atual": 0,
                        "estoque_minimo": dados_produto.get("estoque_minimo", 0),
                        "unidade": dados_produto.get("unidade", "unidade"),
                    }
                )
                produto_id = str(produto.id)
            elif not produto_id:
                return error_response("VALIDATION_ERROR", "Informe 'produto_id' ou defina 'criar_produto' como true.")

            movimentacao, produto = EstoqueService.registrar_movimentacao(
                empresa_id,
                request.user.id,
                {
                    "produto": produto_id,
                    "tipo": "entrada",
                    "quantidade": quantidade,
                    "motivo": "compra",
                    "referencia": f"Compra #{str(compra_pk)[:8]} — {compra.descricao}",
                    "observacoes": f"Entrada automática vinculada à compra de {compra.fornecedor.nome}",
                }
            )

            return created_response(
                data={
                    "movimentacao_id": str(movimentacao.id),
                    "produto_id": str(produto.id),
                    "produto_nome": produto.nome,
                    "quantidade": float(movimentacao.quantidade),
                    "estoque_atual": float(produto.estoque_atual),
                },
                message="Entrada no estoque registrada com sucesso.",
            )
        except ResourceNotFound as exc:
            return error_response("NOT_FOUND", str(exc), status_code=404)
        except BusinessRuleViolation as exc:
            return error_response("BUSINESS_ERROR", str(exc))
        except Exception as exc:
            logger.error(f"Erro ao adicionar compra ao estoque: {exc}")
            return error_response("SERVER_ERROR", "Erro interno ao registrar entrada.", status_code=500)
