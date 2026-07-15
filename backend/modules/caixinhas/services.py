"""
Synapse — Caixinhas: Service (lógica de negócio).

Toda operação que muda saldo invalida também o cache do módulo financeiro:
o GET /api/financeiro/saldo/ embute o total em caixinhas no cálculo do
saldo disponível.
"""
import logging
from decimal import Decimal

from shared.cache import build_cache_key, get_cached, invalidate_cache, set_cached
from shared.exceptions import BusinessRuleViolation, ResourceNotFound

from .models import Caixinha, MovimentoCaixinha
from .repository import CaixinhaRepository

logger = logging.getLogger("synapse")

TTL_RESUMO = 60  # 1 minuto — saldo de caixinha muda a cada operação


class CaixinhaService:
    """Service do módulo de caixinhas."""

    @staticmethod
    def _invalidar(empresa_id) -> None:
        """Caixinhas mudam o saldo disponível → invalida financeiro também."""
        invalidate_cache(empresa_id, "caixinhas")
        invalidate_cache(empresa_id, "financeiro")

    # ── CRUD ─────────────────────────────────────────────────

    @staticmethod
    def listar(empresa_id):
        return CaixinhaRepository.listar(empresa_id)

    @staticmethod
    def obter(empresa_id, caixinha_id) -> Caixinha:
        caixinha = CaixinhaRepository.obter_por_id(empresa_id, caixinha_id)
        if not caixinha:
            raise ResourceNotFound("Caixinha", str(caixinha_id))
        return caixinha

    @staticmethod
    def criar(empresa_id, usuario_id, dados: dict) -> Caixinha:
        caixinha = CaixinhaRepository.criar(empresa_id, usuario_id, dados)
        CaixinhaService._invalidar(empresa_id)
        logger.info(
            "Caixinha criada",
            extra={"empresa_id": str(empresa_id), "caixinha_id": str(caixinha.id)},
        )
        return caixinha

    @staticmethod
    def atualizar(empresa_id, caixinha_id, dados: dict) -> Caixinha:
        caixinha = CaixinhaService.obter(empresa_id, caixinha_id)
        # saldo nunca é editado diretamente — só via depósito/retirada
        dados.pop("saldo", None)
        caixinha = CaixinhaRepository.atualizar(caixinha, dados)
        CaixinhaService._invalidar(empresa_id)
        return caixinha

    @staticmethod
    def deletar(empresa_id, caixinha_id) -> None:
        caixinha = CaixinhaService.obter(empresa_id, caixinha_id)
        if caixinha.saldo > 0:
            # Dinheiro não some magicamente: retire tudo antes de excluir.
            raise BusinessRuleViolation(
                code="CAIXINHA_COM_SALDO",
                message=(
                    f"Esta caixinha ainda tem R$ {caixinha.saldo:.2f}. "
                    "Retire o saldo antes de excluir."
                ),
                details={"saldo_atual": str(caixinha.saldo)},
            )
        CaixinhaRepository.deletar(caixinha)
        CaixinhaService._invalidar(empresa_id)

    # ── Operações de saldo ───────────────────────────────────

    @staticmethod
    def depositar(
        empresa_id, caixinha_id, valor: Decimal, descricao: str, usuario_id
    ) -> MovimentoCaixinha:
        """Transfere do saldo disponível para a caixinha (interno, sem lançamento)."""
        movimento = CaixinhaRepository.movimentar(
            empresa_id, caixinha_id, "deposito", valor, descricao, usuario_id
        )
        CaixinhaService._invalidar(empresa_id)
        return movimento

    @staticmethod
    def retirar(
        empresa_id, caixinha_id, valor: Decimal, descricao: str, usuario_id
    ) -> MovimentoCaixinha:
        """Transfere da caixinha de volta ao saldo disponível."""
        movimento = CaixinhaRepository.movimentar(
            empresa_id, caixinha_id, "retirada", valor, descricao, usuario_id
        )
        CaixinhaService._invalidar(empresa_id)
        return movimento

    @staticmethod
    def listar_movimentos(empresa_id, caixinha_id):
        # Garante multi-tenant/existência antes de listar
        CaixinhaService.obter(empresa_id, caixinha_id)
        return CaixinhaRepository.listar_movimentos(empresa_id, caixinha_id)

    # ── Resumo (cacheado) ────────────────────────────────────

    @staticmethod
    def obter_resumo(empresa_id) -> dict:
        """Total em caixinhas + quantidade. Cache TTL 60s."""
        cache_key = build_cache_key(empresa_id, "caixinhas", "resumo")
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        resumo = CaixinhaRepository.calcular_resumo(empresa_id)
        resultado = {
            "total": float(resumo["total"]),
            "quantidade": resumo["quantidade"],
        }
        set_cached(cache_key, resultado, TTL_RESUMO)
        return resultado
