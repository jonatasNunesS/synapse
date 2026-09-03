"""
Synapse — Vendas: fiado (fase 3B).

Espelha o fiado que o fluxo antigo de interação já tinha: notificação no dia,
e três respostas — confirmar, adiar, cancelar. O que muda é o que a Venda
permite dizer a mais: ela sabe quanto já entrou, e por isso o recebimento
parcial não precisa inventar um segundo registro.

Duas coisas aqui não são conveniência, são o que impede estrago:

1. NENHUMA venda que já existia é cobrada. A migração 0005 marca todas como
   avisadas. Sem isso, o primeiro dia com o fiado ligado varreria o passado e
   despejaria de uma vez a cobrança das 22 vendas migradas na fase 2 — uma
   delas com o status convertido de "cancelado" para "pendente" justamente
   porque não havia equivalente.
2. O financeiro não duplica. Recebimento parcial parte o recebível em dois
   pedaços que somam o mesmo, e o vínculo da venda aponta sempre para o que
   ainda se cobra.
"""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa
from modules.clientes.models import Cliente, InteracaoCliente
from modules.estoque.models import CategoriaEstoque, Produto
from modules.financeiro.models import Categoria, Lancamento
from modules.notificacoes.models import Notificacao
from modules.vendas.models import Venda
from modules.vendas.services import VendaService


# ── Cenário ──────────────────────────────────────────────────────────────────

@pytest.fixture
def empresa(db):
    return Empresa.objects.create(nome="Loja da Esquina", plano="pro")


@pytest.fixture
def outra_empresa(db):
    return Empresa.objects.create(nome="Concorrente", plano="pro")


@pytest.fixture
def usuario(db, empresa):
    return CustomUser.objects.create_user(
        email="dono@loja.com", nome="Dono", senha="Senha@12345",
        empresa=empresa, perfil="admin",
    )


@pytest.fixture
def usuario_outra(db, outra_empresa):
    return CustomUser.objects.create_user(
        email="dono@concorrente.com", nome="Outro", senha="Senha@12345",
        empresa=outra_empresa, perfil="admin",
    )


@pytest.fixture
def cliente(db, empresa):
    return Cliente.objects.create(empresa=empresa, nome="Maria Souza")


@pytest.fixture
def camisa(db, empresa, usuario):
    categoria = CategoriaEstoque.objects.create(empresa=empresa, nome="Roupas")
    return Produto.objects.create(
        empresa=empresa, categoria=categoria, nome="Camisa", sku="SKU-CAMISA",
        preco_custo=Decimal("10.00"), preco_venda=Decimal("50.00"),
        estoque_atual=Decimal("10"), estoque_minimo=Decimal("1"),
        criado_por=usuario,
    )


def _client(user):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(user).access_token)
    return c


def _item(produto, quantidade="1", preco=None):
    dados = {"produto": str(produto.id), "quantidade": quantidade}
    if preco is not None:
        dados["preco_unitario"] = preco
    return dados


def hoje():
    return timezone.localdate()


def _venda_fiada(usuario, camisa, dias=0, preco="100.00", **extra):
    """Uma venda a prazo que vence daqui a `dias` (0 = hoje, negativo = venceu)."""
    corpo = {
        "itens": [_item(camisa, "1", preco)],
        "status_pagamento": "pendente",
        "data_prevista_pagamento": str(hoje() + timedelta(days=dias)),
    }
    corpo.update(extra)
    resp = _client(usuario).post("/api/vendas/", corpo, format="json")
    assert resp.status_code == 201, resp.json()
    return resp.json()["data"]


# ── Venda a prazo exige previsão ─────────────────────────────────────────────

@pytest.mark.django_db
def test_venda_pendente_sem_previsao_e_recusada(usuario, camisa):
    """Sem data não há dia para cobrar — a venda ficaria pendente para sempre."""
    resp = _client(usuario).post(
        "/api/vendas/",
        {"itens": [_item(camisa, "1", "100.00")], "status_pagamento": "pendente"},
        format="json",
    )

    assert resp.status_code == 400
    assert "data_prevista_pagamento" in resp.json()["error"]["details"]


@pytest.mark.django_db
def test_venda_paga_nao_precisa_de_previsao(usuario, camisa):
    resp = _client(usuario).post(
        "/api/vendas/",
        {"itens": [_item(camisa, "1", "100.00")], "status_pagamento": "pago"},
        format="json",
    )

    assert resp.status_code == 201


# ── A notificação do dia ─────────────────────────────────────────────────────

@pytest.mark.django_db
def test_venda_fiada_notifica_no_dia_previsto(usuario, camisa, cliente):
    _venda_fiada(usuario, camisa, dias=0, cliente=str(cliente.id))

    assert VendaService.notificar_vendas_fiado() == 1

    notificacao = Notificacao.objects.get()
    assert "Maria Souza" in notificacao.titulo
    assert notificacao.prioridade == "alta"
    # O link leva à venda com a cobrança aberta, como o fiado antigo faz.
    assert "fiado=" in notificacao.acao_url


@pytest.mark.django_db
def test_venda_que_ainda_nao_venceu_nao_notifica(usuario, camisa):
    _venda_fiada(usuario, camisa, dias=5)

    assert VendaService.notificar_vendas_fiado() == 0
    assert Notificacao.objects.count() == 0


@pytest.mark.django_db
def test_venda_vencida_notifica(usuario, camisa):
    """Atrasada também é cobrada — a passada varre tudo que já venceu."""
    _venda_fiada(usuario, camisa, dias=-3)

    assert VendaService.notificar_vendas_fiado() == 1


@pytest.mark.django_db
def test_notifica_uma_vez_so(usuario, camisa):
    _venda_fiada(usuario, camisa, dias=0)

    assert VendaService.notificar_vendas_fiado() == 1
    assert VendaService.notificar_vendas_fiado() == 0
    assert Notificacao.objects.count() == 1


@pytest.mark.django_db
def test_venda_paga_nunca_entra_na_cobranca(usuario, camisa):
    _client(usuario).post(
        "/api/vendas/",
        {"itens": [_item(camisa, "1", "100.00")], "status_pagamento": "pago"},
        format="json",
    )

    assert VendaService.notificar_vendas_fiado() == 0


# ── Fiado sem cliente ────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_venda_sem_cliente_fiada_notifica(usuario, camisa):
    """Balcão também fia. A cobrança diz o que dá para dizer: valor e data."""
    _venda_fiada(usuario, camisa, dias=0)

    assert VendaService.notificar_vendas_fiado() == 1
    notificacao = Notificacao.objects.get()
    assert "venda" in notificacao.titulo.lower()


@pytest.mark.django_db
def test_devedor_da_nome_a_cobranca_do_balcao(usuario, camisa):
    """
    O rótulo livre não cadastra ninguém — só faz a cobrança lembrar quem é.

    "João da feira ficou de pagar hoje" é acionável; "uma venda vence hoje"
    obriga a pessoa a abrir a tela para descobrir de quem cobrar.
    """
    _venda_fiada(usuario, camisa, dias=0, devedor="João da feira")

    VendaService.notificar_vendas_fiado()

    notificacao = Notificacao.objects.get()
    assert "João da feira" in notificacao.titulo
    assert "João da feira" in notificacao.mensagem


@pytest.mark.django_db
def test_cliente_cadastrado_tem_prioridade_sobre_o_rotulo(usuario, camisa, cliente):
    _venda_fiada(
        usuario, camisa, dias=0, cliente=str(cliente.id), devedor="apelido qualquer"
    )

    VendaService.notificar_vendas_fiado()

    assert "Maria Souza" in Notificacao.objects.get().titulo


# ── Confirmar ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_confirmar_recebimento_total_quita_a_venda(usuario, camisa):
    venda = _venda_fiada(usuario, camisa, dias=0)

    resp = _client(usuario).post(
        f"/api/vendas/{venda['id']}/confirmar-pagamento/", {}, format="json"
    )

    assert resp.status_code == 200
    dados = resp.json()["data"]
    assert dados["quitou"] is True
    assert dados["venda"]["status_pagamento"] == "pago"
    assert Decimal(dados["saldo_devedor"]) == Decimal("0")


@pytest.mark.django_db
def test_confirmar_faz_o_lancamento_pendente_virar_pago(usuario, camisa):
    """
    A diferença que a venda tem e a interação não tinha.

    No fluxo antigo, confirmar o fiado não encostava no lançamento vinculado:
    a venda virava paga e o caixa continuava mostrando a receita como a
    receber. Aqui as duas pontas andam juntas.
    """
    venda = _venda_fiada(usuario, camisa, dias=0)
    cli = _client(usuario)
    cli.post(f"/api/vendas/{venda['id']}/financeiro/", {}, format="json")
    assert Lancamento.objects.get().status == "pendente"

    cli.post(f"/api/vendas/{venda['id']}/confirmar-pagamento/", {}, format="json")

    lancamento = Lancamento.objects.get()
    assert lancamento.status == "pago"
    assert lancamento.data_pagamento == hoje()


@pytest.mark.django_db
def test_confirmar_duas_vezes_e_recusado(usuario, camisa):
    venda = _venda_fiada(usuario, camisa, dias=0)
    cli = _client(usuario)
    cli.post(f"/api/vendas/{venda['id']}/confirmar-pagamento/", {}, format="json")

    resp = cli.post(f"/api/vendas/{venda['id']}/confirmar-pagamento/", {}, format="json")

    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "PAGAMENTO_JA_RESOLVIDO"


@pytest.mark.django_db
def test_nao_aceita_receber_mais_que_o_saldo(usuario, camisa):
    venda = _venda_fiada(usuario, camisa, dias=0, preco="100.00")

    resp = _client(usuario).post(
        f"/api/vendas/{venda['id']}/confirmar-pagamento/",
        {"valor_recebido": "150.00"},
        format="json",
    )

    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VALOR_RECEBIDO_MAIOR_QUE_SALDO"


# ── Recebimento parcial ──────────────────────────────────────────────────────

@pytest.mark.django_db
def test_recebimento_parcial_deixa_o_saldo_pendente_com_nova_data(usuario, camisa):
    venda = _venda_fiada(usuario, camisa, dias=0, preco="100.00")
    nova_data = hoje() + timedelta(days=15)

    resp = _client(usuario).post(
        f"/api/vendas/{venda['id']}/confirmar-pagamento/",
        {"valor_recebido": "60.00", "data_prevista_saldo": str(nova_data)},
        format="json",
    )

    dados = resp.json()["data"]
    assert dados["quitou"] is False
    assert Decimal(dados["saldo_devedor"]) == Decimal("40.00")
    assert dados["venda"]["status_pagamento"] == "pendente"
    assert dados["venda"]["data_prevista_pagamento"] == str(nova_data)
    assert Decimal(dados["venda"]["valor_recebido"]) == Decimal("60.00")


@pytest.mark.django_db
def test_o_parcial_nao_inventa_uma_segunda_venda(usuario, camisa):
    """
    A divergência deliberada em relação ao fluxo antigo.

    Lá o saldo vira uma segunda interação, e duas linhas de histórico não somam
    faturamento. Venda tem itens e total: uma segunda venda para o mesmo saldo
    faria a mesma mercadoria ser contada duas vezes na lista e no relatório. A
    pendência do saldo existe — ela é esta venda, rearmada.
    """
    venda = _venda_fiada(usuario, camisa, dias=0, preco="100.00")

    _client(usuario).post(
        f"/api/vendas/{venda['id']}/confirmar-pagamento/",
        {"valor_recebido": "60.00"},
        format="json",
    )

    assert Venda.objects.count() == 1
    assert Venda.objects.get().total == Decimal("100.00")


@pytest.mark.django_db
def test_parcial_volta_a_cobrar_na_nova_data(usuario, camisa):
    venda = _venda_fiada(usuario, camisa, dias=0, preco="100.00")
    cli = _client(usuario)
    VendaService.notificar_vendas_fiado()  # a primeira cobrança já saiu

    cli.post(
        f"/api/vendas/{venda['id']}/confirmar-pagamento/",
        {"valor_recebido": "60.00", "data_prevista_saldo": str(hoje())},
        format="json",
    )

    # Rearmou: volta a notificar, agora pelo saldo.
    assert VendaService.notificar_vendas_fiado() == 1
    assert "40" in Notificacao.objects.latest("criado_em").mensagem


@pytest.mark.django_db
def test_dois_parciais_quitam_a_venda(usuario, camisa):
    venda = _venda_fiada(usuario, camisa, dias=0, preco="100.00")
    cli = _client(usuario)

    cli.post(
        f"/api/vendas/{venda['id']}/confirmar-pagamento/",
        {"valor_recebido": "60.00"}, format="json",
    )
    resp = cli.post(
        f"/api/vendas/{venda['id']}/confirmar-pagamento/",
        {"valor_recebido": "40.00"}, format="json",
    )

    assert resp.json()["data"]["quitou"] is True
    assert Venda.objects.get().status_pagamento == "pago"


@pytest.mark.django_db
def test_parcial_parte_o_recebivel_em_dois_que_somam_o_mesmo(usuario, camisa):
    """
    O financeiro reflete o que entrou e o que falta, sem duplicar receita.

    O lançamento original passa a valer o recebido e vira pago; o saldo vira um
    lançamento pendente novo. Os dois somam o total da venda, e o vínculo da
    venda aponta para o pedaço que ainda se cobra.
    """
    venda = _venda_fiada(usuario, camisa, dias=0, preco="100.00")
    cli = _client(usuario)
    cli.post(f"/api/vendas/{venda['id']}/financeiro/", {}, format="json")

    cli.post(
        f"/api/vendas/{venda['id']}/confirmar-pagamento/",
        {"valor_recebido": "60.00"}, format="json",
    )

    pago = Lancamento.objects.get(status="pago")
    pendente = Lancamento.objects.get(status="pendente")
    assert pago.valor == Decimal("60.00")
    assert pendente.valor == Decimal("40.00")
    assert pago.valor + pendente.valor == Decimal("100.00")
    # O vínculo segue o que ainda se cobra.
    assert Venda.objects.get().lancamento_financeiro_id == pendente.id


@pytest.mark.django_db
def test_venda_sem_lancamento_nao_ganha_um_ao_ser_recebida(usuario, camisa):
    """Quem nunca foi ao financeiro não passa a ir por causa de um recebimento."""
    venda = _venda_fiada(usuario, camisa, dias=0, preco="100.00")

    _client(usuario).post(
        f"/api/vendas/{venda['id']}/confirmar-pagamento/",
        {"valor_recebido": "60.00"}, format="json",
    )

    assert Lancamento.objects.count() == 0


# ── Adiar ────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_adiar_empurra_a_data_e_volta_a_cobrar(usuario, camisa):
    venda = _venda_fiada(usuario, camisa, dias=0)
    cli = _client(usuario)
    VendaService.notificar_vendas_fiado()

    resp = cli.post(
        f"/api/vendas/{venda['id']}/adiar-pagamento/", {"dias": 7}, format="json"
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["data_prevista_pagamento"] == str(
        hoje() + timedelta(days=7)
    )
    # Rearmada: hoje ainda não, mas na nova data sim.
    assert VendaService.notificar_vendas_fiado() == 0
    assert VendaService.notificar_vendas_fiado(hoje() + timedelta(days=7)) == 1


@pytest.mark.django_db
def test_adiar_venda_vencida_conta_a_partir_de_hoje(usuario, camisa):
    """
    Adiar 3 dias uma venda vencida há um mês vence daqui a 3, não há 27.

    Somar sobre a data velha faria o adiamento nascer atrasado, e a cobrança
    voltaria no mesmo dia — que é justamente o que a pessoa pediu para não
    acontecer. Mesma conta do fluxo antigo.
    """
    venda = _venda_fiada(usuario, camisa, dias=-30)

    resp = _client(usuario).post(
        f"/api/vendas/{venda['id']}/adiar-pagamento/", {"dias": 3}, format="json"
    )

    assert resp.json()["data"]["data_prevista_pagamento"] == str(
        hoje() + timedelta(days=3)
    )


@pytest.mark.django_db
def test_nao_adia_venda_ja_resolvida(usuario, camisa):
    venda = _venda_fiada(usuario, camisa, dias=0)
    cli = _client(usuario)
    cli.post(f"/api/vendas/{venda['id']}/confirmar-pagamento/", {}, format="json")

    resp = cli.post(
        f"/api/vendas/{venda['id']}/adiar-pagamento/", {"dias": 3}, format="json"
    )

    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "PAGAMENTO_JA_RESOLVIDO"


# ── Cancelar ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_cancelar_para_de_cobrar(usuario, camisa):
    venda = _venda_fiada(usuario, camisa, dias=0)

    resp = _client(usuario).post(
        f"/api/vendas/{venda['id']}/cancelar-pagamento/", {}, format="json"
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["status_pagamento"] == "cancelado"
    assert VendaService.notificar_vendas_fiado() == 0


@pytest.mark.django_db
def test_cancelar_nao_mexe_no_financeiro(usuario, camisa):
    """
    Cancelar a cobrança é uma decisão; o que fazer com o lançamento é outra.

    Ela tem caminho próprio (apagar a venda com ajustes), e misturar as duas
    faria um clique decidir por dois.
    """
    venda = _venda_fiada(usuario, camisa, dias=0)
    cli = _client(usuario)
    cli.post(f"/api/vendas/{venda['id']}/financeiro/", {}, format="json")

    cli.post(f"/api/vendas/{venda['id']}/cancelar-pagamento/", {}, format="json")

    assert Lancamento.objects.get().status == "pendente"


# ── Badge de status ──────────────────────────────────────────────────────────

@pytest.mark.django_db
@pytest.mark.parametrize(
    "dias,atrasado,dias_para_vencer",
    [(-2, True, -2), (0, False, 0), (5, False, 5)],
)
def test_serializer_diz_o_que_o_badge_precisa(
    usuario, camisa, dias, atrasado, dias_para_vencer
):
    venda = _venda_fiada(usuario, camisa, dias=dias)

    assert venda["pagamento_atrasado"] is atrasado
    assert venda["dias_para_vencer"] == dias_para_vencer


@pytest.mark.django_db
def test_venda_paga_nao_tem_contagem_de_vencimento(usuario, camisa):
    resp = _client(usuario).post(
        "/api/vendas/",
        {"itens": [_item(camisa, "1", "100.00")], "status_pagamento": "pago"},
        format="json",
    )

    venda = resp.json()["data"]
    assert venda["pagamento_atrasado"] is False
    assert venda["dias_para_vencer"] is None


# ── GUARDA: as vendas que já existiam não são cobradas ───────────────────────

@pytest.fixture
def venda_migrada(db, empresa, cliente, usuario):
    """
    Uma venda migrada de verdade, no formato que a fase 2 produziu: interação
    com status sem equivalente, convertido para "pendente" na migração.
    """
    categoria = Categoria.objects.create(empresa=empresa, nome="Vendas", tipo="receita")
    lancamento = Lancamento.objects.create(
        empresa=empresa, categoria=categoria, tipo="receita",
        descricao="Venda antiga", valor=Decimal("120.00"),
        data_vencimento=hoje(), status="pago", criado_por=usuario,
    )
    InteracaoCliente.objects.create(
        empresa=empresa, cliente=cliente, tipo="venda", titulo="Venda antiga",
        valor=Decimal("120.00"),
        # O status que a migração converte, e a data no passado: exatamente a
        # combinação que dispararia cobrança retroativa.
        status_pagamento="cancelado",
        data_prevista_pagamento=hoje() - timedelta(days=90),
        data_interacao=timezone.now(), lancamento_financeiro=lancamento,
        criado_por=usuario,
    )
    call_command("migrar_vendas", verbosity=0)
    venda = Venda.objects.get()
    # A migração de rollout (0005) já rodou quando o banco de teste foi criado,
    # e portanto não alcança esta venda, criada agora. Reproduz aqui o que ela
    # faz em produção: o que existia antes do fiado nasce marcado como avisado.
    Venda.objects.filter(pk=venda.pk).update(notificacao_enviada=True)
    return Venda.objects.get(pk=venda.pk)


@pytest.mark.django_db
def test_venda_migrada_tem_a_forma_que_dispararia_cobranca(venda_migrada):
    """Sem a guarda, esta venda seria cobrada: pendente, vencida há 90 dias."""
    assert venda_migrada.status_pagamento == "pendente"
    assert venda_migrada.data_prevista_pagamento < hoje()


@pytest.mark.django_db
def test_venda_migrada_NAO_dispara_cobranca_retroativa(venda_migrada):
    """
    A guarda de rollout. Ligar o fiado não pode despejar de uma vez a cobrança
    de tudo que já estava no banco.
    """
    assert VendaService.notificar_vendas_fiado() == 0
    assert Notificacao.objects.count() == 0


@pytest.mark.django_db
def test_a_migracao_de_rollout_marca_tudo_que_ja_existia(usuario, camisa):
    """
    A prova de que a marcação é o que cala o passado.

    Desfazer a marca é o mesmo que não ter a migração 0005: a venda antiga
    volta a ser cobrada.
    """
    _venda_fiada(usuario, camisa, dias=-90)
    Venda.objects.update(notificacao_enviada=True)
    assert VendaService.notificar_vendas_fiado() == 0

    Venda.objects.update(notificacao_enviada=False)
    assert VendaService.notificar_vendas_fiado() == 1


@pytest.mark.django_db
def test_venda_pendente_sem_data_nunca_notifica(usuario, camisa, empresa):
    """
    A segunda barreira, para a migrada que não tinha previsão nenhuma.

    Criada direto no banco porque a API passou a exigir a data — o que se
    protege aqui é o dado que já existe, não o que se pode cadastrar.
    """
    venda = Venda.objects.create(
        empresa=empresa, status_pagamento="pendente",
        data_prevista_pagamento=None, criado_por=usuario,
    )
    Venda.objects.filter(pk=venda.pk).update(notificacao_enviada=False)

    assert VendaService.notificar_vendas_fiado() == 0


@pytest.mark.django_db
def test_venda_sem_dono_nao_reprocessa_todo_dia(empresa, db):
    """
    Sem `criado_por` não há sino para tocar. Marca como avisada em vez de
    tentar de novo amanhã, e no dia seguinte, e no seguinte.
    """
    Venda.objects.create(
        empresa=empresa, status_pagamento="pendente",
        data_prevista_pagamento=hoje(), criado_por=None,
    )

    assert VendaService.notificar_vendas_fiado() == 0
    assert Venda.objects.get().notificacao_enviada is True


# ── Multi-tenant ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_nao_confirma_pagamento_de_venda_alheia(usuario, camisa, usuario_outra):
    venda = _venda_fiada(usuario, camisa, dias=0)

    resp = _client(usuario_outra).post(
        f"/api/vendas/{venda['id']}/confirmar-pagamento/", {}, format="json"
    )

    assert resp.status_code == 404
    assert Venda.objects.get().status_pagamento == "pendente"


@pytest.mark.django_db
def test_nao_adia_nem_cancela_venda_alheia(usuario, camisa, usuario_outra):
    venda = _venda_fiada(usuario, camisa, dias=0)
    cli = _client(usuario_outra)

    assert cli.post(
        f"/api/vendas/{venda['id']}/adiar-pagamento/", {"dias": 3}, format="json"
    ).status_code == 404
    assert cli.post(
        f"/api/vendas/{venda['id']}/cancelar-pagamento/", {}, format="json"
    ).status_code == 404


@pytest.mark.django_db
def test_a_cobranca_notifica_o_dono_da_venda(usuario, camisa, usuario_outra, camisa_outra):
    """Cada empresa recebe a sua — a passada é global, o sino não é."""
    _venda_fiada(usuario, camisa, dias=0)
    _venda_fiada(usuario_outra, camisa_outra, dias=0)

    VendaService.notificar_vendas_fiado()

    donos = set(Notificacao.objects.values_list("usuario_id", flat=True))
    assert donos == {usuario.id, usuario_outra.id}
    for notificacao in Notificacao.objects.all():
        assert notificacao.empresa_id == notificacao.usuario.empresa_id


@pytest.fixture
def camisa_outra(db, outra_empresa, usuario_outra):
    categoria = CategoriaEstoque.objects.create(empresa=outra_empresa, nome="Roupas")
    return Produto.objects.create(
        empresa=outra_empresa, categoria=categoria, nome="Camisa", sku="SKU-OUTRA",
        preco_custo=Decimal("10.00"), preco_venda=Decimal("50.00"),
        estoque_atual=Decimal("10"), estoque_minimo=Decimal("1"),
        criado_por=usuario_outra,
    )
