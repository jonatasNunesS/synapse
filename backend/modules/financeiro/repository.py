"""
Synapse — Módulo Financeiro: Repository
Toda query ao banco de dados passa por aqui. Nunca diretamente nas views.
"""
import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from django.db.models import Case, DecimalField, Q, Sum, Value, When
from django.db.models.functions import TruncDate
from django.db import connection

from .models import Categoria, Lancamento

logger = logging.getLogger("synapse")


class FinanceiroRepository:
    """Repositório de queries do módulo financeiro."""

    # ── Categorias ───────────────────────────────────────────

    @staticmethod
    def listar_categorias(empresa_id, apenas_ativas: bool = True):
        """Lista categorias de uma empresa."""
        qs = Categoria.objects.filter(empresa_id=empresa_id)
        if apenas_ativas:
            qs = qs.filter(ativo=True)
        return qs.order_by("tipo", "nome")

    @staticmethod
    def get_categoria(empresa_id, categoria_id):
        """Busca categoria por ID garantindo multi-tenant."""
        return Categoria.objects.filter(
            empresa_id=empresa_id, id=categoria_id
        ).first()

    @staticmethod
    def criar_categoria(empresa_id, dados: dict) -> Categoria:
        """Cria uma nova categoria."""
        return Categoria.objects.create(empresa_id=empresa_id, **dados)

    @staticmethod
    def atualizar_categoria(categoria: Categoria, dados: dict) -> Categoria:
        """Atualiza uma categoria existente."""
        for campo, valor in dados.items():
            setattr(categoria, campo, valor)
        categoria.save()
        return categoria

    @staticmethod
    def soft_delete_categoria(categoria: Categoria) -> Categoria:
        """Soft delete: marca categoria como inativa."""
        categoria.ativo = False
        categoria.save(update_fields=["ativo"])
        return categoria

    # ── Lançamentos ──────────────────────────────────────────

    @staticmethod
    def listar_lancamentos(empresa_id, filtros: dict = None):
        """
        Lista lançamentos com filtros opcionais.
        Filtros: tipo, status, categoria_id, data_inicio, data_fim, busca
        """
        qs = Lancamento.objects.filter(empresa_id=empresa_id).select_related(
            "categoria", "criado_por"
        )

        if filtros:
            if filtros.get("tipo"):
                qs = qs.filter(tipo=filtros["tipo"])
            if filtros.get("status"):
                qs = qs.filter(status=filtros["status"])
            if filtros.get("categoria_id"):
                qs = qs.filter(categoria_id=filtros["categoria_id"])
            if filtros.get("data_inicio"):
                qs = qs.filter(data_vencimento__gte=filtros["data_inicio"])
            if filtros.get("data_fim"):
                qs = qs.filter(data_vencimento__lte=filtros["data_fim"])
            if filtros.get("busca"):
                qs = qs.filter(descricao__icontains=filtros["busca"])

        return qs.order_by("-data_vencimento")

    @staticmethod
    def get_lancamento(empresa_id, lancamento_id):
        """Busca lançamento por ID garantindo multi-tenant."""
        return (
            Lancamento.objects.filter(empresa_id=empresa_id, id=lancamento_id)
            .select_related("categoria", "criado_por")
            .first()
        )

    @staticmethod
    def criar_lancamento(empresa_id, usuario_id, dados: dict) -> Lancamento:
        """Cria um novo lançamento."""
        return Lancamento.objects.create(
            empresa_id=empresa_id,
            criado_por_id=usuario_id,
            **dados,
        )

    @staticmethod
    def atualizar_lancamento(lancamento: Lancamento, dados: dict) -> Lancamento:
        """Atualiza um lançamento existente."""
        for campo, valor in dados.items():
            setattr(lancamento, campo, valor)
        lancamento.save()
        return lancamento

    @staticmethod
    def deletar_lancamento(lancamento: Lancamento) -> None:
        """Remove um lançamento permanentemente."""
        lancamento.delete()

    @staticmethod
    def marcar_como_pago(
        lancamento: Lancamento, data_pagamento: date
    ) -> Lancamento:
        """Marca lançamento como pago com data de pagamento."""
        lancamento.status = "pago"
        lancamento.data_pagamento = data_pagamento
        lancamento.save(update_fields=["status", "data_pagamento", "atualizado_em"])
        return lancamento

    # ── Aggregations ─────────────────────────────────────────

    @staticmethod
    def calcular_resumo(empresa_id, mes: int, ano: int) -> dict:
        """
        Calcula resumo financeiro do mês.
        Receitas/Despesas: apenas lançamentos PAGOS no período.
        Pendente/Atrasado: lançamentos com esses status (qualquer data).
        """
        hoje = date.today()

        # Lançamentos pagos no período (mês/ano)
        pagos_periodo = Lancamento.objects.filter(
            empresa_id=empresa_id,
            status="pago",
            data_pagamento__month=mes,
            data_pagamento__year=ano,
        )

        total_receitas = (
            pagos_periodo.filter(tipo="receita").aggregate(
                total=Sum("valor")
            )["total"] or Decimal("0")
        )
        total_despesas = (
            pagos_periodo.filter(tipo="despesa").aggregate(
                total=Sum("valor")
            )["total"] or Decimal("0")
        )

        # Pendentes (qualquer período)
        total_pendente = (
            Lancamento.objects.filter(
                empresa_id=empresa_id, status="pendente"
            ).aggregate(total=Sum("valor"))["total"] or Decimal("0")
        )

        # Atrasados: pendentes com vencimento < hoje
        total_atrasado = (
            Lancamento.objects.filter(
                empresa_id=empresa_id,
                status="pendente",
                data_vencimento__lt=hoje,
            ).aggregate(total=Sum("valor"))["total"] or Decimal("0")
        )

        # Contagem total do mês
        lancamentos_count = Lancamento.objects.filter(
            empresa_id=empresa_id,
            data_vencimento__month=mes,
            data_vencimento__year=ano,
        ).count()

        return {
            "total_receitas": total_receitas,
            "total_despesas": total_despesas,
            "saldo": total_receitas - total_despesas,
            "total_pendente": total_pendente,
            "total_atrasado": total_atrasado,
            "lancamentos_count": lancamentos_count,
        }

    @staticmethod
    def fluxo_caixa(empresa_id, data_inicio: date, data_fim: date) -> list[dict]:
        """
        Retorna fluxo de caixa diário (apenas dias com lançamentos pagos).
        Usa Cast para compatibilidade com SQLite (testes) e PostgreSQL (produção).
        """
        from django.db.models import DateField
        from django.db.models.functions import Cast

        qs = (
            Lancamento.objects.filter(
                empresa_id=empresa_id,
                status="pago",
                data_pagamento__gte=data_inicio,
                data_pagamento__lte=data_fim,
            )
            .annotate(dia=Cast("data_pagamento", output_field=DateField()))
            .values("dia")
            .annotate(
                receitas=Sum(
                    Case(
                        When(tipo="receita", then="valor"),
                        default=Value(Decimal("0")),
                        output_field=DecimalField(),
                    )
                ),
                despesas=Sum(
                    Case(
                        When(tipo="despesa", then="valor"),
                        default=Value(Decimal("0")),
                        output_field=DecimalField(),
                    )
                ),
            )
            .order_by("dia")
        )

        resultado = []
        for row in qs:
            receitas = row["receitas"] or Decimal("0")
            despesas = row["despesas"] or Decimal("0")
            resultado.append(
                {
                    "data": row["dia"],
                    "receitas": receitas,
                    "despesas": despesas,
                    "saldo": receitas - despesas,
                }
            )
        return resultado

    @staticmethod
    def dre(empresa_id, mes: int, ano: int) -> dict:
        """
        DRE simplificado: receitas e despesas por categoria no mês.
        Considera apenas lançamentos PAGOS no período.
        """
        base_qs = Lancamento.objects.filter(
            empresa_id=empresa_id,
            status="pago",
            data_pagamento__month=mes,
            data_pagamento__year=ano,
        )

        # Receitas por categoria
        receitas_qs = (
            base_qs.filter(tipo="receita")
            .values("categoria_id", "categoria__nome", "categoria__cor")
            .annotate(total=Sum("valor"))
            .order_by("-total")
        )

        # Despesas por categoria
        despesas_qs = (
            base_qs.filter(tipo="despesa")
            .values("categoria_id", "categoria__nome", "categoria__cor")
            .annotate(total=Sum("valor"))
            .order_by("-total")
        )

        def formatar_categoria(row) -> dict:
            return {
                "categoria_id": row["categoria_id"],
                "categoria": row["categoria__nome"] or "Sem categoria",
                "cor": row["categoria__cor"] or "#6D28D9",
                "total": row["total"] or Decimal("0"),
            }

        receitas_por_categoria = [formatar_categoria(r) for r in receitas_qs]
        despesas_por_categoria = [formatar_categoria(d) for d in despesas_qs]

        total_receitas = sum(r["total"] for r in receitas_por_categoria) or Decimal("0")
        total_despesas = sum(d["total"] for d in despesas_por_categoria) or Decimal("0")
        lucro_bruto = total_receitas - total_despesas
        margem = (
            (lucro_bruto / total_receitas * 100).quantize(Decimal("0.01"))
            if total_receitas > 0
            else Decimal("0")
        )

        return {
            "receitas_por_categoria": receitas_por_categoria,
            "despesas_por_categoria": despesas_por_categoria,
            "total_receitas": total_receitas,
            "total_despesas": total_despesas,
            "lucro_bruto": lucro_bruto,
            "margem": margem,
        }

    @staticmethod
    def listar_vencimentos_proximos(empresa_id, dias: int = 7):
        """Lançamentos pendentes com vencimento nos próximos X dias."""
        hoje = date.today()
        limite = hoje + timedelta(days=dias)
        return (
            Lancamento.objects.filter(
                empresa_id=empresa_id,
                status="pendente",
                data_vencimento__gte=hoje,
                data_vencimento__lte=limite,
            )
            .select_related("categoria")
            .order_by("data_vencimento")
        )

    @staticmethod
    def listar_lancamentos_vencidos(empresa_id=None):
        """
        Lançamentos pendentes com vencimento antes de hoje.
        Se empresa_id=None, retorna de todas as empresas (para task Celery).
        """
        qs = Lancamento.objects.filter(
            status="pendente",
            data_vencimento__lt=date.today(),
        )
        if empresa_id:
            qs = qs.filter(empresa_id=empresa_id)
        return qs

    @staticmethod
    def listar_vencendo_hoje_amanha():
        """Lançamentos pendentes que vencem hoje ou amanhã (para notificações)."""
        hoje = date.today()
        amanha = hoje + timedelta(days=1)
        return (
            Lancamento.objects.filter(
                status="pendente",
                data_vencimento__in=[hoje, amanha],
            )
            .select_related("empresa", "criado_por")
        )

    @staticmethod
    def atualizar_status_em_lote(lancamento_ids: list, novo_status: str) -> int:
        """Atualiza status de múltiplos lançamentos. Retorna quantidade atualizada."""
        count = Lancamento.objects.filter(id__in=lancamento_ids).update(
            status=novo_status
        )
        return count
