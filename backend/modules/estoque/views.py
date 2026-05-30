import logging
import os

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from shared.authentication import CookieJWTAuthentication
from shared.pagination import StandardPagination as SynapsePagination
from shared.permissions import IsEmpresaMember as IsAuthenticatedEmpresa
from shared.responses import success_response, error_response, created_response
from shared.exceptions import (
    ResourceNotFound as SynapseNotFoundError,
    BusinessRuleViolation as SynapseValidationError,
)

from .serializers import (
    CategoriaEstoqueSerializer,
    MovimentacaoCreateSerializer,
    MovimentacaoSerializer,
    ProdutoCreateUpdateSerializer,
    ProdutoDetailSerializer,
    ProdutoListSerializer,
    RelatorioEstoqueSerializer,
)
from .services import EstoqueService

logger = logging.getLogger(__name__)


class CategoriaEstoqueViewSet(ViewSet):
    """CRUD de categorias de estoque."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticatedEmpresa]

    def list(self, request):
        empresa_id = request.user.empresa_id
        categorias = EstoqueService.listar_categorias(empresa_id)
        serializer = CategoriaEstoqueSerializer(categorias, many=True)
        return success_response(data=serializer.data)

    def create(self, request):
        empresa_id = request.user.empresa_id
        serializer = CategoriaEstoqueSerializer(
            data=request.data, context={"request": request}
        )
        if not serializer.is_valid():
            return error_response(
                "VALIDATION_ERROR", "Dados inválidos.", serializer.errors
            )
        categoria = EstoqueService.criar_categoria(empresa_id, serializer.validated_data)
        return created_response(
            data=CategoriaEstoqueSerializer(categoria).data,
            message="Categoria criada com sucesso.",
        )

    def retrieve(self, request, pk=None):
        empresa_id = request.user.empresa_id
        try:
            categoria = EstoqueService.obter_categoria(empresa_id, pk)
        except SynapseNotFoundError as e:
            return error_response("NOT_FOUND", str(e), status_code=status.HTTP_404_NOT_FOUND)
        return success_response(data=CategoriaEstoqueSerializer(categoria).data)

    def update(self, request, pk=None):
        return self._atualizar(request, pk, partial=False)

    def partial_update(self, request, pk=None):
        return self._atualizar(request, pk, partial=True)

    def _atualizar(self, request, pk, partial):
        empresa_id = request.user.empresa_id
        try:
            categoria = EstoqueService.obter_categoria(empresa_id, pk)
        except SynapseNotFoundError as e:
            return error_response("NOT_FOUND", str(e), status_code=status.HTTP_404_NOT_FOUND)

        serializer = CategoriaEstoqueSerializer(
            categoria, data=request.data, partial=partial, context={"request": request}
        )
        if not serializer.is_valid():
            return error_response(
                "VALIDATION_ERROR", "Dados inválidos.", serializer.errors
            )
        categoria = EstoqueService.atualizar_categoria(
            empresa_id, pk, serializer.validated_data
        )
        return success_response(data=CategoriaEstoqueSerializer(categoria).data)

    def destroy(self, request, pk=None):
        empresa_id = request.user.empresa_id
        try:
            EstoqueService.deletar_categoria(empresa_id, pk)
        except SynapseNotFoundError as e:
            return error_response("NOT_FOUND", str(e), status_code=status.HTTP_404_NOT_FOUND)
        return success_response(message="Categoria desativada.")


class ProdutoViewSet(ViewSet):
    """CRUD de produtos com filtros e ações de movimentação."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticatedEmpresa]

    def list(self, request):
        empresa_id = request.user.empresa_id
        filtros = {
            "categoria_id": request.query_params.get("categoria_id"),
            "busca": request.query_params.get("busca"),
            "ativo": request.query_params.get("ativo", "true"),
        }

        qs = EstoqueService.listar_produtos(empresa_id, filtros)

        # Filtro por status_estoque (feito em Python pois é property)
        status_estoque_filter = request.query_params.get("status_estoque")
        if status_estoque_filter:
            qs = [p for p in qs if p.status_estoque == status_estoque_filter]

        paginator = SynapsePagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = ProdutoListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def create(self, request):
        empresa_id = request.user.empresa_id
        serializer = ProdutoCreateUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "VALIDATION_ERROR", "Dados inválidos.", serializer.errors
            )
        produto = EstoqueService.criar_produto(
            empresa_id, request.user.id, serializer.validated_data
        )
        return created_response(
            data=ProdutoDetailSerializer(produto).data,
            message="Produto criado com sucesso.",
        )

    def retrieve(self, request, pk=None):
        empresa_id = request.user.empresa_id
        try:
            produto = EstoqueService.obter_produto(empresa_id, pk)
        except SynapseNotFoundError as e:
            return error_response("NOT_FOUND", str(e), status_code=status.HTTP_404_NOT_FOUND)
        return success_response(data=ProdutoDetailSerializer(produto).data)

    def update(self, request, pk=None):
        return self._atualizar(request, pk, partial=False)

    def partial_update(self, request, pk=None):
        return self._atualizar(request, pk, partial=True)

    def _atualizar(self, request, pk, partial):
        empresa_id = request.user.empresa_id
        try:
            produto = EstoqueService.obter_produto(empresa_id, pk)
        except SynapseNotFoundError as e:
            return error_response("NOT_FOUND", str(e), status_code=status.HTTP_404_NOT_FOUND)

        serializer = ProdutoCreateUpdateSerializer(
            produto, data=request.data, partial=partial
        )
        if not serializer.is_valid():
            return error_response(
                "VALIDATION_ERROR", "Dados inválidos.", serializer.errors
            )
        produto = EstoqueService.atualizar_produto(
            empresa_id, pk, serializer.validated_data
        )
        return success_response(data=ProdutoDetailSerializer(produto).data)

    def destroy(self, request, pk=None):
        empresa_id = request.user.empresa_id
        try:
            EstoqueService.deletar_produto(empresa_id, pk)
        except SynapseNotFoundError as e:
            return error_response("NOT_FOUND", str(e), status_code=status.HTTP_404_NOT_FOUND)
        return success_response(message="Produto desativado com sucesso.")

    @action(detail=True, methods=["post"], url_path="upload-imagem")
    def upload_imagem(self, request, pk=None):
        """POST /api/estoque/produtos/{id}/upload-imagem/ — faz upload da imagem do produto."""
        empresa_id = request.user.empresa_id
        try:
            produto = EstoqueService.obter_produto(empresa_id, pk)
        except SynapseNotFoundError as e:
            return error_response("NOT_FOUND", str(e), status_code=status.HTTP_404_NOT_FOUND)

        arquivo = request.FILES.get("imagem")
        if not arquivo:
            return error_response("VALIDATION_ERROR", "Nenhum arquivo enviado.", status_code=400)

        # Valida tipo MIME
        tipos_permitidos = ["image/jpeg", "image/png", "image/webp", "image/gif"]
        if arquivo.content_type not in tipos_permitidos:
            return error_response(
                "VALIDATION_ERROR",
                "Formato inválido. Use JPEG, PNG, WebP ou GIF.",
                status_code=400,
            )

        # Valida tamanho (5 MB)
        if arquivo.size > 5 * 1024 * 1024:
            return error_response(
                "VALIDATION_ERROR",
                "Arquivo muito grande. Máximo 5 MB.",
                status_code=400,
            )

        # Remove imagem anterior se existir no storage local
        if produto.imagem_url and produto.imagem_url.startswith("/media/"):
            caminho_antigo = produto.imagem_url.replace("/media/", "", 1)
            if default_storage.exists(caminho_antigo):
                default_storage.delete(caminho_antigo)

        ext = os.path.splitext(arquivo.name)[1].lower() or ".jpg"
        caminho = f"estoque/produtos/{empresa_id}/{pk}{ext}"
        default_storage.save(caminho, ContentFile(arquivo.read()))

        produto.imagem_url = f"/media/{caminho}"
        produto.save(update_fields=["imagem_url", "atualizado_em"])

        return success_response(
            data={"imagem_url": produto.imagem_url},
            message="Imagem enviada com sucesso.",
        )

    @action(detail=True, methods=["get"], url_path="movimentacoes")
    def movimentacoes(self, request, pk=None):
        """Histórico paginado de movimentações do produto."""
        empresa_id = request.user.empresa_id
        try:
            EstoqueService.obter_produto(empresa_id, pk)
        except SynapseNotFoundError as e:
            return error_response("NOT_FOUND", str(e), status_code=status.HTTP_404_NOT_FOUND)

        filtros = {
            "tipo": request.query_params.get("tipo"),
            "motivo": request.query_params.get("motivo"),
            "data_inicio": request.query_params.get("data_inicio"),
            "data_fim": request.query_params.get("data_fim"),
        }
        qs = EstoqueService.listar_movimentacoes(empresa_id, pk, filtros)
        paginator = SynapsePagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = MovimentacaoSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class MovimentacaoViewSet(ViewSet):
    """Criação de movimentações de estoque."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticatedEmpresa]

    def create(self, request):
        empresa_id = request.user.empresa_id
        serializer = MovimentacaoCreateSerializer(
            data=request.data, context={"request": request}
        )
        if not serializer.is_valid():
            return error_response(
                "VALIDATION_ERROR", "Dados inválidos.", serializer.errors
            )

        try:
            movimentacao, produto = EstoqueService.registrar_movimentacao(
                empresa_id, request.user.id, serializer.validated_data
            )
        except SynapseValidationError as e:
            return error_response("VALIDATION_ERROR", str(e))
        except Exception as e:
            logger.error(f"Erro ao registrar movimentação: {e}")
            return error_response(
                "SERVER_ERROR",
                "Erro ao registrar movimentação.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return created_response(
            data={
                "movimentacao": MovimentacaoSerializer(movimentacao).data,
                "produto": ProdutoDetailSerializer(produto).data,
            },
            message="Movimentação registrada com sucesso.",
        )

    def update(self, request, pk=None):
        return error_response(
            "METHOD_NOT_ALLOWED",
            "Movimentações são imutáveis.",
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def partial_update(self, request, pk=None):
        return self.update(request, pk)

    def destroy(self, request, pk=None):
        return error_response(
            "METHOD_NOT_ALLOWED",
            "Movimentações não podem ser excluídas.",
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


class EstornarMovimentacaoView(APIView):
    """
    POST /api/estoque/movimentacoes/{id}/estornar/
    Cria uma movimentação inversa (estorno) respeitando a imutabilidade.
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticatedEmpresa]

    def post(self, request, pk):
        empresa_id = request.user.empresa_id
        motivo = request.data.get("motivo", "")
        try:
            estorno, produto = EstoqueService.estornar_movimentacao(
                empresa_id, pk, request.user.id, motivo
            )
        except Exception as e:
            return error_response(
                "NOT_FOUND",
                str(e),
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return created_response(
            data={
                "estorno": MovimentacaoSerializer(estorno).data,
                "produto": ProdutoDetailSerializer(produto).data,
            },
            message="Estorno registrado com sucesso.",
        )


class EstoqueResumoView(ViewSet):
    """Views de resumo, alertas e relatório do estoque."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticatedEmpresa]

    @action(detail=False, methods=["get"], url_path="resumo")
    def resumo(self, request):
        empresa_id = request.user.empresa_id
        resumo = EstoqueService.obter_resumo(empresa_id)
        return success_response(data=resumo)

    @action(detail=False, methods=["get"], url_path="alertas")
    def alertas(self, request):
        empresa_id = request.user.empresa_id
        alertas_qs = EstoqueService.listar_alertas(empresa_id)
        serializer = ProdutoListSerializer(alertas_qs, many=True)
        return success_response(data=serializer.data)

    @action(detail=False, methods=["get"], url_path="relatorio")
    def relatorio(self, request):
        empresa_id = request.user.empresa_id
        relatorio = EstoqueService.obter_relatorio(empresa_id)
        serializer = RelatorioEstoqueSerializer(relatorio)
        return success_response(data=serializer.data)
