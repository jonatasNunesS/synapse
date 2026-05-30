"""
Synapse - Módulo de Busca Global
GET /api/search/?q=termo
Busca em paralelo em Clientes, Produtos, Fornecedores, Projetos e Lançamentos.
Limita 3 resultados por categoria. Cache TTL 30s por empresa+query.
"""
import logging

from django.core.cache import cache
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from shared.authentication import CookieJWTAuthentication
from shared.permissions import IsEmpresaMember
from shared.responses import error_response, success_response

logger = logging.getLogger("synapse")


class BuscaGlobalView(APIView):
    """
    GET /api/search/?q=termo
    Busca em Clientes, Produtos, Fornecedores, Projetos e Lançamentos.
    Máximo 3 resultados por categoria. Cache TTL 30s por empresa+query.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    MAX_POR_CATEGORIA = 3
    CACHE_TTL = 30  # segundos

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if not q or len(q) < 2:
            return error_response(
                code="QUERY_TOO_SHORT",
                message="O termo de busca deve ter pelo menos 2 caracteres.",
                status_code=400,
            )

        empresa_id = request.user.empresa_id
        cache_key = f"synapse:{empresa_id}:search:{q.lower()}"

        cached = cache.get(cache_key)
        if cached:
            return success_response(data=cached)

        resultados = self._buscar(empresa_id, q)

        cache.set(cache_key, resultados, self.CACHE_TTL)
        return success_response(data=resultados)

    def _buscar(self, empresa_id: int, q: str) -> dict:
        """Executa as 5 buscas e retorna dict com resultados agrupados."""
        from modules.clientes.models import Cliente
        from modules.estoque.models import Produto
        from modules.fornecedores.models import Fornecedor
        from modules.projetos.models import Projeto
        from modules.financeiro.models import Lancamento

        n = self.MAX_POR_CATEGORIA

        # ── Clientes ─────────────────────────────────────────────
        clientes = (
            Cliente.objects.filter(empresa_id=empresa_id)
            .filter(
                __import__("django.db.models", fromlist=["Q"]).Q(nome__icontains=q)
                | __import__("django.db.models", fromlist=["Q"]).Q(email__icontains=q)
                | __import__("django.db.models", fromlist=["Q"]).Q(telefone__icontains=q)
            )
            .values("id", "nome", "tipo")[:n]
        )

        # ── Produtos ──────────────────────────────────────────────
        from django.db.models import Q
        produtos = (
            Produto.objects.filter(empresa_id=empresa_id)
            .filter(
                Q(nome__icontains=q)
                | Q(sku__icontains=q)
                | Q(codigo_barras__icontains=q)
            )
            .values("id", "nome", "sku")[:n]
        )

        # ── Fornecedores ──────────────────────────────────────────
        fornecedores = (
            Fornecedor.objects.filter(empresa_id=empresa_id)
            .filter(Q(nome__icontains=q) | Q(cnpj__icontains=q))
            .values("id", "nome")[:n]
        )

        # ── Projetos ──────────────────────────────────────────────
        projetos = (
            Projeto.objects.filter(empresa_id=empresa_id)
            .filter(Q(nome__icontains=q))
            .values("id", "nome")[:n]
        )

        # ── Lançamentos ───────────────────────────────────────────
        lancamentos = (
            Lancamento.objects.filter(empresa_id=empresa_id)
            .filter(Q(descricao__icontains=q))
            .values("id", "descricao", "valor")[:n]
        )

        return {
            "clientes": list(clientes),
            "produtos": list(produtos),
            "fornecedores": list(fornecedores),
            "projetos": list(projetos),
            "lancamentos": [
                {
                    "id": str(l["id"]),
                    "descricao": l["descricao"],
                    "valor": str(l["valor"]),
                }
                for l in lancamentos
            ],
        }
