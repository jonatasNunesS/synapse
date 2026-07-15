"""
Synapse — Caixinhas: Repository (acesso a dados).

Depósito/retirada usam lock pessimista (select_for_update) dentro de
transaction.atomic — mesmo padrão do EstoqueRepository.criar_movimentacao —
para impedir race condition de duas operações simultâneas deixarem o saldo
negativo ou perderem atualização.
"""
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Sum

from shared.exceptions import BusinessRuleViolation

from .models import Caixinha, MovimentoCaixinha


class CaixinhaRepository:
    """Camada de acesso a dados das caixinhas."""

    @staticmethod
    def listar(empresa_id):
        return Caixinha.objects.filter(empresa_id=empresa_id).order_by("-criado_em")

    @staticmethod
    def obter_por_id(empresa_id, caixinha_id):
        try:
            return Caixinha.objects.get(id=caixinha_id, empresa_id=empresa_id)
        except Caixinha.DoesNotExist:
            return None

    @staticmethod
    def criar(empresa_id, usuario_id, dados: dict) -> Caixinha:
        return Caixinha.objects.create(
            empresa_id=empresa_id,
            criado_por_id=usuario_id,
            **dados,
        )

    @staticmethod
    def atualizar(caixinha: Caixinha, dados: dict) -> Caixinha:
        for field, value in dados.items():
            setattr(caixinha, field, value)
        caixinha.save()
        return caixinha

    @staticmethod
    def deletar(caixinha: Caixinha) -> None:
        caixinha.delete()

    @staticmethod
    @transaction.atomic
    def movimentar(
        empresa_id, caixinha_id, tipo: str, valor: Decimal,
        descricao: str, usuario_id,
    ) -> MovimentoCaixinha:
        """
        Deposita ou retira com lock pessimista na caixinha.

        Retirada maior que o saldo levanta BusinessRuleViolation com o saldo
        atual nos details — o frontend usa isso para oferecer "retirar tudo".
        """
        try:
            caixinha = Caixinha.objects.select_for_update().get(
                pk=caixinha_id, empresa_id=empresa_id
            )
        except Caixinha.DoesNotExist:
            raise BusinessRuleViolation(
                code="NOT_FOUND",
                message="Caixinha não encontrada.",
            )

        if tipo == "deposito":
            caixinha.saldo = caixinha.saldo + valor
        elif tipo == "retirada":
            if valor > caixinha.saldo:
                raise BusinessRuleViolation(
                    code="SALDO_INSUFICIENTE",
                    message=(
                        f"A caixinha só tem R$ {caixinha.saldo:.2f}. "
                        "Retire no máximo esse valor."
                    ),
                    details={"saldo_atual": str(caixinha.saldo)},
                )
            caixinha.saldo = caixinha.saldo - valor
        else:
            raise BusinessRuleViolation(
                code="TIPO_INVALIDO",
                message=f"Tipo de movimento inválido: {tipo}.",
            )

        caixinha.save(update_fields=["saldo", "atualizado_em"])

        return MovimentoCaixinha.objects.create(
            caixinha=caixinha,
            empresa_id=empresa_id,
            tipo=tipo,
            valor=valor,
            descricao=descricao or "",
            criado_por_id=usuario_id,
        )

    @staticmethod
    def listar_movimentos(empresa_id, caixinha_id):
        return MovimentoCaixinha.objects.filter(
            empresa_id=empresa_id, caixinha_id=caixinha_id
        ).select_related("criado_por").order_by("-criado_em")

    @staticmethod
    def calcular_resumo(empresa_id) -> dict:
        """Total guardado em caixinhas e quantidade, para o saldo disponível."""
        agg = Caixinha.objects.filter(empresa_id=empresa_id).aggregate(
            total=Sum("saldo"),
            quantidade=Count("id"),
        )
        return {
            "total": agg["total"] or Decimal("0"),
            "quantidade": agg["quantidade"] or 0,
        }
