from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone

from shared.exceptions import ResourceNotFound as SynapseNotFoundError, BusinessRuleViolation as SynapseValidationError
from .models import CategoriaEstoque, Movimentacao, Produto, Variacao


class EstoqueRepository:
    """Repository para o módulo de Estoque. Toda lógica de query fica aqui."""

    # ─── Categorias ───────────────────────────────────────────────────────────

    @staticmethod
    def listar_categorias(empresa_id):
        return CategoriaEstoque.objects.filter(empresa_id=empresa_id, ativo=True)

    @staticmethod
    def obter_categoria(empresa_id, categoria_id):
        try:
            return CategoriaEstoque.objects.get(
                id=categoria_id, empresa_id=empresa_id
            )
        except CategoriaEstoque.DoesNotExist:
            raise SynapseNotFoundError("Categoria não encontrada.")

    @staticmethod
    def criar_categoria(empresa_id, dados):
        return CategoriaEstoque.objects.create(empresa_id=empresa_id, **dados)

    @staticmethod
    def atualizar_categoria(categoria, dados):
        for campo, valor in dados.items():
            setattr(categoria, campo, valor)
        categoria.save()
        return categoria

    @staticmethod
    def deletar_categoria(categoria):
        # Soft delete: desativar
        categoria.ativo = False
        categoria.save()

    # ─── Produtos ─────────────────────────────────────────────────────────────

    @staticmethod
    def listar_produtos(empresa_id, filtros=None):
        filtros = filtros or {}
        qs = (
            Produto.objects.filter(empresa_id=empresa_id)
            .select_related("categoria")
            .prefetch_related("variacoes")
        )

        # Filtro ativo (padrão: apenas ativos)
        ativo = filtros.get("ativo")
        if ativo is None or ativo == "true":
            qs = qs.filter(ativo=True)
        elif ativo == "false":
            qs = qs.filter(ativo=False)

        # Filtro por categoria
        categoria_id = filtros.get("categoria_id")
        if categoria_id:
            qs = qs.filter(categoria_id=categoria_id)

        # Filtro por busca (nome, sku, código de barras)
        busca = filtros.get("busca")
        if busca:
            qs = qs.filter(
                Q(nome__icontains=busca)
                | Q(sku__icontains=busca)
                | Q(codigo_barras__icontains=busca)
            )

        return qs

    @staticmethod
    def filtrar_por_status(qs, status_estoque):
        """Filtra queryset por status_estoque (ok/baixo/zerado)."""
        if status_estoque == "zerado":
            return qs.filter(estoque_atual__lte=0)
        elif status_estoque == "baixo":
            # Abaixo do mínimo mas não zerado
            return qs.filter(
                estoque_atual__gt=0,
                estoque_atual__lte=models_F("estoque_minimo"),
            )
        elif status_estoque == "ok":
            return qs.filter(estoque_atual__gt=models_F("estoque_minimo"))
        return qs

    @staticmethod
    def obter_produto(empresa_id, produto_id):
        try:
            return (
                Produto.objects.select_related("categoria", "criado_por")
                .prefetch_related("variacoes")
                .get(id=produto_id, empresa_id=empresa_id)
            )
        except Produto.DoesNotExist:
            raise SynapseNotFoundError("Produto não encontrado.")

    @staticmethod
    def criar_produto(empresa_id, usuario_id, dados):
        return Produto.objects.create(
            empresa_id=empresa_id,
            criado_por_id=usuario_id,
            **dados,
        )

    @staticmethod
    def atualizar_produto(produto, dados):
        for campo, valor in dados.items():
            setattr(produto, campo, valor)
        produto.save()
        return produto

    @staticmethod
    def soft_delete_produto(produto):
        """Soft delete: desativa o produto."""
        if produto.movimentacoes.exists():
            produto.ativo = False
            produto.save()
        else:
            produto.delete()

    # ─── Movimentações ────────────────────────────────────────────────────────

    @staticmethod
    def listar_movimentacoes(empresa_id, produto_id=None, filtros=None):
        filtros = filtros or {}
        qs = Movimentacao.objects.filter(empresa_id=empresa_id).select_related(
            "produto", "variacao", "criado_por"
        )

        if produto_id:
            qs = qs.filter(produto_id=produto_id)

        tipo = filtros.get("tipo")
        if tipo:
            qs = qs.filter(tipo=tipo)

        motivo = filtros.get("motivo")
        if motivo:
            qs = qs.filter(motivo=motivo)

        data_inicio = filtros.get("data_inicio")
        if data_inicio:
            qs = qs.filter(criado_em__date__gte=data_inicio)

        data_fim = filtros.get("data_fim")
        if data_fim:
            qs = qs.filter(criado_em__date__lte=data_fim)

        return qs.order_by("-criado_em")

    @staticmethod
    @transaction.atomic
    def criar_movimentacao(empresa_id, dados, usuario_id):
        """
        Cria movimentação com lock pessimista para evitar race conditions.
        Atualiza estoque do produto (e variação, se houver) atomicamente.
        """
        produto_id = dados["produto"].id if hasattr(dados["produto"], "id") else dados["produto"]
        tipo = dados["tipo"]
        quantidade = Decimal(str(dados["quantidade"]))
        variacao = dados.get("variacao")

        # Lock pessimista no produto
        produto = Produto.objects.select_for_update().get(
            id=produto_id, empresa_id=empresa_id
        )

        estoque_antes = produto.estoque_atual

        # Calcular novo estoque
        if tipo == "entrada":
            novo_estoque = estoque_antes + quantidade
        elif tipo == "saida":
            if estoque_antes < quantidade:
                raise SynapseValidationError(
                    f"Estoque insuficiente. Disponível: {estoque_antes}, "
                    f"Solicitado: {quantidade}."
                )
            novo_estoque = estoque_antes - quantidade
        elif tipo == "ajuste":
            # Ajuste pode ser qualquer valor (positivo ou negativo)
            novo_estoque = estoque_antes + quantidade
        else:
            novo_estoque = estoque_antes + quantidade

        estoque_depois = novo_estoque

        # Criar movimentação
        movimentacao = Movimentacao.objects.create(
            empresa_id=empresa_id,
            produto=produto,
            variacao=variacao,
            tipo=tipo,
            quantidade=quantidade,
            estoque_antes=estoque_antes,
            estoque_depois=estoque_depois,
            motivo=dados.get("motivo", "ajuste_manual"),
            referencia=dados.get("referencia", ""),
            observacoes=dados.get("observacoes", ""),
            criado_por_id=usuario_id,
        )

        # Atualizar estoque do produto
        produto.estoque_atual = estoque_depois
        produto.save(update_fields=["estoque_atual", "atualizado_em"])

        # Atualizar estoque da variação, se houver
        if variacao:
            variacao_obj = Variacao.objects.select_for_update().get(id=variacao.id)
            if tipo == "entrada":
                variacao_obj.estoque_atual += quantidade
            elif tipo == "saida":
                variacao_obj.estoque_atual -= quantidade
            elif tipo == "ajuste":
                variacao_obj.estoque_atual += quantidade
            variacao_obj.save(update_fields=["estoque_atual"])

        return movimentacao, produto

    # ─── Alertas e Resumo ─────────────────────────────────────────────────────

    @staticmethod
    def listar_alertas(empresa_id):
        """Produtos com estoque zerado ou abaixo do mínimo."""
        from django.db.models import F
        return (
            Produto.objects.filter(empresa_id=empresa_id, ativo=True)
            .filter(Q(estoque_atual__lte=0) | Q(estoque_atual__lte=F("estoque_minimo")))
            .select_related("categoria")
            .order_by("estoque_atual")
        )

    @staticmethod
    def calcular_relatorio(empresa_id):
        """Calcula KPIs gerais do estoque."""
        from django.db.models import F, ExpressionWrapper, DecimalField as DField

        produtos = Produto.objects.filter(empresa_id=empresa_id, ativo=True)

        total_produtos = produtos.count()

        # Valor total em estoque (estoque_atual * preco_custo)
        valor_total = sum(
            float(p.estoque_atual) * float(p.preco_custo) for p in produtos
        )

        produtos_sem_estoque = produtos.filter(estoque_atual__lte=0).count()

        from django.db.models import F as F2
        produtos_abaixo_minimo = produtos.filter(
            estoque_atual__gt=0,
            estoque_atual__lte=F2("estoque_minimo"),
        ).count()

        total_skus = produtos.exclude(sku="").count()

        # Giro médio: movimentações de saída nos últimos 30 dias / total de produtos
        trinta_dias_atras = timezone.now() - timedelta(days=30)
        total_saidas = Movimentacao.objects.filter(
            empresa_id=empresa_id,
            tipo="saida",
            criado_em__gte=trinta_dias_atras,
        ).count()

        giro_medio = Decimal(str(total_saidas / total_produtos)) if total_produtos > 0 else Decimal("0")

        return {
            "total_produtos": total_produtos,
            "total_skus": total_skus,
            "valor_total_estoque": round(valor_total, 2),
            "produtos_sem_estoque": produtos_sem_estoque,
            "produtos_abaixo_minimo": produtos_abaixo_minimo,
            "giro_medio": giro_medio,
        }

    @staticmethod
    def historico_produto(empresa_id, produto_id):
        """Movimentações dos últimos 90 dias com saldo acumulado."""
        noventa_dias_atras = timezone.now() - timedelta(days=90)
        movimentacoes = (
            Movimentacao.objects.filter(
                empresa_id=empresa_id,
                produto_id=produto_id,
                criado_em__gte=noventa_dias_atras,
            )
            .select_related("variacao", "criado_por")
            .order_by("criado_em")
        )
        return list(movimentacoes)


# Importação tardia para evitar circular
def models_F(field):
    from django.db.models import F
    return F(field)
