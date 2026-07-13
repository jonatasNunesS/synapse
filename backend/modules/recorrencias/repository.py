"""
Synapse — Recorrências: Repository (acesso a dados). Multi-tenant por empresa.
"""
from .models import OcorrenciaRecorrencia, Recorrencia


class RecorrenciaRepository:
    # ── Recorrências ─────────────────────────────────────────────────────────
    @staticmethod
    def listar(empresa_id):
        return (
            Recorrencia.objects.filter(empresa_id=empresa_id)
            .select_related("categoria")
            .order_by("-criado_em")
        )

    @staticmethod
    def get(empresa_id, recorrencia_id):
        return Recorrencia.objects.filter(
            pk=recorrencia_id, empresa_id=empresa_id
        ).first()

    @staticmethod
    def ativas():
        """Todas as recorrências ativas (cross-tenant) — usado pela task diária."""
        return Recorrencia.objects.filter(ativa=True).select_related("empresa")

    # ── Ocorrências ──────────────────────────────────────────────────────────
    @staticmethod
    def get_ocorrencia(empresa_id, ocorrencia_id):
        return (
            OcorrenciaRecorrencia.objects.filter(
                pk=ocorrencia_id, recorrencia__empresa_id=empresa_id
            )
            .select_related("recorrencia", "recorrencia__categoria")
            .first()
        )

    @staticmethod
    def ultima_ocorrencia(recorrencia):
        """Ocorrência mais recente (por data_esperada) — âncora da próxima."""
        return (
            OcorrenciaRecorrencia.objects.filter(recorrencia=recorrencia)
            .order_by("-data_esperada")
            .first()
        )

    @staticmethod
    def existe_na_data(recorrencia, data) -> bool:
        return OcorrenciaRecorrencia.objects.filter(
            recorrencia=recorrencia, data_esperada=data
        ).exists()

    @staticmethod
    def ultimas_ocorrencias(recorrencia, n=3):
        return list(
            OcorrenciaRecorrencia.objects.filter(recorrencia=recorrencia).order_by(
                "-data_esperada"
            )[:n]
        )

    @staticmethod
    def adiadas_vencidas(hoje):
        """Ocorrências adiadas cuja data de retorno já chegou (cross-tenant)."""
        return OcorrenciaRecorrencia.objects.filter(
            status="adiada", data_adiada_para__lte=hoje
        ).select_related("recorrencia")

    @staticmethod
    def pendentes_da_empresa(empresa_id):
        return (
            OcorrenciaRecorrencia.objects.filter(
                recorrencia__empresa_id=empresa_id, status="pendente"
            )
            .select_related("recorrencia", "recorrencia__categoria")
            .order_by("data_esperada")
        )
