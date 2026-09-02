"""
Synapse — Vendas: Services (regras de negócio).

FASE 3A — as integrações entram aqui, e as duas PERGUNTAM antes de agir. Criar
uma venda não baixa estoque nem lança financeiro sozinha: quem decide é a
pessoa, na tela, como sempre foi no fluxo antigo de InteracaoCliente. O que
muda é só de onde a ação parte.

Duas guardas sustentam esta fase, e existem por causa das 22 vendas que a fase
2 migrou:

1. VENDA MIGRADA JÁ TEM LANÇAMENTO. O campo lancamento_financeiro veio copiado
   da interação original — aquela receita já está no caixa. Lançar de novo
   duplicaria dinheiro que já foi contado.
2. VENDA MIGRADA NÃO TEM PRODUTO. Os itens migrados são livres (produto nulo),
   porque a interação antiga não guardava o vínculo. Baixa de estoque só existe
   para item COM produto — item livre é serviço ou venda velha, e não tem o que
   descontar.

As duas guardas não são defensivas por precaução: são o que impede a migração
que bateu ao centavo de virar financeiro duplicado.
"""
from decimal import Decimal

from shared.cache import invalidate_cache
from shared.exceptions import BusinessRuleViolation, ResourceNotFound

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
        # As integrações NÃO acontecem aqui. Quem baixa estoque e quem lança no
        # financeiro é a pessoa, pelos endpoints abaixo, depois de ver o que vai
        # acontecer. Automatizar aqui tiraria dela a decisão.
        return VendaRepository.criar(empresa_id, usuario_id, dados, itens)

    @staticmethod
    def atualizar(empresa_id, venda_id, dados: dict) -> Venda:
        venda = VendaService.obter(empresa_id, venda_id)
        itens = dados.pop("itens", None)
        dados.pop("_subtotal_previsto", None)
        return VendaRepository.atualizar(venda, dados, itens)

    @staticmethod
    def deletar(empresa_id, venda_id) -> None:
        venda = VendaService.obter(empresa_id, venda_id)
        VendaRepository.deletar(venda)

    # ── Integração 1: estoque ────────────────────────────────────────────────

    @staticmethod
    def _itens_com_produto(venda: Venda) -> list:
        """
        Os itens que podem baixar estoque.

        Item livre não tem produto e portanto não tem de onde descontar. É o
        caso de todas as vendas migradas na fase 2, e é o caso de qualquer
        serviço vendido.
        """
        return [item for item in venda.itens.all() if item.produto_id]

    @staticmethod
    def ja_baixou_estoque(venda: Venda) -> bool:
        """A venda já gerou movimentação? É a marca de idempotência."""
        return venda.movimentacoes.exists()

    @staticmethod
    def previa_estoque(empresa_id, venda_id) -> dict:
        """
        O que aconteceria com o estoque se a venda baixasse agora.

        Existe para a pessoa ver ANTES de confirmar: cada produto, quanto tem e
        com quanto fica. Não grava nada.
        """
        venda = VendaService.obter(empresa_id, venda_id)
        itens = VendaService._itens_com_produto(venda)

        linhas = []
        for item in itens:
            produto = item.produto
            depois = produto.estoque_atual - item.quantidade
            linhas.append(
                {
                    "item_id": str(item.id),
                    "produto_id": str(produto.id),
                    "produto_nome": produto.nome,
                    "quantidade": str(item.quantidade),
                    "estoque_antes": str(produto.estoque_atual),
                    "estoque_depois": str(depois),
                    "suficiente": produto.estoque_atual >= item.quantidade,
                }
            )

        return {
            "ja_baixou": VendaService.ja_baixou_estoque(venda),
            # Zero itens com produto = venda só de item livre. A tela não deve
            # nem oferecer a baixa.
            "tem_itens_com_produto": bool(itens),
            "itens": linhas,
        }

    @staticmethod
    def baixar_estoque(empresa_id, usuario_id, venda_id, parcial=False) -> list:
        """
        Gera as saídas de estoque de uma venda, uma por item COM produto.

        - Item livre é ignorado: não tem produto, não toca estoque.
        - Idempotente: se a venda já baixou, recusa em vez de baixar de novo.
        - Estoque insuficiente: mesmo comportamento do fluxo antigo — recusa
          com o saldo nos details para a tela oferecer baixar o que há. Com
          parcial=True, baixa o saldo disponível de quem não tem tudo.
        """
        from django.db import transaction

        from modules.estoque.services import EstoqueService

        venda = VendaService.obter(empresa_id, venda_id)

        if VendaService.ja_baixou_estoque(venda):
            raise BusinessRuleViolation(
                code="VENDA_JA_BAIXADA",
                message="Esta venda já baixou o estoque.",
            )

        itens = VendaService._itens_com_produto(venda)
        if not itens:
            # Não é erro do usuário: é uma venda que não tem o que descontar.
            # Dizer isso é melhor do que criar zero movimentações em silêncio.
            raise BusinessRuleViolation(
                code="VENDA_SEM_PRODUTO",
                message="Esta venda não tem item com produto — não há estoque a baixar.",
            )

        if not parcial:
            faltantes = [
                {
                    "produto_nome": item.produto.nome,
                    "solicitado": str(item.quantidade),
                    "saldo_atual": str(item.produto.estoque_atual),
                }
                for item in itens
                if item.produto.estoque_atual < item.quantidade
            ]
            if faltantes:
                raise BusinessRuleViolation(
                    code="ESTOQUE_INSUFICIENTE",
                    message="Estoque insuficiente para um ou mais itens.",
                    details={"itens": faltantes},
                )

        referencia = (
            f"Venda para {venda.cliente.nome}" if venda.cliente_id else "Venda de balcão"
        )

        # Ou todas as saídas acontecem, ou nenhuma: uma venda meio baixada é
        # pior do que uma não baixada, porque ninguém sabe onde parou.
        movimentacoes = []
        with transaction.atomic():
            for item in itens:
                quantidade = item.quantidade
                if parcial:
                    quantidade = min(quantidade, item.produto.estoque_atual)
                if quantidade <= 0:
                    continue
                movimentacao, _ = EstoqueService.registrar_movimentacao(
                    empresa_id=empresa_id,
                    usuario_id=usuario_id,
                    dados={
                        "produto": item.produto_id,
                        "tipo": "saida",
                        "quantidade": quantidade,
                        "motivo": "venda",
                        "preco_unitario": item.preco_unitario,
                        "referencia": referencia,
                        "observacoes": f"Venda #{venda.id}",
                        "venda": venda,
                    },
                )
                movimentacoes.append(movimentacao)

        return movimentacoes

    @staticmethod
    def estornar_estoque(empresa_id, usuario_id, venda: Venda, motivo="") -> int:
        """
        Devolve ao estoque o que a venda baixou, criando a movimentação inversa.

        A movimentação original é imutável (regra do módulo de estoque), então
        estornar é somar de volta, não apagar o registro.
        """
        from modules.estoque.services import EstoqueService

        movimentacoes = list(venda.movimentacoes.all())
        for movimentacao in movimentacoes:
            EstoqueService.estornar_movimentacao(
                empresa_id,
                movimentacao.id,
                usuario_id,
                motivo_estorno=motivo or f"Venda #{venda.id} apagada",
            )
        return len(movimentacoes)

    # ── Integração 2: financeiro ─────────────────────────────────────────────

    @staticmethod
    def lancar_financeiro(empresa_id, usuario_id, venda_id):
        """
        Cria o lançamento de receita da venda e guarda o vínculo.

        A guarda que importa: venda que JÁ tem lançamento não gera outro. É o
        que protege as vendas migradas na fase 2 — elas nasceram com o
        lancamento_financeiro copiado da interação original, e aquela receita
        já está lançada. Um segundo lançamento contaria o mesmo dinheiro duas
        vezes.
        """
        from datetime import date

        from modules.financeiro.services import FinanceiroService

        venda = VendaService.obter(empresa_id, venda_id)

        if venda.lancamento_financeiro_id:
            raise BusinessRuleViolation(
                code="VENDA_JA_COM_LANCAMENTO",
                message="Esta venda já tem lançamento financeiro.",
            )

        if venda.total is None or venda.total <= Decimal("0"):
            raise BusinessRuleViolation(
                code="VENDA_SEM_VALOR",
                message="Venda sem valor não gera receita.",
            )

        hoje = date.today()
        pago = venda.status_pagamento == "pago"
        quem = venda.cliente.nome if venda.cliente_id else "balcão"

        lancamento = FinanceiroService.criar_lancamento(
            empresa_id,
            usuario_id,
            {
                "tipo": "receita",
                "descricao": f"Venda - {quem}",
                "valor": venda.total,
                "data_vencimento": venda.data_prevista_pagamento or venda.data_venda or hoje,
                "data_pagamento": hoje if pago else None,
                "status": "pago" if pago else "pendente",
                "observacoes": f"Referente à venda #{venda.id}",
            },
        )

        venda.lancamento_financeiro = lancamento
        venda.save(update_fields=["lancamento_financeiro", "atualizado_em"])
        invalidate_cache(empresa_id, "financeiro")
        return lancamento

    @staticmethod
    def apagar_com_ajustes(
        empresa_id, usuario_id, venda_id,
        estornar_estoque=False, apagar_financeiro=False,
    ) -> dict:
        """
        Apaga a venda ajustando os vínculos: estoque → financeiro → venda.

        Mesma mecânica do fluxo antigo (`apagar_interacao_com_ajustes`): o
        estoque volta por movimentação inversa, e o lançamento pendente é
        apagado enquanto o pago é cancelado — pago é histórico, não se reescreve.

        Tudo dentro de uma transação só. É a diferença deliberada em relação ao
        fluxo antigo: lá, uma falha no meio deixava o estoque devolvido e a
        interação viva, e ninguém descobria até conferir. Aqui, ou os três
        passos acontecem, ou nenhum acontece.
        """
        from django.db import transaction

        from modules.financeiro.repository import FinanceiroRepository

        venda = VendaService.obter(empresa_id, venda_id)
        resumo = {"movimentacoes_estornadas": 0, "financeiro_ajustado": None}

        with transaction.atomic():
            if estornar_estoque:
                resumo["movimentacoes_estornadas"] = VendaService.estornar_estoque(
                    empresa_id, usuario_id, venda, motivo=f"Venda #{venda.id} apagada"
                )

            if apagar_financeiro and venda.lancamento_financeiro_id:
                lancamento = venda.lancamento_financeiro
                if lancamento.status == "pago":
                    lancamento.status = "cancelado"
                    lancamento.save(update_fields=["status"])
                    resumo["financeiro_ajustado"] = "cancelado"
                else:
                    FinanceiroRepository.deletar_lancamento(lancamento)
                    resumo["financeiro_ajustado"] = "apagado"

            VendaRepository.deletar(venda)

        # Fora da transação: invalidar cache do que não foi confirmado seria
        # invalidar à toa, e invalidar dentro de um bloco que pode reverter
        # deixaria o cache limpo para um estado que não aconteceu.
        if resumo["financeiro_ajustado"]:
            invalidate_cache(empresa_id, "financeiro")
        return resumo
