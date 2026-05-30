"""
M5 — Fornecedores: Services
Lógica de negócio com cache Redis.
"""
import logging
from decimal import Decimal

from shared.cache import build_cache_key, get_cached, set_cached, invalidate_cache
from shared.exceptions import BusinessRuleViolation, ResourceNotFound

from .models import Fornecedor
from .repository import FornecedorRepository

logger = logging.getLogger(__name__)


class FornecedorService:

    # ─── Categorias ──────────────────────────────────────────────────────────

    @staticmethod
    def listar_categorias(empresa_id: int):
        key = build_cache_key(empresa_id, "fornecedores", "categorias")
        cached = get_cached(key)
        if cached is not None:
            return cached
        categorias = FornecedorRepository.listar_categorias(empresa_id)
        set_cached(key, list(categorias))
        return categorias

    @staticmethod
    def obter_categoria(empresa_id: int, categoria_id):
        return FornecedorRepository.obter_categoria(empresa_id, categoria_id)

    @staticmethod
    def criar_categoria(empresa_id: int, dados: dict):
        categoria = FornecedorRepository.criar_categoria(empresa_id, dados)
        invalidate_cache(empresa_id, "fornecedores")
        return categoria

    @staticmethod
    def atualizar_categoria(empresa_id: int, categoria_id, dados: dict):
        categoria = FornecedorRepository.obter_categoria(empresa_id, categoria_id)
        categoria = FornecedorRepository.atualizar_categoria(categoria, dados)
        invalidate_cache(empresa_id, "fornecedores")
        return categoria

    @staticmethod
    def deletar_categoria(empresa_id: int, categoria_id):
        categoria = FornecedorRepository.obter_categoria(empresa_id, categoria_id)
        # Verifica se há fornecedores usando esta categoria
        if categoria.fornecedores.filter(ativo=True).exists():
            raise BusinessRuleViolation(
                code="BUSINESS_RULE",
                message="Não é possível excluir uma categoria com fornecedores ativos.",
            )
        FornecedorRepository.deletar_categoria(categoria)
        invalidate_cache(empresa_id, "fornecedores")

    # ─── Fornecedores ─────────────────────────────────────────────────────────

    @staticmethod
    def listar_fornecedores(empresa_id: int, filtros: dict = None):
        """
        Usa cache apenas quando não há filtros.
        """
        tem_filtros = bool(filtros and any(v for v in filtros.values() if v is not None))
        if not tem_filtros:
            key = build_cache_key(empresa_id, "fornecedores", "lista")
            cached = get_cached(key)
            if cached is not None:
                return cached

        qs = FornecedorRepository.listar_fornecedores(empresa_id, filtros)

        if not tem_filtros:
            result = list(qs)
            set_cached(key, result)
            return result

        return qs

    @staticmethod
    def obter_fornecedor(empresa_id: int, fornecedor_id):
        key = build_cache_key(empresa_id, "fornecedores", f"detalhe:{fornecedor_id}")
        cached = get_cached(key)
        if cached is not None:
            return cached
        fornecedor = FornecedorRepository.obter_fornecedor(empresa_id, fornecedor_id)
        set_cached(key, fornecedor, ttl=300)
        return fornecedor

    @staticmethod
    def criar_fornecedor(empresa_id: int, usuario_id, dados: dict) -> Fornecedor:
        fornecedor = FornecedorRepository.criar_fornecedor(empresa_id, usuario_id, dados)
        invalidate_cache(empresa_id, "fornecedores")
        return fornecedor

    @staticmethod
    def atualizar_fornecedor(empresa_id: int, fornecedor_id, dados: dict) -> Fornecedor:
        fornecedor = FornecedorRepository.obter_fornecedor(empresa_id, fornecedor_id)
        fornecedor = FornecedorRepository.atualizar_fornecedor(fornecedor, dados)
        invalidate_cache(empresa_id, "fornecedores")
        return fornecedor

    @staticmethod
    def deletar_fornecedor(empresa_id: int, fornecedor_id) -> None:
        fornecedor = FornecedorRepository.obter_fornecedor(empresa_id, fornecedor_id)
        FornecedorRepository.soft_delete_fornecedor(fornecedor)
        invalidate_cache(empresa_id, "fornecedores")

    # ─── Avaliação ────────────────────────────────────────────────────────────

    @staticmethod
    def avaliar_fornecedor(
        empresa_id: int,
        fornecedor_id,
        qualidade: int,
        prazo: int,
        preco: int,
    ) -> Fornecedor:
        """
        Atualiza as avaliações e recalcula o Score Synapse.
        Score = qualidade*0.40 + prazo*0.35 + preco*0.25 (escala 0-100)
        """
        fornecedor = FornecedorRepository.obter_fornecedor(empresa_id, fornecedor_id)

        fornecedor.avaliacao_qualidade = qualidade
        fornecedor.avaliacao_prazo = prazo
        fornecedor.avaliacao_preco = preco
        fornecedor.score_synapse = fornecedor.calcular_score()
        fornecedor.save(update_fields=[
            "avaliacao_qualidade", "avaliacao_prazo", "avaliacao_preco", "score_synapse"
        ])

        invalidate_cache(empresa_id, "fornecedores")
        logger.info(
            "Fornecedor %s avaliado. Score: %s",
            fornecedor_id,
            fornecedor.score_synapse,
        )
        return fornecedor

    # ─── Ranking ─────────────────────────────────────────────────────────────

    @staticmethod
    def obter_ranking(empresa_id: int) -> list:
        key = build_cache_key(empresa_id, "fornecedores", "ranking")
        cached = get_cached(key)
        if cached is not None:
            return cached
        ranking = FornecedorRepository.obter_ranking(empresa_id)
        set_cached(key, ranking, ttl=300)
        return ranking

    # ─── Resumo ───────────────────────────────────────────────────────────────

    @staticmethod
    def calcular_resumo(empresa_id: int) -> dict:
        key = build_cache_key(empresa_id, "fornecedores", "resumo")
        cached = get_cached(key)
        if cached is not None:
            return cached
        resumo = FornecedorRepository.calcular_resumo(empresa_id)
        set_cached(key, resumo, ttl=300)
        return resumo

    # ─── Compras ─────────────────────────────────────────────────────────────

    @staticmethod
    def listar_compras(empresa_id: int, fornecedor_id, filtros: dict = None):
        # Valida que fornecedor pertence à empresa
        FornecedorRepository.obter_fornecedor(empresa_id, fornecedor_id)
        return FornecedorRepository.listar_compras(empresa_id, fornecedor_id, filtros)

    @staticmethod
    def registrar_compra(empresa_id: int, fornecedor_id, usuario_id, dados: dict):
        # Valida que fornecedor pertence à empresa
        FornecedorRepository.obter_fornecedor(empresa_id, fornecedor_id)
        compra = FornecedorRepository.criar_compra(fornecedor_id, empresa_id, dados, usuario_id)
        invalidate_cache(empresa_id, "fornecedores")
        return compra

    @staticmethod
    def obter_compra(empresa_id: int, compra_id):
        return FornecedorRepository.obter_compra(empresa_id, compra_id)

    @staticmethod
    def atualizar_compra(empresa_id: int, compra_id, dados: dict):
        compra = FornecedorRepository.atualizar_compra(empresa_id, compra_id, dados)
        invalidate_cache(empresa_id, "fornecedores")
        return compra

    @staticmethod
    def excluir_compra(empresa_id: int, compra_id):
        FornecedorRepository.excluir_compra(empresa_id, compra_id)
        invalidate_cache(empresa_id, "fornecedores")
