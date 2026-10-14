"""
Synapse — "Apagar com ajustes": a ordem e a transação, em um lugar só.

Três fluxos do sistema apagam um registro ajustando os vínculos: a venda
(`vendas`), a interação de compra (`clientes`) e a compra de fornecedor
(`fornecedores`). Os três fazem a mesma coisa, na mesma ordem:

    estornar estoque → ajustar financeiro → apagar o registro

E os três precisam que isso seja tudo ou nada, por uma razão específica deste
domínio: a movimentação de estoque é IMUTÁVEL por regra do módulo, então
estornar não é apagar — é somar de volta. Uma falha depois do estorno deixa o
estoque alto com o registro ainda vivo, e repetir a operação soma outra vez.
Não existe desfazer pela tela.

POR QUE ISTO EXISTE (DUP-02)

Os três já são atômicos. O de `vendas` sempre foi; os outros dois ganharam a
transação na Leva 1, depois de o `ERR-06` mostrar que tinham nascido da mesma
ideia e ficado sem ela. O que sobrava era o motivo pelo qual isso aconteceu:
**três cópias**. O quarto módulo a copiar o padrão copiaria de uma delas, e
nada garantia que copiasse a parte que protege.

Então a transação deixou de ser algo que cada cópia lembra de escrever e
passou a ser o que este helper **é**. Não se usa este módulo e esquece a
transação: a única forma de rodar os três passos por aqui é dentro dela.

O QUE FICA DE FORA, DE PROPÓSITO

- **Buscar o registro** (e o 404 multi-tenant) é de quem chama: cada módulo
  tem o seu repository e a sua regra de escopo.
- **Decidir se estorna** (`estornar_estoque and registro.movimentacao_id`)
  também. O flag vem da tela, mas a condição é do domínio — a venda estorna
  N movimentações, a interação estorna uma só se existir.
- **Invalidar cache** fica fora da transação, e por isso fora daqui: quem
  chama sabe quais módulos a operação dele toca. Invalidar dentro de um bloco
  que pode reverter deixaria o cache limpo para um estado que não aconteceu.
- **A forma do resumo.** Cada fluxo responde no formato que a API dele já
  prometeu (`movimentacoes_estornadas: int` na venda, `estoque_estornado: bool`
  nos outros). Achatar isso num formato único seria mudar três contratos de
  API para economizar três linhas.
"""
from dataclasses import dataclass
from typing import Any, Callable, Optional

from django.db import transaction


@dataclass
class AjustesFeitos:
    """
    O que cada passo devolveu, para quem chamou montar o próprio resumo.

    `estoque` é o que o callback de estorno devolveu, tal como veio — contagem
    de movimentações na venda, `True` nos fluxos de uma movimentação só.
    `financeiro` é `"apagado"`, `"cancelado"` ou `None`.
    """

    estoque: Any = None
    financeiro: Optional[str] = None


def apagar_com_ajustes(
    *,
    apagar: Callable[[], Any],
    estornar_estoque: Optional[Callable[[], Any]] = None,
    ajustar_financeiro: Optional[Callable[[], Optional[str]]] = None,
) -> AjustesFeitos:
    """
    Roda os três passos na ordem, numa transação só.

    Passar `None` num callback é como se diz "este passo não se aplica" — o
    flag da tela e a checagem do vínculo ficam em quem chama, porque a
    condição é do domínio dele. Só `apagar` é obrigatório: é o que dá nome à
    operação.

    Os argumentos são por palavra-chave de propósito. Três callbacks de mesma
    assinatura, posicionais, seriam fáceis de trocar de lugar — e trocar
    `estornar_estoque` com `apagar` inverteria a ordem que este módulo existe
    para garantir, sem erro de tipo nenhum.
    """
    feitos = AjustesFeitos()

    with transaction.atomic():
        if estornar_estoque is not None:
            feitos.estoque = estornar_estoque()

        if ajustar_financeiro is not None:
            feitos.financeiro = ajustar_financeiro()

        apagar()

    return feitos


def ajustar_lancamento_ao_apagar(lancamento) -> str:
    """
    Pendente → apaga. Pago → cancela. Devolve qual dos dois foi.

    A assimetria é regra do módulo financeiro, não conveniência: lançamento
    pago é histórico e não se reescreve, então ele é cancelado em vez de
    removido. Estava escrita três vezes, idêntica nas três.

    NÃO invalida cache. A cópia de `clientes` invalidava, e invalidava de
    dentro da transação — exatamente o que o fluxo de `vendas` documenta como
    errado, porque uma reversão depois disso deixa o cache limpo para um
    estado que não existiu. Quem chama invalida depois, com os módulos que
    sabe que tocou.
    """
    from modules.financeiro.repository import FinanceiroRepository

    if lancamento.status == "pago":
        lancamento.status = "cancelado"
        lancamento.save(update_fields=["status"])
        return "cancelado"

    FinanceiroRepository.deletar_lancamento(lancamento)
    return "apagado"
