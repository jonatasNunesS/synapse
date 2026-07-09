"""
Synapse — Painel Administrativo: Service (orquestração / regras).

Toda troca de plano gera um LogAlteracaoPlano. Se a mutação falhar, a tentativa
também é registrada (status="erro") antes de propagar o erro.
"""
import logging

from django.db import transaction

from modules.auth.models import PLANO_CHOICES
from shared.exceptions import ResourceNotFound

from .repository import PainelAdminRepository

logger = logging.getLogger("synapse")

PLANOS_VALIDOS = [p[0] for p in PLANO_CHOICES]


class PainelAdminService:
    """Regras do painel administrativo (visão de plataforma)."""

    # ── Empresas ─────────────────────────────────────────────────────────────
    @staticmethod
    def listar_empresas():
        return PainelAdminRepository.empresas_com_contadores()

    @staticmethod
    def creditos_usados_hoje(empresa_id) -> int:
        """Créditos de IA já usados hoje pela empresa (0 para ilimitado)."""
        from modules.ai_hub.creditos import CreditosService

        return CreditosService.saldo(empresa_id)["usado"]

    @staticmethod
    def obter_empresa(empresa_id):
        empresa = PainelAdminRepository.get_empresa(empresa_id)
        if empresa is None:
            raise ResourceNotFound("Empresa", str(empresa_id))
        return empresa

    @staticmethod
    def usuarios_da_empresa(empresa_id):
        return PainelAdminRepository.usuarios_da_empresa(empresa_id)

    @staticmethod
    def listar_historico(empresa_id):
        # Garante que a empresa existe (404 claro em vez de lista vazia silenciosa)
        PainelAdminService.obter_empresa(empresa_id)
        return PainelAdminRepository.historico(empresa_id)

    # ── Troca de plano (auditada) ────────────────────────────────────────────
    @staticmethod
    def trocar_plano(empresa_id, plano_novo: str, usuario, observacao: str = ""):
        """
        Troca o plano da empresa e registra a auditoria. Troca para o MESMO
        plano é permitida (registra a observação). Falha na mutação também é
        registrada (status="erro") e então propagada.
        """
        empresa = PainelAdminService.obter_empresa(empresa_id)
        plano_anterior = empresa.plano

        try:
            with transaction.atomic():
                empresa.plano = plano_novo
                empresa.save(update_fields=["plano", "atualizado_em"])
                log = PainelAdminRepository.criar_log(
                    empresa=empresa,
                    plano_anterior=plano_anterior,
                    plano_novo=plano_novo,
                    alterado_por=usuario,
                    observacao=observacao or "",
                    status="sucesso",
                )
            logger.info(
                "Painel: plano da empresa %s: %s → %s (por %s)",
                empresa_id, plano_anterior, plano_novo, getattr(usuario, "email", "?"),
            )
            return empresa, log
        except Exception as exc:
            # A tentativa falha também vira auditoria (fora da transação revertida).
            logger.error("Painel: falha ao trocar plano da empresa %s — %s", empresa_id, exc)
            PainelAdminRepository.criar_log(
                empresa=empresa,
                plano_anterior=plano_anterior,
                plano_novo=plano_novo,
                alterado_por=usuario,
                observacao=observacao or "",
                status="erro",
                erro=str(exc),
            )
            raise
