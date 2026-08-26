"""
Synapse — Vendas: Services (regras de negócio).

FASE 1 — INTEGRAÇÕES NÃO ENTRAM AQUI. Criar uma venda hoje não baixa estoque,
não gera lançamento financeiro e não aparece na timeline do cliente. Isso é
deliberado: o modelo novo precisa conviver com o fluxo atual de
InteracaoCliente sem duplicar efeito — se ambos mexessem no estoque, uma
venda registrada nos dois lugares baixaria duas vezes.

As integrações entram na fase 3, depois que a fase 2 migrar as vendas antigas
e o fluxo antigo sair de cena.
"""
from shared.exceptions import ResourceNotFound

from .models import Venda
from .repository import VendaRepository


class VendaService:
    """Orquestra as operações de venda."""

    @staticmethod
    def listar(empresa_id, filtros: dict | None = None):
        qs = VendaRepository.listar(empresa_id)
        filtros = filtros or {}

        if filtros.get("status_pagamento"):
            qs = qs.filter(status_pagamento=filtros["status_pagamento"])
        if filtros.get("cliente_id"):
            qs = qs.filter(cliente_id=filtros["cliente_id"])
        if filtros.get("data_inicio"):
            qs = qs.filter(data_venda__gte=filtros["data_inicio"])
        if filtros.get("data_fim"):
            qs = qs.filter(data_venda__lte=filtros["data_fim"])

        return qs

    @staticmethod
    def obter(empresa_id, venda_id) -> Venda:
        venda = VendaRepository.obter_por_id(empresa_id, venda_id)
        if not venda:
            raise ResourceNotFound("Venda", str(venda_id))
        return venda

    @staticmethod
    def criar(empresa_id, usuario_id, dados: dict) -> Venda:
        itens = dados.pop("itens")
        dados.pop("_subtotal_previsto", None)
        return VendaRepository.criar(empresa_id, usuario_id, dados, itens)
        # Fase 3: baixar estoque e lançar no financeiro a partir daqui.

    @staticmethod
    def atualizar(empresa_id, venda_id, dados: dict) -> Venda:
        venda = VendaService.obter(empresa_id, venda_id)
        itens = dados.pop("itens", None)
        dados.pop("_subtotal_previsto", None)
        return VendaRepository.atualizar(venda, dados, itens)
        # Fase 3: ajustar estoque e financeiro conforme a diferença.

    @staticmethod
    def deletar(empresa_id, venda_id) -> None:
        venda = VendaService.obter(empresa_id, venda_id)
        VendaRepository.deletar(venda)
        # Fase 3: estornar estoque e financeiro.
