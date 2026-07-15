"""
Synapse — Módulo Financeiro: Service
Toda lógica de negócio do módulo financeiro.
Regra: View → Service → Repository → Model.
"""
import logging
from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction

from shared.cache import build_cache_key, get_cached, invalidate_cache, set_cached

from .models import Categoria, Lancamento, LogEdicaoLancamento
from .repository import FinanceiroRepository

logger = logging.getLogger("synapse")

# TTLs de cache
TTL_RESUMO = 300        # 5 minutos
TTL_FLUXO = 300         # 5 minutos
TTL_DRE = 600           # 10 minutos
TTL_CATEGORIAS = 1800   # 30 minutos
TTL_SALDO = 60          # 1 minuto — saldo muda a cada operação


def _f(v) -> float:
    """Decimal/None → float (JSON-safe para o cache)."""
    return float(v) if isinstance(v, Decimal) else (v or 0.0)


def _bucket_float(b: dict) -> dict:
    return {"total": _f(b["total"]), "count": b["count"]}


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

    # ── Auditoria de lançamentos pagos ────────────────────────
    #
    # DECISÃO DE PRODUTO: lançamentos pagos deixaram de ser imutáveis.
    # Admin da empresa pode editar/excluir COM motivo obrigatório; toda
    # operação gera LogEdicaoLancamento com snapshot antes/depois.
    # Ver docstring do model Lancamento.

    @staticmethod
    def _snapshot_lancamento(lancamento: Lancamento) -> dict:
        """Captura completa e JSON-safe do lançamento para o log de auditoria."""
        return {
            "id": str(lancamento.id),
            "tipo": lancamento.tipo,
            "descricao": lancamento.descricao,
            "valor": str(lancamento.valor),
            "categoria_id": str(lancamento.categoria_id) if lancamento.categoria_id else None,
            "categoria_nome": lancamento.categoria.nome if lancamento.categoria else None,
            "data_vencimento": str(lancamento.data_vencimento),
            "data_pagamento": str(lancamento.data_pagamento) if lancamento.data_pagamento else None,
            "status": lancamento.status,
            "recorrente": lancamento.recorrente,
            "recorrencia": lancamento.recorrencia,
            "observacoes": lancamento.observacoes,
        }

    @staticmethod
    def _invalidar_caches_saldo(empresa_id) -> None:
        """
        Invalida caches afetados por alteração em lançamento pago:
        - financeiro:* cobre saldo (todos os meses), resumo, fluxo, DRE
        - dashboard:* cobre KPIs derivados dos lançamentos
        Análises de IA já geradas são preservadas de propósito (histórico).
        """
        invalidate_cache(empresa_id, "financeiro")
        invalidate_cache(empresa_id, "dashboard")

    @staticmethod
    def _registrar_log(
        lancamento, empresa_id, usuario, acao: str, motivo: str,
        snapshot_antes: dict, snapshot_depois: dict = None,
    ) -> LogEdicaoLancamento:
        return LogEdicaoLancamento.objects.create(
            lancamento=lancamento if acao == "editado" else None,
            empresa_id=empresa_id,
            editado_por=usuario,
            acao=acao,
            motivo=motivo,
            snapshot_antes=snapshot_antes,
            snapshot_depois=snapshot_depois,
        )

    @staticmethod
    def atualizar_lancamento(
        empresa_id, lancamento_id, dados: dict, usuario=None, motivo: str = None
    ) -> Lancamento:
        lancamento = FinanceiroRepository.get_lancamento(empresa_id, lancamento_id)
        if not lancamento:
            raise ValueError("Lançamento não encontrado.")
        if lancamento.status == "cancelado":
            raise ValueError("Lançamentos cancelados são imutáveis e não podem ser editados.")

        if lancamento.status == "pago":
            # Edição controlada: permissão de admin é checada na view;
            # aqui garantimos motivo + auditoria mesmo se chamado de outro lugar.
            if not motivo:
                raise ValueError(
                    "Editar um lançamento pago exige um motivo (auditoria)."
                )
            snapshot_antes = FinanceiroService._snapshot_lancamento(lancamento)
            with transaction.atomic():
                lancamento = FinanceiroRepository.atualizar_lancamento(lancamento, dados)
                lancamento.refresh_from_db()
                FinanceiroService._registrar_log(
                    lancamento, empresa_id, usuario, "editado", motivo,
                    snapshot_antes,
                    FinanceiroService._snapshot_lancamento(lancamento),
                )
            FinanceiroService._invalidar_caches_saldo(empresa_id)
            logger.info(
                "Lançamento pago editado com auditoria",
                extra={
                    "empresa_id": str(empresa_id),
                    "lancamento_id": str(lancamento.id),
                    "usuario_id": str(usuario.id) if usuario else None,
                },
            )
            return lancamento

        # Pendente/atrasado: fluxo livre (regra atual mantida)
        lancamento = FinanceiroRepository.atualizar_lancamento(lancamento, dados)
        invalidate_cache(empresa_id, "financeiro")
        return lancamento

    @staticmethod
    def deletar_lancamento(empresa_id, lancamento_id) -> None:
        """Exclusão livre — apenas para lançamentos NÃO pagos."""
        lancamento = FinanceiroRepository.get_lancamento(empresa_id, lancamento_id)
        if not lancamento:
            raise ValueError("Lançamento não encontrado.")
        if lancamento.status == "pago":
            raise ValueError(
                "Excluir um lançamento pago exige motivo e perfil de administrador. "
                "Use a exclusão com auditoria."
            )
        FinanceiroRepository.deletar_lancamento(lancamento)
        invalidate_cache(empresa_id, "financeiro")

    @staticmethod
    def excluir_lancamento_auditado(
        empresa_id, lancamento_id, usuario, motivo: str
    ) -> None:
        """
        Exclusão com auditoria (POST {id}/excluir/): motivo obrigatório,
        log com snapshot completo. Para pagos, a view exige perfil admin.
        """
        lancamento = FinanceiroRepository.get_lancamento(empresa_id, lancamento_id)
        if not lancamento:
            raise ValueError("Lançamento não encontrado.")
        if not motivo:
            raise ValueError("A exclusão auditada exige um motivo.")

        era_pago = lancamento.status == "pago"
        snapshot_antes = FinanceiroService._snapshot_lancamento(lancamento)
        with transaction.atomic():
            FinanceiroRepository.deletar_lancamento(lancamento)
            FinanceiroService._registrar_log(
                None, empresa_id, usuario, "excluido", motivo, snapshot_antes, None
            )
        if era_pago:
            FinanceiroService._invalidar_caches_saldo(empresa_id)
        else:
            invalidate_cache(empresa_id, "financeiro")
        logger.info(
            "Lançamento excluído com auditoria",
            extra={
                "empresa_id": str(empresa_id),
                "lancamento_id": str(lancamento_id),
                "usuario_id": str(usuario.id) if usuario else None,
                "era_pago": era_pago,
            },
        )

    @staticmethod
    def historico_lancamento(empresa_id, lancamento_id):
        """
        Logs de auditoria de um lançamento, do mais recente ao mais antigo.
        Qualquer usuário da empresa pode consultar (transparência).
        """
        return LogEdicaoLancamento.objects.filter(
            empresa_id=empresa_id, lancamento_id=lancamento_id
        ).select_related("editado_por").order_by("-editado_em")

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
    def obter_saldo(empresa_id, mes: int, ano: int) -> dict:
        """
        Saldo acumulado (histórico, ignora o filtro) + saldo do mês + as 4
        métricas do período. Cache Redis TTL 60s por empresa+mês+ano; é
        invalidado por invalidate_cache(empresa, "financeiro") em qualquer
        criação/edição/exclusão/pagamento de lançamento.
        """
        cache_key = build_cache_key(
            empresa_id, "financeiro", "saldo", {"mes": mes, "ano": ano}
        )
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        dados = FinanceiroRepository.calcular_saldo(empresa_id, mes, ano)
        ac = dados["acumulado"]
        m = dados["mes_atual"]

        # Caixinhas: dinheiro guardado sai do saldo DISPONÍVEL, mas o
        # patrimônio total (= saldo acumulado) não muda. Sem caixinhas,
        # saldo_disponivel == acumulado.saldo (retrocompatível).
        # Import local: evita acoplamento de import entre módulos no boot.
        from modules.caixinhas.services import CaixinhaService
        caixinhas = CaixinhaService.obter_resumo(empresa_id)
        saldo_acumulado = _f(ac["saldo"])

        resultado = {
            "acumulado": {
                "total_recebido": _f(ac["total_recebido"]),
                "total_pago": _f(ac["total_pago"]),
                "saldo": saldo_acumulado,
            },
            "caixinhas": {
                "total": caixinhas["total"],
                "quantidade": caixinhas["quantidade"],
            },
            "saldo_disponivel": saldo_acumulado - caixinhas["total"],
            "patrimonio_total": saldo_acumulado,
            "mes_atual": {
                "mes": m["mes"],
                "ano": m["ano"],
                "recebido": _bucket_float(m["recebido"]),
                "a_receber": _bucket_float(m["a_receber"]),
                "pago": _bucket_float(m["pago"]),
                "a_pagar": _bucket_float(m["a_pagar"]),
                "saldo": _f(m["saldo"]),
            },
        }
        set_cached(cache_key, resultado, TTL_SALDO)
        return resultado

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

    @staticmethod
    def obter_metricas_analise(empresa_id, mes: int, ano: int) -> dict:
        """Métricas complementares para a Análise Financeira (IA)."""
        return FinanceiroRepository.metricas_para_analise(empresa_id, mes, ano)
