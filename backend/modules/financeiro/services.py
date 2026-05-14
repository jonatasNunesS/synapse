"""
Synapse — Módulo Financeiro: Service
Toda lógica de negócio do módulo financeiro.
Regra: View → Service → Repository → Model.
"""
import logging
from datetime import date, timedelta
from decimal import Decimal

from shared.cache import build_cache_key, get_cached, invalidate_cache, set_cached

from .models import Categoria, Lancamento
from .repository import FinanceiroRepository

logger = logging.getLogger("synapse")

# TTLs de cache
TTL_RESUMO = 300        # 5 minutos
TTL_FLUXO = 300         # 5 minutos
TTL_DRE = 600           # 10 minutos
TTL_CATEGORIAS = 1800   # 30 minutos


class FinanceiroService:
    """Service do módulo financeiro."""

    # ── Categorias ───────────────────────────────────────────

    @staticmethod
    def listar_categorias(empresa_id):
        return FinanceiroRepository.listar_categorias(empresa_id)

    @staticmethod
    def criar_categoria(empresa_id, dados: dict) -> Categoria:
        categoria = FinanceiroRepository.criar_categoria(empresa_id, dados)
        invalidate_cache(empresa_id, "financeiro")
        logger.info(
            "Categoria criada",
            extra={"empresa_id": str(empresa_id), "categoria_id": str(categoria.id)},
        )
        return categoria

    @staticmethod
    def atualizar_categoria(empresa_id, categoria_id, dados: dict) -> Categoria:
        categoria = FinanceiroRepository.get_categoria(empresa_id, categoria_id)
        if not categoria:
            raise ValueError("Categoria não encontrada.")
        categoria = FinanceiroRepository.atualizar_categoria(categoria, dados)
        invalidate_cache(empresa_id, "financeiro")
        return categoria

    @staticmethod
    def deletar_categoria(empresa_id, categoria_id) -> Categoria:
        categoria = FinanceiroRepository.get_categoria(empresa_id, categoria_id)
        if not categoria:
            raise ValueError("Categoria não encontrada.")
        categoria = FinanceiroRepository.soft_delete_categoria(categoria)
        invalidate_cache(empresa_id, "financeiro")
        return categoria

    # ── Lançamentos ──────────────────────────────────────────

    @staticmethod
    def listar_lancamentos(empresa_id, filtros: dict = None):
        return FinanceiroRepository.listar_lancamentos(empresa_id, filtros)

    @staticmethod
    def get_lancamento(empresa_id, lancamento_id) -> Lancamento:
        lancamento = FinanceiroRepository.get_lancamento(empresa_id, lancamento_id)
        if not lancamento:
            raise ValueError("Lançamento não encontrado.")
        return lancamento

    @staticmethod
    def criar_lancamento(empresa_id, usuario_id, dados: dict) -> Lancamento:
        lancamento = FinanceiroRepository.criar_lancamento(empresa_id, usuario_id, dados)
        invalidate_cache(empresa_id, "financeiro")

        # Se recorrente, dispara task para criar cópias dos próximos 11 meses
        if lancamento.recorrente:
            from .tasks import criar_recorrencias
            criar_recorrencias.delay(str(lancamento.id))

        logger.info(
            "Lançamento criado",
            extra={
                "empresa_id": str(empresa_id),
                "lancamento_id": str(lancamento.id),
                "tipo": lancamento.tipo,
                "valor": str(lancamento.valor),
            },
        )
        return lancamento

    @staticmethod
    def atualizar_lancamento(empresa_id, lancamento_id, dados: dict) -> Lancamento:
        lancamento = FinanceiroRepository.get_lancamento(empresa_id, lancamento_id)
        if not lancamento:
            raise ValueError("Lançamento não encontrado.")
        lancamento = FinanceiroRepository.atualizar_lancamento(lancamento, dados)
        invalidate_cache(empresa_id, "financeiro")
        return lancamento

    @staticmethod
    def deletar_lancamento(empresa_id, lancamento_id) -> None:
        lancamento = FinanceiroRepository.get_lancamento(empresa_id, lancamento_id)
        if not lancamento:
            raise ValueError("Lançamento não encontrado.")
        FinanceiroRepository.deletar_lancamento(lancamento)
        invalidate_cache(empresa_id, "financeiro")

    @staticmethod
    def marcar_como_pago(
        empresa_id, lancamento_id, data_pagamento: date
    ) -> Lancamento:
        lancamento = FinanceiroRepository.get_lancamento(empresa_id, lancamento_id)
        if not lancamento:
            raise ValueError("Lançamento não encontrado.")
        if lancamento.status == "pago":
            raise ValueError("Este lançamento já está marcado como pago.")
        if lancamento.status == "cancelado":
            raise ValueError("Não é possível pagar um lançamento cancelado.")
        lancamento = FinanceiroRepository.marcar_como_pago(lancamento, data_pagamento)
        invalidate_cache(empresa_id, "financeiro")
        return lancamento

    # ── Relatórios com Cache ──────────────────────────────────

    @staticmethod
    def obter_resumo(empresa_id, mes: int, ano: int) -> dict:
        """Resumo financeiro com cache Redis (TTL 5 min)."""
        cache_key = build_cache_key(
            empresa_id, "financeiro", "resumo", {"mes": mes, "ano": ano}
        )
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        resumo = FinanceiroRepository.calcular_resumo(empresa_id, mes, ano)
        # Converter Decimal para float para serialização no cache
        resumo_serializable = {
            k: float(v) if isinstance(v, Decimal) else v
            for k, v in resumo.items()
        }
        set_cached(cache_key, resumo_serializable, TTL_RESUMO)
        return resumo

    @staticmethod
    def obter_fluxo_caixa(empresa_id, data_inicio: date, data_fim: date) -> list:
        """Fluxo de caixa com cache Redis (TTL 5 min)."""
        cache_key = build_cache_key(
            empresa_id,
            "financeiro",
            "fluxo",
            {"inicio": str(data_inicio), "fim": str(data_fim)},
        )
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        fluxo = FinanceiroRepository.fluxo_caixa(empresa_id, data_inicio, data_fim)
        # Serializar para cache
        fluxo_serializable = [
            {
                "data": str(d["data"]),
                "receitas": float(d["receitas"]),
                "despesas": float(d["despesas"]),
                "saldo": float(d["saldo"]),
            }
            for d in fluxo
        ]
        set_cached(cache_key, fluxo_serializable, TTL_FLUXO)
        return fluxo

    @staticmethod
    def obter_dre(empresa_id, mes: int, ano: int) -> dict:
        """DRE com cache Redis (TTL 10 min)."""
        cache_key = build_cache_key(
            empresa_id, "financeiro", "dre", {"mes": mes, "ano": ano}
        )
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        dre = FinanceiroRepository.dre(empresa_id, mes, ano)
        # Serializar para cache
        def serializar_cat(cat):
            return {
                "categoria_id": str(cat["categoria_id"]) if cat["categoria_id"] else None,
                "categoria": cat["categoria"],
                "cor": cat["cor"],
                "total": float(cat["total"]),
            }

        dre_serializable = {
            "receitas_por_categoria": [serializar_cat(c) for c in dre["receitas_por_categoria"]],
            "despesas_por_categoria": [serializar_cat(c) for c in dre["despesas_por_categoria"]],
            "total_receitas": float(dre["total_receitas"]),
            "total_despesas": float(dre["total_despesas"]),
            "lucro_bruto": float(dre["lucro_bruto"]),
            "margem": float(dre["margem"]),
        }
        set_cached(cache_key, dre_serializable, TTL_DRE)
        return dre

    @staticmethod
    def obter_vencimentos_proximos(empresa_id, dias: int = 7):
        return FinanceiroRepository.listar_vencimentos_proximos(empresa_id, dias)
