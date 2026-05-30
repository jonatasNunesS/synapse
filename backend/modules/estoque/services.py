import logging

from shared.cache import build_cache_key, get_cached, set_cached, invalidate_cache
from shared.exceptions import (
    ResourceNotFound as SynapseNotFoundError,
    BusinessRuleViolation as SynapseValidationError,
)
from .repository import EstoqueRepository

logger = logging.getLogger(__name__)

# TTLs de cache
TTL_RESUMO = 5 * 60       # 5 minutos
TTL_ALERTAS = 2 * 60      # 2 minutos
TTL_LISTA = 2 * 60        # 2 minutos
TTL_PRODUTO = 5 * 60      # 5 minutos por produto
TTL_RELATORIO = 10 * 60   # 10 minutos


class EstoqueService:
    """Service do módulo de Estoque. Toda lógica de negócio fica aqui."""

    # ─── Categorias ───────────────────────────────────────────────────────────

    @staticmethod
    def listar_categorias(empresa_id):
        return EstoqueRepository.listar_categorias(empresa_id)

    @staticmethod
    def obter_categoria(empresa_id, categoria_id):
        return EstoqueRepository.obter_categoria(empresa_id, categoria_id)

    @staticmethod
    def criar_categoria(empresa_id, dados):
        categoria = EstoqueRepository.criar_categoria(empresa_id, dados)
        invalidate_cache(empresa_id, "estoque")
        return categoria

    @staticmethod
    def atualizar_categoria(empresa_id, categoria_id, dados):
        categoria = EstoqueRepository.obter_categoria(empresa_id, categoria_id)
        categoria = EstoqueRepository.atualizar_categoria(categoria, dados)
        invalidate_cache(empresa_id, "estoque")
        return categoria

    @staticmethod
    def deletar_categoria(empresa_id, categoria_id):
        categoria = EstoqueRepository.obter_categoria(empresa_id, categoria_id)
        EstoqueRepository.deletar_categoria(categoria)
        invalidate_cache(empresa_id, "estoque")

    # ─── Produtos ─────────────────────────────────────────────────────────────

    @staticmethod
    def listar_produtos(empresa_id, filtros=None):
        return EstoqueRepository.listar_produtos(empresa_id, filtros)

    @staticmethod
    def obter_produto(empresa_id, produto_id):
        cache_key = build_cache_key(empresa_id, "estoque", f"produto_{produto_id}")
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        produto = EstoqueRepository.obter_produto(empresa_id, produto_id)
        # Não cachear objetos Django ORM diretamente — retornar direto
        return produto

    @staticmethod
    def criar_produto(empresa_id, usuario_id, dados):
        produto = EstoqueRepository.criar_produto(empresa_id, usuario_id, dados)
        invalidate_cache(empresa_id, "estoque")
        logger.info(f"Produto criado: {produto.id} | empresa: {empresa_id}")
        return produto

    @staticmethod
    def atualizar_produto(empresa_id, produto_id, dados):
        produto = EstoqueRepository.obter_produto(empresa_id, produto_id)
        produto = EstoqueRepository.atualizar_produto(produto, dados)
        invalidate_cache(empresa_id, "estoque")
        return produto

    @staticmethod
    def deletar_produto(empresa_id, produto_id):
        produto = EstoqueRepository.obter_produto(empresa_id, produto_id)
        EstoqueRepository.soft_delete_produto(produto)
        invalidate_cache(empresa_id, "estoque")

    # ─── Movimentações ────────────────────────────────────────────────────────

    @staticmethod
    def listar_movimentacoes(empresa_id, produto_id=None, filtros=None):
        return EstoqueRepository.listar_movimentacoes(empresa_id, produto_id, filtros)

    @staticmethod
    def registrar_movimentacao(empresa_id, usuario_id, dados):
        """
        Registra movimentação, atualiza estoque e dispara alertas se necessário.
        """
        movimentacao, produto = EstoqueRepository.criar_movimentacao(
            empresa_id, dados, usuario_id
        )

        # Invalidar todos os caches do módulo estoque para esta empresa
        invalidate_cache(empresa_id, "estoque")

        # Disparar alerta se estoque ficou crítico
        if produto.esta_abaixo_minimo or produto.esta_sem_estoque:
            try:
                from .tasks import alertar_estoque_critico
                alertar_estoque_critico.delay(str(produto.id))
                logger.info(
                    f"Alerta de estoque crítico disparado: produto {produto.id}"
                )
            except Exception as e:
                logger.warning(f"Falha ao disparar alerta de estoque: {e}")

        return movimentacao, produto

    # ─── Resumo e Alertas ─────────────────────────────────────────────────────

    @staticmethod
    def obter_resumo(empresa_id):
        cache_key = build_cache_key(empresa_id, "estoque", "resumo")
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        resumo = EstoqueRepository.calcular_relatorio(empresa_id)
        set_cached(cache_key, resumo, TTL_RESUMO)
        return resumo

    @staticmethod
    def listar_alertas(empresa_id):
        return EstoqueRepository.listar_alertas(empresa_id)

    @staticmethod
    def obter_relatorio(empresa_id):
        cache_key = build_cache_key(empresa_id, "estoque", "relatorio")
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        relatorio = EstoqueRepository.calcular_relatorio(empresa_id)
        set_cached(cache_key, relatorio, TTL_RELATORIO)
        return relatorio

    @staticmethod
    def obter_historico_produto(empresa_id, produto_id):
        return EstoqueRepository.historico_produto(empresa_id, produto_id)

    @staticmethod
    def estornar_movimentacao(empresa_id, movimentacao_id, usuario_id, motivo_estorno=""):
        """
        Cria uma movimentação de estorno (inversa) para a movimentação original.
        A movimentação original permanece imutável (regra de negócio).
        """
        from .models import Movimentacao
        try:
            original = Movimentacao.objects.get(pk=movimentacao_id, empresa_id=empresa_id)
        except Movimentacao.DoesNotExist:
            from shared.exceptions import ResourceNotFound
            raise ResourceNotFound("Movimentação", str(movimentacao_id))

        # Tipo inverso: saida → entrada, entrada → saida, ajuste → ajuste
        tipo_inverso = {
            "saida": "entrada",
            "entrada": "saida",
            "ajuste": "ajuste",
            "transferencia": "transferencia",
        }.get(original.tipo, "ajuste")

        dados_estorno = {
            "produto": original.produto,
            "variacao": original.variacao,
            "tipo": tipo_inverso,
            "quantidade": original.quantidade,
            "motivo": "devolucao",
            "referencia": f"Estorno de {original.id}",
            "observacoes": motivo_estorno or f"Estorno automático da movimentação {original.id}",
        }

        movimentacao_estorno, produto = EstoqueRepository.criar_movimentacao(
            empresa_id, dados_estorno, usuario_id
        )
        invalidate_cache(empresa_id, "estoque")
        return movimentacao_estorno, produto
