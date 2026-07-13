"""
Synapse — Recorrências: Service (orquestração / regras).

"Esperado" ≠ "aconteceu": ocorrências são perguntas; só viram Lançamento quando
o usuário confirma. A task diária cria as perguntas; ela NÃO cria lançamentos.
"""
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.db import transaction

from shared.exceptions import ResourceNotFound

from .calculo import proxima_data_esperada
from .models import OcorrenciaRecorrencia, Recorrencia
from .repository import RecorrenciaRepository

logger = logging.getLogger("synapse")

TZ = ZoneInfo("America/Sao_Paulo")


class RecorrenciaService:
    # ── Helpers ──────────────────────────────────────────────────────────────
    @staticmethod
    def _hoje():
        return datetime.now(TZ).date()

    # ── CRUD de recorrências ─────────────────────────────────────────────────
    @staticmethod
    def criar(empresa_id, usuario_id, dados: dict) -> Recorrencia:
        return Recorrencia.objects.create(
            empresa_id=empresa_id, criado_por_id=usuario_id, **dados
        )

    @staticmethod
    def obter(empresa_id, recorrencia_id) -> Recorrencia:
        rec = RecorrenciaRepository.get(empresa_id, recorrencia_id)
        if rec is None:
            raise ResourceNotFound("Recorrência", str(recorrencia_id))
        return rec

    @staticmethod
    def atualizar(empresa_id, recorrencia_id, dados: dict) -> Recorrencia:
        rec = RecorrenciaService.obter(empresa_id, recorrencia_id)
        for campo, valor in dados.items():
            setattr(rec, campo, valor)
        rec.save()
        return rec

    @staticmethod
    def definir_ativa(empresa_id, recorrencia_id, ativa: bool) -> Recorrencia:
        rec = RecorrenciaService.obter(empresa_id, recorrencia_id)
        rec.ativa = ativa
        rec.save(update_fields=["ativa", "atualizado_em"])
        return rec

    @staticmethod
    def encerrar(empresa_id, recorrencia_id) -> Recorrencia:
        """Encerra a recorrência: pausa e fecha as ocorrências ainda vivas."""
        rec = RecorrenciaService.obter(empresa_id, recorrencia_id)
        rec.ativa = False
        rec.save(update_fields=["ativa", "atualizado_em"])
        OcorrenciaRecorrencia.objects.filter(
            recorrencia=rec, status__in=["pendente", "adiada"]
        ).update(status="encerrada")
        return rec

    # ── Geração diária de ocorrências (task) ─────────────────────────────────
    @staticmethod
    def gerar_ocorrencias(hoje=None) -> int:
        """
        Cria as "perguntas" (ocorrências pendentes) que já chegaram a hora de
        aparecer. Idempotente: não duplica ocorrência para a mesma data.
        Reativa ocorrências adiadas cuja data de retorno chegou.
        Retorna quantas ocorrências (novas + reativadas) foram notificadas.
        """
        hoje = hoje or RecorrenciaService._hoje()
        total = 0

        # 1. Adiadas cuja data de retorno chegou → voltam a pendente
        for oc in RecorrenciaRepository.adiadas_vencidas(hoje):
            oc.data_esperada = oc.data_adiada_para
            oc.data_adiada_para = None
            oc.status = "pendente"
            oc.save(update_fields=["data_esperada", "data_adiada_para", "status"])
            RecorrenciaService._notificar(oc)
            total += 1

        # 2. Recorrências ativas → cria a próxima pergunta se já está na hora
        for rec in RecorrenciaRepository.ativas():
            ultima = RecorrenciaRepository.ultima_ocorrencia(rec)
            ultima_data = ultima.data_esperada if ultima else None
            proxima = proxima_data_esperada(rec, ultima_data, hoje)

            # Já está na hora de avisar? (data − antecedência <= hoje)
            gatilho = proxima - timedelta(days=rec.avisar_com_antecedencia)
            if gatilho > hoje:
                continue
            # Idempotência: não duplica ocorrência para a mesma data
            if RecorrenciaRepository.existe_na_data(rec, proxima):
                continue

            oc = OcorrenciaRecorrencia.objects.create(
                recorrencia=rec, data_esperada=proxima, status="pendente"
            )
            RecorrenciaService._notificar(oc)
            total += 1

        logger.info("Recorrências: %d ocorrência(s) notificada(s) em %s", total, hoje)
        return total

    @staticmethod
    def _notificar(ocorrencia: OcorrenciaRecorrencia) -> None:
        from modules.notificacoes.services import NotificacaoService

        rec = ocorrencia.recorrencia
        if not rec.criado_por_id:
            return
        verbo = "recebeu" if rec.tipo == "receita" else "pagou"
        NotificacaoService.criar_notificacao(
            usuario_id=rec.criado_por_id,
            empresa_id=rec.empresa_id,
            tipo="financeiro",
            titulo=f"Chegou o dia: {rec.titulo}",
            mensagem=(
                f"Valor esperado: R$ {rec.valor_padrao}. Data esperada: "
                f"{ocorrencia.data_esperada.strftime('%d/%m/%Y')}. Você {verbo}?"
            ),
            acao_url=f"/financeiro/recorrencias?ocorrencia={ocorrencia.id}",
            prioridade="normal",
        )

    # ── Ações do usuário sobre a ocorrência ──────────────────────────────────
    @staticmethod
    def obter_ocorrencia(empresa_id, ocorrencia_id) -> OcorrenciaRecorrencia:
        oc = RecorrenciaRepository.get_ocorrencia(empresa_id, ocorrencia_id)
        if oc is None:
            raise ResourceNotFound("Ocorrência", str(ocorrencia_id))
        return oc

    @staticmethod
    @transaction.atomic
    def confirmar(empresa_id, ocorrencia_id, valor=None, atualizar_recorrencia=False):
        """
        Confirma a ocorrência → cria o Lançamento (pago, hoje). Se `valor` foi
        editado e `atualizar_recorrencia`, atualiza o valor_padrao do template.
        """
        from modules.financeiro.services import FinanceiroService

        oc = RecorrenciaService.obter_ocorrencia(empresa_id, ocorrencia_id)
        if oc.status not in ("pendente", "adiada"):
            from shared.exceptions import BusinessRuleViolation
            raise BusinessRuleViolation(
                code="OCORRENCIA_JA_RESOLVIDA",
                message="Esta ocorrência já foi resolvida.",
            )

        rec = oc.recorrencia
        hoje = RecorrenciaService._hoje()
        valor_final = valor if valor is not None else rec.valor_padrao

        lancamento = FinanceiroService.criar_lancamento(
            empresa_id,
            rec.criado_por_id,
            {
                "tipo": rec.tipo,
                "descricao": rec.titulo,
                "valor": valor_final,
                "categoria_id": rec.categoria_id,
                "data_vencimento": oc.data_esperada,
                "data_pagamento": hoje,
                "status": "pago",
                "observacoes": rec.descricao or "",
            },
        )

        oc.status = "confirmada"
        oc.data_confirmacao = hoje
        oc.lancamento_gerado = lancamento
        oc.valor_confirmado = valor if valor is not None else None
        oc.save(update_fields=[
            "status", "data_confirmacao", "lancamento_gerado", "valor_confirmado",
        ])

        if valor is not None and atualizar_recorrencia:
            rec.valor_padrao = valor
            rec.save(update_fields=["valor_padrao", "atualizado_em"])

        return oc, lancamento

    @staticmethod
    def adiar(empresa_id, ocorrencia_id, dias: int) -> OcorrenciaRecorrencia:
        oc = RecorrenciaService.obter_ocorrencia(empresa_id, ocorrencia_id)
        oc.status = "adiada"
        oc.data_adiada_para = RecorrenciaService._hoje() + timedelta(days=max(1, dias))
        oc.save(update_fields=["status", "data_adiada_para"])
        return oc

    @staticmethod
    def cancelar(empresa_id, ocorrencia_id) -> OcorrenciaRecorrencia:
        """Cancela só esta ocorrência — a recorrência segue ativa para as próximas."""
        oc = RecorrenciaService.obter_ocorrencia(empresa_id, ocorrencia_id)
        oc.status = "cancelada"
        oc.save(update_fields=["status"])
        return oc

    @staticmethod
    def listar_pendentes(empresa_id):
        return RecorrenciaRepository.pendentes_da_empresa(empresa_id)
