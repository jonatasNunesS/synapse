"""
M5 — Fornecedores: Repository
Queries e aggregations para o módulo de fornecedores.
"""
from decimal import Decimal
from django.db import transaction
from django.db.models import (
    Sum, Avg, Count, Max, Q, F, Value, IntegerField, DecimalField
)
from django.db.models.functions import Coalesce

from shared.exceptions import ResourceNotFound
from .models import CategoriaFornecedor, Fornecedor, CompraFornecedor


class FornecedorRepository:

    # ─── Categorias ──────────────────────────────────────────────────────────

    @staticmethod
    def listar_categorias(empresa_id) -> list:
        return list(
            CategoriaFornecedor.objects.filter(empresa_id=empresa_id, ativo=True)
            .order_by("nome")
        )

    @staticmethod
    def obter_categoria(empresa_id, categoria_id) -> CategoriaFornecedor:
        try:
            return CategoriaFornecedor.objects.get(pk=categoria_id, empresa_id=empresa_id)
        except CategoriaFornecedor.DoesNotExist:
            raise ResourceNotFound("Categoria", categoria_id)

    @staticmethod
    def criar_categoria(empresa_id, dados: dict) -> CategoriaFornecedor:
        return CategoriaFornecedor.objects.create(empresa_id=empresa_id, **dados)

    @staticmethod
    def atualizar_categoria(categoria: CategoriaFornecedor, dados: dict) -> CategoriaFornecedor:
        for campo, valor in dados.items():
            setattr(categoria, campo, valor)
        categoria.save()
        return categoria

    @staticmethod
    def deletar_categoria(categoria: CategoriaFornecedor) -> None:
        categoria.delete()

    # ─── Fornecedores ─────────────────────────────────────────────────────────

    @staticmethod
    def listar_fornecedores(empresa_id, filtros: dict = None):
        """
        Retorna QuerySet filtrado de fornecedores.
        Filtros: categoria_id, status, ativo, busca, tem_avaliacao
        Ordenação padrão: -score_synapse
        """
        qs = Fornecedor.objects.filter(empresa_id=empresa_id).select_related("categoria")

        if filtros:
            if filtros.get("categoria_id"):
                qs = qs.filter(categoria_id=filtros["categoria_id"])

            if filtros.get("status"):
                qs = qs.filter(status=filtros["status"])

            if filtros.get("ativo") is not None:
                qs = qs.filter(ativo=filtros["ativo"])

            if filtros.get("busca"):
                busca = filtros["busca"]
                qs = qs.filter(
                    Q(nome__icontains=busca) |
                    Q(email__icontains=busca) |
                    Q(cnpj__icontains=busca) |
                    Q(nome_contato__icontains=busca)
                )

            if filtros.get("tem_avaliacao"):
                qs = qs.filter(score_synapse__gt=0)

        return qs.order_by("-score_synapse", "nome")

    @staticmethod
    def obter_fornecedor(empresa_id, fornecedor_id) -> Fornecedor:
        try:
            return Fornecedor.objects.select_related("categoria", "criado_por").get(
                pk=fornecedor_id, empresa_id=empresa_id
            )
        except Fornecedor.DoesNotExist:
            raise ResourceNotFound("Fornecedor", fornecedor_id)

    @staticmethod
    def criar_fornecedor(empresa_id, usuario_id, dados: dict) -> Fornecedor:
        return Fornecedor.objects.create(
            empresa_id=empresa_id,
            criado_por_id=usuario_id,
            **dados,
        )

    @staticmethod
    def atualizar_fornecedor(fornecedor: Fornecedor, dados: dict) -> Fornecedor:
        for campo, valor in dados.items():
            setattr(fornecedor, campo, valor)
        fornecedor.save()
        return fornecedor

    @staticmethod
    def soft_delete_fornecedor(fornecedor: Fornecedor) -> None:
        fornecedor.ativo = False
        fornecedor.save(update_fields=["ativo"])

    # ─── Ranking ─────────────────────────────────────────────────────────────

    @staticmethod
    def obter_ranking(empresa_id) -> list:
        """
        Retorna fornecedores com score > 0, ordenados por score DESC.
        Adiciona posição calculada.
        """
        fornecedores = list(
            Fornecedor.objects.filter(
                empresa_id=empresa_id,
                avaliacao_qualidade__isnull=False,
                ativo=True,
            )
            .select_related("categoria")
            .order_by("-score_synapse")
        )
        # Adicionar posição
        for i, f in enumerate(fornecedores, start=1):
            f.posicao = i
        return fornecedores

    # ─── Resumo / KPIs ───────────────────────────────────────────────────────

    @staticmethod
    def calcular_resumo(empresa_id) -> dict:
        """Aggregations para o dashboard de fornecedores."""
        base_qs = Fornecedor.objects.filter(empresa_id=empresa_id)

        agregado = base_qs.aggregate(
            total=Count("id"),
            ativos=Count("id", filter=Q(ativo=True, status="ativo")),
        )

        # Valor total gasto (soma de compras pagas)
        compras_agg = CompraFornecedor.objects.filter(
            empresa_id=empresa_id,
            status="pago",
        ).aggregate(
            valor_total=Coalesce(Sum("valor"), Decimal("0.00")),
            total_pedidos=Count("id"),
        )

        ticket_medio = Decimal("0.00")
        if compras_agg["total_pedidos"] > 0:
            ticket_medio = compras_agg["valor_total"] / compras_agg["total_pedidos"]

        # Melhor fornecedor (score mais alto)
        melhor = (
            base_qs.filter(score_synapse__gt=0, ativo=True)
            .order_by("-score_synapse")
            .values("id", "nome", "score_synapse")
            .first()
        )
        if melhor:
            melhor["id"] = str(melhor["id"])
            melhor["score_synapse"] = float(melhor["score_synapse"])

        # Por status
        por_status = dict(
            base_qs.values("status").annotate(total=Count("id")).values_list("status", "total")
        )

        return {
            "total_fornecedores": agregado["total"],
            "fornecedores_ativos": agregado["ativos"],
            "valor_total_gasto": compras_agg["valor_total"],
            "ticket_medio_geral": ticket_medio,
            "melhor_score": melhor,
            "fornecedores_por_status": por_status,
        }

    # ─── Compras ─────────────────────────────────────────────────────────────

    @staticmethod
    def listar_compras(empresa_id, fornecedor_id, filtros: dict = None):
        """Retorna QuerySet de compras de um fornecedor."""
        qs = CompraFornecedor.objects.filter(
            empresa_id=empresa_id,
            fornecedor_id=fornecedor_id,
        ).select_related("criado_por", "fornecedor")

        if filtros:
            if filtros.get("status"):
                qs = qs.filter(status=filtros["status"])
            if filtros.get("data_inicio"):
                qs = qs.filter(data_compra__gte=filtros["data_inicio"])
            if filtros.get("data_fim"):
                qs = qs.filter(data_compra__lte=filtros["data_fim"])

        return qs.order_by("-data_compra")

    @staticmethod
    def criar_compra(fornecedor_id, empresa_id, dados: dict, usuario_id) -> CompraFornecedor:
        """Cria compra com transaction.atomic(). Signal cuida de atualizar fornecedor."""
        with transaction.atomic():
            compra = CompraFornecedor.objects.create(
                fornecedor_id=fornecedor_id,
                empresa_id=empresa_id,
                criado_por_id=usuario_id,
                **dados,
            )
        return compra

    @staticmethod
    def obter_compra(empresa_id, compra_id) -> CompraFornecedor:
        """Retorna compra garantindo multi-tenant."""
        try:
            return CompraFornecedor.objects.select_related("fornecedor", "criado_por").get(
                pk=compra_id, empresa_id=empresa_id
            )
        except CompraFornecedor.DoesNotExist:
            from shared.exceptions import ResourceNotFound
            raise ResourceNotFound("Compra", str(compra_id))

    @staticmethod
    def atualizar_compra(empresa_id, compra_id, dados: dict) -> CompraFornecedor:
        """Atualiza campos editáveis da compra."""
        compra = FornecedorRepository.obter_compra(empresa_id, compra_id)
        for campo, valor in dados.items():
            setattr(compra, campo, valor)
        compra.save()
        return compra

    @staticmethod
    def excluir_compra(empresa_id, compra_id) -> None:
        """Exclui compra garantindo multi-tenant."""
        compra = FornecedorRepository.obter_compra(empresa_id, compra_id)
        compra.delete()
