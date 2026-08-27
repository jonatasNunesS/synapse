"""
Synapse — Vendas: Repository (acesso a dados).

Cabeçalho e itens mudam sempre juntos: uma venda cujos itens foram gravados
mas cujo total não foi recalculado é dado corrompido. Por isso toda escrita
aqui é atômica, e o recálculo acontece dentro da mesma transação.
"""
from django.db import transaction

from .models import ItemVenda, Venda


class VendaRepository:
    """Camada de acesso a dados das vendas."""

    @staticmethod
    def listar(empresa_id):
        return (
            Venda.objects.filter(empresa_id=empresa_id)
            .select_related("cliente")
            .prefetch_related("itens__produto")
        )

    @staticmethod
    def obter_por_id(empresa_id, venda_id):
        try:
            return (
                Venda.objects.select_related("cliente")
                .prefetch_related("itens__produto")
                .get(id=venda_id, empresa_id=empresa_id)
            )
        except Venda.DoesNotExist:
            return None

    @staticmethod
    @transaction.atomic
    def criar(empresa_id, usuario_id, dados: dict, itens: list[dict]) -> Venda:
        venda = Venda.objects.create(
            empresa_id=empresa_id,
            criado_por_id=usuario_id,
            **dados,
        )
        VendaRepository._gravar_itens(venda, itens)
        venda.recalcular_totais()
        return venda

    @staticmethod
    @transaction.atomic
    def atualizar(venda: Venda, dados: dict, itens: list[dict] | None) -> Venda:
        for campo, valor in dados.items():
            setattr(venda, campo, valor)
        venda.save()

        # itens=None significa "não mexeu nos itens"; lista vazia significa
        # "removeu todos" — são coisas diferentes.
        if itens is not None:
            venda.itens.all().delete()
            VendaRepository._gravar_itens(venda, itens)

        venda.recalcular_totais()
        return venda

    @staticmethod
    def deletar(venda: Venda) -> None:
        venda.delete()

    @staticmethod
    def _gravar_itens(venda: Venda, itens: list[dict]) -> None:
        for item in itens:
            # O subtotal da linha sai do save() do ItemVenda — nunca de fora.
            ItemVenda.objects.create(
                venda=venda,
                empresa_id=venda.empresa_id,
                produto=item["produto"],
                descricao=item.get("descricao", ""),
                quantidade=item["quantidade"],
                preco_unitario=item["preco_unitario"],
            )
