"""
Synapse — A data de hoje é a de São Paulo, não a de UTC (B9).

O servidor roda em UTC e o `TIME_ZONE` do projeto é `America/Sao_Paulo`.
`date.today()` lê o relógio do SO; `timezone.localdate()` lê o fuso do
projeto. Das 21:00 à meia-noite em São Paulo os dois discordam — e no dia 31
discordam de MÊS.

O que isso fazia, medido no diagnóstico (`RELATORIO_METRICAS_VENDA.md`): uma
venda registrada às 21:30 de 31/10 nascia com `data_venda = 2031-11-01`. Ela
sumia do filtro "hoje" da lista de vendas e, pelo lançamento financeiro que
herda `data_venda` como vencimento, entrava em NOVEMBRO no fluxo de caixa.

O ANO É 2031 DE PROPÓSITO. Com uma data próxima de hoje, `date.today()`
devolveria o mesmo mês que o relógio congelado e metade deste arquivo passaria
sem medir nada — foi o que aconteceu na primeira versão, e só apareceu ao
reintroduzir o defeito. Um ano distante garante que qualquer leitura do
relógio do SO caia num mês que nenhuma asserção aqui aceita.

O instante usado em todo este arquivo é sempre o mesmo, e é o pior possível:

    2031-11-01 00:30 UTC  ==  2031-10-31 21:30 em São Paulo

Um mês, um dia e um ano de diferença entre as duas leituras no caso da
virada de ano — por isso o teste de Ano-Novo no fim.
"""
from datetime import date, datetime, timezone as dtz
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.utils import timezone

from modules.auth.models import CustomUser, Empresa
from modules.clientes.models import Cliente
from modules.financeiro.models import Lancamento
from modules.vendas.models import Venda
from modules.vendas.services import VendaService

# 21:30 de 31/10 em São Paulo. Em UTC já é dia 1º de novembro.
FIM_DE_EXPEDIENTE = datetime(2031, 11, 1, 0, 30, tzinfo=dtz.utc)


@pytest.fixture
def relogio_virado():
    """Congela o relógio no instante em que UTC e São Paulo discordam."""
    with patch("django.utils.timezone.now", return_value=FIM_DE_EXPEDIENTE):
        yield


@pytest.fixture
def empresa(db):
    return Empresa.objects.create(nome="Loja que fecha tarde", plano="pro")


@pytest.fixture
def usuario(db, empresa):
    return CustomUser.objects.create_user(
        email="dono@loja.com", nome="Dono", senha="Senha@12345",
        empresa=empresa, perfil="admin",
    )


@pytest.fixture
def ana(db, empresa):
    return Cliente.objects.create(empresa=empresa, nome="Ana")


def _venda(empresa, usuario, cliente=None, total="450.00", **extra):
    dados = {
        "cliente": cliente,
        "desconto": Decimal("0"),
        "forma_pagamento": "dinheiro",
        "status_pagamento": "pago",
        "itens": [{"produto": None, "descricao": "Serviço",
                   "quantidade": Decimal("1"),
                   "preco_unitario": Decimal(total)}],
    }
    dados.update(extra)
    return VendaService.criar(empresa.id, usuario.id, dados)


# ════════════════════════════════════════════════════════════
# O INSTANTE QUE QUEBRAVA
# ════════════════════════════════════════════════════════════


def test_o_instante_do_teste_realmente_separa_os_dois_fusos(relogio_virado):
    """
    O teste antes do teste.

    Sem isto, uma mudança de `TIME_ZONE` tornaria todos os outros verdes por
    não haver mais discordância nenhuma para detectar — e eles continuariam
    passando sem medir coisa alguma.
    """
    assert timezone.now().date() == date(2031, 11, 1)      # UTC
    assert timezone.localdate() == date(2031, 10, 31)      # São Paulo
    assert timezone.localdate().month == 10


def test_venda_das_21h30_nasce_com_a_data_de_hoje_em_sao_paulo(
    relogio_virado, empresa, usuario, ana
):
    """O caso do relato: 31/10 às 21:30, e a venda é de 31/10."""
    venda = _venda(empresa, usuario, ana)

    assert venda.data_venda == date(2031, 10, 31)
    assert venda.data_venda.month == 10


def test_a_venda_aparece_em_outubro_e_nao_em_novembro(
    relogio_virado, empresa, usuario, ana
):
    """O efeito que o usuário vê: o mês em que a venda é contada."""
    _venda(empresa, usuario, ana)

    outubro = Venda.objects.filter(
        empresa=empresa, data_venda__year=2031, data_venda__month=10
    ).count()
    novembro = Venda.objects.filter(
        empresa=empresa, data_venda__year=2031, data_venda__month=11
    ).count()

    assert (outubro, novembro) == (1, 0)


def test_a_venda_entra_no_filtro_de_hoje_da_lista(
    relogio_virado, empresa, usuario, ana
):
    """
    `data_inicio`/`data_fim` são os filtros da tela de Vendas.

    Com a data em UTC a venda nascia fora da própria janela de hoje: quem
    acabou de registrá-la não a via na lista.
    """
    _venda(empresa, usuario, ana)
    hoje = timezone.localdate()

    achadas = VendaService.listar(
        empresa.id, {"data_inicio": hoje, "data_fim": hoje}
    ).count()

    assert achadas == 1


# ════════════════════════════════════════════════════════════
# O LANÇAMENTO, QUE HERDA A DATA
# ════════════════════════════════════════════════════════════


def test_o_lancamento_da_venda_fica_em_outubro(
    relogio_virado, empresa, usuario, ana
):
    """
    O caminho pelo qual o B9 chegava ao dashboard.

    `lancar_financeiro` grava `data_vencimento = data_prevista or data_venda
    or hoje` e `data_pagamento = hoje`. Os três vinham errados ao mesmo tempo,
    e o fluxo de caixa do dashboard lê o Lançamento, não a Venda.
    """
    venda = _venda(empresa, usuario, ana)
    lancamento = VendaService.lancar_financeiro(empresa.id, usuario.id, venda.id)

    assert lancamento.data_vencimento == date(2031, 10, 31)
    assert lancamento.data_pagamento == date(2031, 10, 31)
    assert lancamento.data_pagamento.month == 10


def test_o_resumo_do_financeiro_de_outubro_enxerga_a_receita(
    relogio_virado, empresa, usuario, ana
):
    """O número que o fechamento do mês usa."""
    from modules.financeiro.repository import FinanceiroRepository

    venda = _venda(empresa, usuario, ana)
    VendaService.lancar_financeiro(empresa.id, usuario.id, venda.id)

    outubro = FinanceiroRepository.calcular_resumo(empresa.id, 10, 2031)
    novembro = FinanceiroRepository.calcular_resumo(empresa.id, 11, 2031)

    assert outubro["total_receitas"] == Decimal("450.00")
    assert novembro["total_receitas"] == Decimal("0")


# ════════════════════════════════════════════════════════════
# OS MESES PADRÃO: QUAL MÊS A TELA ABRE
# ════════════════════════════════════════════════════════════


def test_o_mes_padrao_do_financeiro_e_o_mes_local(
    relogio_virado, empresa, usuario, ana
):
    """
    Sem `?mes=`, a tela do financeiro abre no mês local — pela view mesmo.

    Errada, ela abria em NOVEMBRO às 21:30 de 31/10: o caixa que a pessoa
    acabou de fechar aparecia vazio, no mês seguinte ao que ela está vendo
    no relógio.
    """
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import RefreshToken

    # A receita tem data EXPLÍCITA, não vinda do relógio: assim o que o teste
    # mede é só em que mês a view abre, sem que o dado se mova junto com ela.
    Lancamento.objects.create(
        empresa=empresa, tipo="receita", descricao="Venda de 31/10",
        valor=Decimal("450.00"), status="pago",
        data_vencimento=date(2031, 10, 31), data_pagamento=date(2031, 10, 31),
    )

    cliente_api = APIClient()
    cliente_api.cookies["access_token"] = str(
        RefreshToken.for_user(usuario).access_token
    )

    with patch("django.utils.timezone.now", return_value=FIM_DE_EXPEDIENTE):
        resposta = cliente_api.get("/api/financeiro/resumo/")

    assert resposta.status_code == 200
    # Sem `?mes=`, a tela abriu em 10/2031 e achou a receita. Lendo o relógio
    # do SO ela abriria no mês real e devolveria zero.
    assert Decimal(str(resposta.data["data"]["total_receitas"])) == Decimal("450.00")


def test_novos_clientes_deste_mes_conta_outubro(relogio_virado, empresa):
    """
    `calcular_resumo` do CRM monta `inicio_mes = hoje.replace(day=1)`.

    Com a data em UTC o início virava 01/11, e "novos este mês" zerava para
    todos os clientes de outubro — inclusive os cadastrados minutos antes.
    """
    from modules.clientes.repository import ClienteRepository

    # Um de setembro e um de outubro. São os DOIS que separam a conta certa
    # da errada: lendo o relógio do SO, `inicio_mes` cai num mês real muito
    # anterior a 2031 e os dois entram na conta.
    setembro = datetime(2031, 9, 20, 15, 0, tzinfo=dtz.utc)
    with patch("django.utils.timezone.now", return_value=setembro):
        Cliente.objects.create(empresa=empresa, nome="Entrou em setembro")
    Cliente.objects.create(empresa=empresa, nome="Entrou em outubro")

    resumo = ClienteRepository.calcular_resumo(empresa.id)

    assert resumo["novos_este_mes"] == 1


# ════════════════════════════════════════════════════════════
# A VIRADA DE ANO: O MESMO DEFEITO, MAIS CARO
# ════════════════════════════════════════════════════════════


def test_venda_do_reveillon_nao_pula_para_o_ano_seguinte(empresa, usuario, ana):
    """
    31/12 às 21:30 em São Paulo é 01/01 em UTC: ano errado, não só mês.

    É o mesmo defeito do resto do arquivo, e está separado porque o estrago
    é de outra ordem — uma venda contada no exercício seguinte não é um
    relatório torto, é um fechamento anual torto.
    """
    reveillon = datetime(2032, 1, 1, 0, 30, tzinfo=dtz.utc)

    with patch("django.utils.timezone.now", return_value=reveillon):
        venda = _venda(empresa, usuario, ana)
        lancamento = VendaService.lancar_financeiro(
            empresa.id, usuario.id, venda.id
        )

    assert venda.data_venda == date(2031, 12, 31)
    assert lancamento.data_pagamento == date(2031, 12, 31)
    assert venda.data_venda.year == 2031


# ════════════════════════════════════════════════════════════
# O MEIO DO DIA CONTINUA IGUAL
# ════════════════════════════════════════════════════════════


def test_as_duas_leituras_concordam_no_meio_do_dia(empresa, usuario, ana):
    """
    O contraponto: fora da janela das 21h a correção não muda nada.

    Sem este teste, trocar `localdate()` por qualquer constante deixaria os
    outros verdes — e este é o que exige que a função continue lendo o
    relógio de verdade.
    """
    meio_dia = datetime(2031, 10, 31, 15, 0, tzinfo=dtz.utc)  # 12:00 em SP

    with patch("django.utils.timezone.now", return_value=meio_dia):
        venda = _venda(empresa, usuario, ana)
        assert timezone.now().date() == timezone.localdate()
        assert venda.data_venda == date(2031, 10, 31)


def test_data_informada_pela_pessoa_manda_mais_que_o_relogio(
    relogio_virado, empresa, usuario, ana
):
    """
    Lançar hoje uma venda de ontem continua possível.

    O default só vale quando ninguém disse a data — e é importante que o
    conserto não tenha transformado o default em imposição.
    """
    venda = _venda(empresa, usuario, ana, data_venda=date(2031, 10, 20))

    assert venda.data_venda == date(2031, 10, 20)
