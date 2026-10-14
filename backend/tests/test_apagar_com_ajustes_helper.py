"""
Synapse — O contrato de `shared.apagar_com_ajustes` (DUP-02).

Os três fluxos que apagam registro ajustando vínculos (venda, interação de
compra, compra de fornecedor) pararam de carregar cada um a sua cópia da ordem
e da transação: buscam as duas aqui. `test_apagar_com_ajustes_atomico.py`
continua provando que cada fluxo é atômico de ponta a ponta; este arquivo prova
o que o helper promete, para que a promessa não dependa de um dos chamadores
estar sendo testado.

Por que isso merece arquivo próprio: ao mutar o helper durante a Leva 6,
**inverter a ordem dos passos não quebrou nenhum teste**. Faz sentido que não
quebre — dentro de uma transação, duas escritas independentes dão no mesmo
resultado em qualquer ordem. Mas a ordem é parte do contrato escrito do módulo,
e contrato sem teste é comentário. Se um dia o ajuste do financeiro passar a
depender do que o estorno escreveu, a inversão vira defeito silencioso.
"""
from unittest.mock import patch

import pytest
from django.db import DatabaseError

from shared.apagar_com_ajustes import (
    AjustesFeitos,
    ajustar_lancamento_ao_apagar,
    apagar_com_ajustes,
)


# ════════════════════════════════════════════════════════════
# A ORDEM
# ════════════════════════════════════════════════════════════


def test_a_ordem_e_estoque_financeiro_apagar(db):
    """A ordem documentada, verificada pela sequência em que os passos correm."""
    passos = []

    apagar_com_ajustes(
        estornar_estoque=lambda: passos.append("estoque"),
        ajustar_financeiro=lambda: passos.append("financeiro"),
        apagar=lambda: passos.append("apagar"),
    )

    assert passos == ["estoque", "financeiro", "apagar"]


def test_apagar_vem_depois_mesmo_sem_os_outros_dois(db):
    """Com os dois passos opcionais ausentes, sobra o que dá nome à operação."""
    passos = []

    apagar_com_ajustes(apagar=lambda: passos.append("apagar"))

    assert passos == ["apagar"]


@pytest.mark.parametrize(
    "estoque,financeiro,esperado",
    [
        (True, False, ["estoque", "apagar"]),
        (False, True, ["financeiro", "apagar"]),
        (False, False, ["apagar"]),
        (True, True, ["estoque", "financeiro", "apagar"]),
    ],
)
def test_passo_ausente_e_pulado_sem_mudar_a_ordem_dos_outros(
    db, estoque, financeiro, esperado
):
    """
    `None` quer dizer "não se aplica", e a decisão fica em quem chama.

    O flag vem da tela, mas a condição é do domínio: a venda estorna N
    movimentações, a interação estorna uma só se o vínculo existir. O helper
    não tenta adivinhar isso — só respeita a ordem do que recebeu.
    """
    passos = []

    apagar_com_ajustes(
        estornar_estoque=(lambda: passos.append("estoque")) if estoque else None,
        ajustar_financeiro=(lambda: passos.append("financeiro")) if financeiro else None,
        apagar=lambda: passos.append("apagar"),
    )

    assert passos == esperado


# ════════════════════════════════════════════════════════════
# A TRANSAÇÃO
# ════════════════════════════════════════════════════════════


def test_falha_no_apagar_desfaz_os_passos_anteriores(db):
    """
    O caso que justifica o módulo existir.

    Medido com escrita real no banco, não com mock: o estorno de estoque é
    SOMAR de volta (a movimentação original é imutável), então um passo que
    sobrevive à falha dos seguintes infla o estoque sem jeito de desfazer pela
    tela.
    """
    from modules.auth.models import Empresa

    criadas = []

    def estornar():
        criadas.append(Empresa.objects.create(nome="Efeito do estorno", plano="pro"))
        return True

    def apagar():
        raise DatabaseError("falhou no último passo")

    with pytest.raises(DatabaseError):
        apagar_com_ajustes(estornar_estoque=estornar, apagar=apagar)

    # A escrita do primeiro passo aconteceu e foi revertida junto.
    assert len(criadas) == 1
    assert not Empresa.objects.filter(nome="Efeito do estorno").exists()


def test_falha_no_financeiro_desfaz_o_estorno(db):
    """A mesma garantia para o passo do meio."""
    from modules.auth.models import Empresa

    def estornar():
        Empresa.objects.create(nome="Estorno a reverter", plano="pro")
        return True

    with pytest.raises(DatabaseError):
        apagar_com_ajustes(
            estornar_estoque=estornar,
            ajustar_financeiro=lambda: (_ for _ in ()).throw(DatabaseError("boom")),
            apagar=lambda: None,
        )

    assert not Empresa.objects.filter(nome="Estorno a reverter").exists()


def test_caminho_normal_persiste(db):
    """O contraponto: sem falha, o que foi escrito fica."""
    from modules.auth.models import Empresa

    apagar_com_ajustes(
        estornar_estoque=lambda: Empresa.objects.create(
            nome="Fica no banco", plano="pro"
        ),
        apagar=lambda: None,
    )

    assert Empresa.objects.filter(nome="Fica no banco").exists()


# ════════════════════════════════════════════════════════════
# O QUE O HELPER DEVOLVE
# ════════════════════════════════════════════════════════════


def test_devolve_o_que_cada_passo_retornou(db):
    """
    Cada fluxo monta o resumo dele a partir disto.

    O formato não é achatado de propósito: a venda responde
    `movimentacoes_estornadas: int` e os outros dois `estoque_estornado: bool`,
    porque é o que as três APIs já prometeram. Unificar o formato aqui seria
    mudar três contratos para economizar três linhas.
    """
    feitos = apagar_com_ajustes(
        estornar_estoque=lambda: 3,
        ajustar_financeiro=lambda: "cancelado",
        apagar=lambda: None,
    )

    assert isinstance(feitos, AjustesFeitos)
    assert feitos.estoque == 3
    assert feitos.financeiro == "cancelado"


def test_passo_ausente_nao_inventa_resultado(db):
    feitos = apagar_com_ajustes(apagar=lambda: None)

    assert feitos.estoque is None
    assert feitos.financeiro is None


def test_os_callbacks_sao_por_palavra_chave(db):
    """
    Posicional não compila, e é de propósito.

    Três callbacks de mesma assinatura em posição seriam fáceis de trocar de
    lugar — e trocar `estornar_estoque` com `apagar` inverteria a ordem que
    este módulo existe para garantir, sem erro de tipo nenhum.
    """
    with pytest.raises(TypeError):
        apagar_com_ajustes(lambda: None)  # type: ignore[misc]


# ════════════════════════════════════════════════════════════
# O AJUSTE DO LANÇAMENTO
# ════════════════════════════════════════════════════════════


class _LancamentoFalso:
    """Só o que `ajustar_lancamento_ao_apagar` toca."""

    def __init__(self, status):
        self.status = status
        self.salvo_com = None

    def save(self, update_fields=None):
        self.salvo_com = update_fields


def test_lancamento_pago_e_cancelado_nao_apagado(db):
    """
    Imutabilidade do histórico: pago não se reescreve.

    A assimetria é regra do módulo financeiro, e estava escrita três vezes.
    """
    lancamento = _LancamentoFalso("pago")

    with patch(
        "modules.financeiro.repository.FinanceiroRepository.deletar_lancamento"
    ) as deletar:
        acao = ajustar_lancamento_ao_apagar(lancamento)

    assert acao == "cancelado"
    assert lancamento.status == "cancelado"
    assert lancamento.salvo_com == ["status"]
    assert not deletar.called


@pytest.mark.parametrize("status", ["pendente", "atrasado", "cancelado"])
def test_lancamento_nao_pago_e_apagado(db, status):
    lancamento = _LancamentoFalso(status)

    with patch(
        "modules.financeiro.repository.FinanceiroRepository.deletar_lancamento"
    ) as deletar:
        acao = ajustar_lancamento_ao_apagar(lancamento)

    assert acao == "apagado"
    deletar.assert_called_once_with(lancamento)


def test_o_ajuste_nao_invalida_cache(db):
    """
    Invalidar cache daqui seria invalidar de dentro da transação.

    A cópia de `clientes` fazia isso, e o fluxo de `vendas` já documentava por
    que é errado: uma reversão depois disso deixa o cache limpo para um estado
    que não existiu. Quem chama invalida depois, com os módulos que tocou.
    """
    lancamento = _LancamentoFalso("pago")

    with patch("shared.cache.invalidate_cache") as invalidar:
        ajustar_lancamento_ao_apagar(lancamento)

    assert not invalidar.called
