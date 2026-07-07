"""
Synapse — AI Hub: Sistema unificado de créditos de IA.

UM controle para TODAS as operações de IA (geração de conteúdo, análises,
futuro chat). Créditos são DIÁRIOS e renovam à 00:00 no fuso do projeto
(America/Sao_Paulo); não acumulam.

Padrão reserva → confirma/devolve:
  - reservar(): cobra o custo no início (contador Redis). Rejeita na porta
    (SemCreditosError) se não houver saldo — ANTES de chamar a Groq.
  - confirmar(): no-op de sucesso (o crédito já foi cobrado na reserva).
  - devolver(): estorna o custo se a operação de IA falhar (sem sucesso,
    sem cobrança).

Contador robusto: chave Redis com a DATA explícita
(ai:uso:{empresa_id}:YYYY-MM-DD), TTL de 48h. O reset é lógico — pela data
na chave, não por task. Multi-tenant: empresa_id sempre presente.
"""
import logging
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.core.cache import cache

from shared.exceptions import SynapseException

logger = logging.getLogger("synapse")

TZ = ZoneInfo("America/Sao_Paulo")
TTL_CREDITOS = 48 * 60 * 60  # 48h — cobre a virada do dia com folga

# Créditos por plano (por dia). None = ilimitado (fair use, sem contador).
CREDITOS_PLANO = {
    "starter": 4,
    "pro": 15,
    "business": 40,
    "enterprise": None,
}

# Custo em créditos por operação de IA. Novas operações plugam aqui.
CUSTO_OPERACAO = {
    "conteudo": 1,             # geração de conteúdo (legenda, hashtag, etc.)
    "analise_financeira": 2,   # análise financeira
    "analise_estoque": 2,      # futuras análises
    "analise_crm": 2,
    "chat_financeiro": 2,      # chat da análise (uma pergunta)
    "chat": 2,                 # alias genérico (futuros chats de outros módulos)
}

# Custo padrão para operação não catalogada (defensivo)
CUSTO_PADRAO = 2


class SemCreditosError(SynapseException):
    """A empresa não tem créditos suficientes para a operação (HTTP 402)."""

    def __init__(self, plano: str, limite: int, custo: int, restante: int):
        super().__init__(
            code="SEM_CREDITOS",
            message=(
                "Sem créditos suficientes hoje. Renova à 00:00 ou faça upgrade "
                f"do plano {plano}."
            ),
            details={"limite": limite, "custo": custo, "restante": restante},
        )
        self.status_code = 402


class CreditosService:
    """Controle unificado de créditos diários de IA."""

    # ── Helpers ──────────────────────────────────────────────────────────────
    @staticmethod
    def _hoje():
        return datetime.now(TZ).date()

    @staticmethod
    def _key(empresa_id) -> str:
        return f"ai:uso:{empresa_id}:{CreditosService._hoje().isoformat()}"

    @staticmethod
    def custo(operacao: str) -> int:
        return CUSTO_OPERACAO.get(operacao, CUSTO_PADRAO)

    @staticmethod
    def _limite(empresa_id) -> int | None:
        from modules.auth.models import Empresa

        try:
            plano = Empresa.objects.get(pk=empresa_id).plano
        except Empresa.DoesNotExist:
            plano = "starter"
        return CREDITOS_PLANO.get(plano, CREDITOS_PLANO["starter"])

    @staticmethod
    def _plano(empresa_id) -> str:
        from modules.auth.models import Empresa

        try:
            return Empresa.objects.get(pk=empresa_id).plano
        except Empresa.DoesNotExist:
            return "starter"

    @staticmethod
    def _usado(empresa_id) -> int:
        return int(cache.get(CreditosService._key(empresa_id)) or 0)

    @staticmethod
    def _renova_em() -> dict:
        """Próxima renovação = próxima meia-noite no fuso do projeto."""
        amanha = (datetime.now(TZ) + timedelta(days=1)).date()
        proximo = datetime.combine(amanha, time.min, tzinfo=TZ)
        return {"texto": "amanhã às 00:00", "iso": proximo.isoformat()}

    # ── Reserva / confirmação / devolução ───────────────────────────────────
    @staticmethod
    def reservar(empresa_id, operacao: str) -> int:
        """
        Reserva (cobra) o custo da operação. Retorna o custo reservado.
        Levanta SemCreditosError se não houver saldo — ANTES de chamar a IA.
        Enterprise (ilimitado) não conta.
        """
        custo = CreditosService.custo(operacao)
        limite = CreditosService._limite(empresa_id)
        if limite is None:  # enterprise — fair use, sem contador
            return custo

        key = CreditosService._key(empresa_id)
        # Garante a chave com TTL antes do incr atômico
        cache.add(key, 0, TTL_CREDITOS)
        novo = cache.incr(key, custo)
        cache.touch(key, TTL_CREDITOS)

        if novo > limite:
            # Estorna a reserva que estourou o limite (reserva otimista)
            cache.decr(key, custo)
            restante = max(0, limite - (novo - custo))
            raise SemCreditosError(
                CreditosService._plano(empresa_id), limite, custo, restante
            )
        logger.info(
            "Créditos reservados",
            extra={"empresa_id": str(empresa_id), "operacao": operacao, "custo": custo, "usado": novo},
        )
        return custo

    @staticmethod
    def confirmar(empresa_id, operacao: str) -> None:
        """Sucesso: o crédito já foi cobrado na reserva. No-op (só log)."""
        logger.debug(
            "Créditos confirmados",
            extra={"empresa_id": str(empresa_id), "operacao": operacao},
        )

    @staticmethod
    def devolver(empresa_id, operacao: str) -> None:
        """Falha na IA: estorna o custo reservado (nunca abaixo de zero)."""
        limite = CreditosService._limite(empresa_id)
        if limite is None:
            return
        custo = CreditosService.custo(operacao)
        key = CreditosService._key(empresa_id)
        atual = int(cache.get(key) or 0)
        novo = max(0, atual - custo)
        cache.set(key, novo, TTL_CREDITOS)
        logger.info(
            "Créditos devolvidos (falha na IA)",
            extra={"empresa_id": str(empresa_id), "operacao": operacao, "custo": custo, "usado": novo},
        )

    # ── Saldo (visibilidade) ─────────────────────────────────────────────────
    @staticmethod
    def saldo(empresa_id) -> dict:
        plano = CreditosService._plano(empresa_id)
        limite = CREDITOS_PLANO.get(plano, CREDITOS_PLANO["starter"])
        ilimitado = limite is None
        usado = 0 if ilimitado else CreditosService._usado(empresa_id)
        restante = None if ilimitado else max(0, limite - usado)
        renova = CreditosService._renova_em()
        return {
            "usado": usado,
            "limite": limite,
            "restante": restante,
            "plano": plano,
            "ilimitado": ilimitado,
            "renova_em": renova["texto"],
            "renova_em_iso": renova["iso"],
        }
