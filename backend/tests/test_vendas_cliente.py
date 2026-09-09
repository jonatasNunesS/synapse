"""
Synapse — Vendas: o vínculo com o cliente.

A venda de balcão pode ganhar dono depois, trocar de dono, ou voltar a ser
avulsa. A regra que atravessa o arquivo inteiro é uma só:

    VÍNCULO É ORGANIZAÇÃO. PAGAMENTO É FATO.

Mexer em de quem foi a venda não pode reescrever o que já aconteceu com o
dinheiro. O lançamento financeiro fica onde está — mesmo valor, mesmo status,
mesma descrição. O que já foi recebido continua recebido. O que anda junto com
o vínculo é só o que ainda não aconteceu: a cobrança do fiado, que lê o cliente
na hora de notificar.

É por isso que o vínculo tem endpoint próprio e não passa pelo PATCH: o PATCH
recebe a venda inteira e recalcula os totais a partir dos itens.
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
def maria(db, empresa):
    return Cliente.objects.create(empresa=empresa, nome="Maria Souza")


@pytest.fixture
def joao(db, empresa):
    return Cliente.objects.create(empresa=empresa, nome="João Lima")


@pytest.fixture
def cliente_alheio(db, outra_empresa):
    return Cliente.objects.create(empresa=outra_empresa, nome="Cliente Alheio")


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


def _item(produto, quantidade="1", preco="100.00"):
    return {"produto": str(produto.id), "quantidade": quantidade, "preco_unitario": preco}


def _criar_venda(usuario, camisa, **extra):
    corpo = {"itens": [_item(camisa)]}
    corpo.update(extra)
    resp = _client(usuario).post("/api/vendas/", corpo, format="json")
    assert resp.status_code == 201, resp.json()
    return resp.json()["data"]


def _vincular(usuario, venda_id, cliente_id):
    return _client(usuario).post(
        f"/api/vendas/{venda_id}/cliente/", {"cliente": cliente_id}, format="json"
    )


def hoje():
    return timezone.localdate()


# ── Vincular, trocar, desvincular ────────────────────────────────────────────

@pytest.mark.django_db
def test_venda_avulsa_ganha_cliente(usuario, camisa, maria):
    venda = _criar_venda(usuario, camisa)
    assert venda["cliente"] is None

    resp = _vincular(usuario, venda["id"], str(maria.id))

    assert resp.status_code == 200
    assert resp.json()["data"]["cliente"] == str(maria.id)
    assert resp.json()["data"]["cliente_nome"] == "Maria Souza"
    assert Venda.objects.get().cliente_id == maria.id


@pytest.mark.django_db
def test_venda_vinculada_aparece_na_listagem_do_cliente(usuario, camisa, maria):
    """É por aqui que a timeline do cliente passa a mostrá-la — sem mais nada."""
    venda = _criar_venda(usuario, camisa)
    cli = _client(usuario)
    assert cli.get(f"/api/vendas/?cliente_id={maria.id}").json()["data"] == []

    _vincular(usuario, venda["id"], str(maria.id))

    listagem = cli.get(f"/api/vendas/?cliente_id={maria.id}").json()["data"]
    assert len(listagem) == 1
    assert listagem[0]["id"] == venda["id"]


@pytest.mark.django_db
def test_trocar_move_a_venda_de_um_cliente_para_o_outro(usuario, camisa, maria, joao):
    venda = _criar_venda(usuario, camisa, cliente=str(maria.id))
    cli = _client(usuario)

    _vincular(usuario, venda["id"], str(joao.id))

    assert cli.get(f"/api/vendas/?cliente_id={maria.id}").json()["data"] == []
    assert len(cli.get(f"/api/vendas/?cliente_id={joao.id}").json()["data"]) == 1


@pytest.mark.django_db
def test_desvincular_devolve_a_venda_ao_balcao(usuario, camisa, maria):
    venda = _criar_venda(usuario, camisa, cliente=str(maria.id))

    resp = _vincular(usuario, venda["id"], None)

    assert resp.status_code == 200
    assert resp.json()["data"]["cliente"] is None
    assert Venda.objects.get().cliente_id is None
    assert (
        _client(usuario).get(f"/api/vendas/?cliente_id={maria.id}").json()["data"] == []
    )


@pytest.mark.django_db
def test_corpo_sem_a_chave_cliente_e_recusado(usuario, camisa):
    """
    Corpo vazio seria ambíguo entre "desvincular" e "esqueci de mandar".

    Desvincular é destrutivo o bastante para exigir que alguém tenha dito
    `null` de propósito.
    """
    venda = _criar_venda(usuario, camisa)

    resp = _client(usuario).post(f"/api/vendas/{venda['id']}/cliente/", {}, format="json")

    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


# ── A REGRA: o vínculo não reescreve dinheiro ────────────────────────────────

@pytest.mark.django_db
def test_trocar_cliente_nao_apaga_nem_duplica_o_lancamento(usuario, camisa, maria, joao):
    venda = _criar_venda(usuario, camisa, cliente=str(maria.id))
    cli = _client(usuario)
    cli.post(f"/api/vendas/{venda['id']}/financeiro/", {}, format="json")
    lancamento = Lancamento.objects.get()
    antes = (lancamento.id, lancamento.valor, lancamento.status, lancamento.descricao)

    _vincular(usuario, venda["id"], str(joao.id))

    assert Lancamento.objects.count() == 1
    lancamento.refresh_from_db()
    assert (lancamento.id, lancamento.valor, lancamento.status, lancamento.descricao) == antes
    # E o vínculo da venda com ele segue de pé.
    assert Venda.objects.get().lancamento_financeiro_id == lancamento.id


@pytest.mark.django_db
def test_a_descricao_do_lancamento_e_um_retrato_da_hora_em_que_o_dinheiro_entrou(
    usuario, camisa, maria
):
    """
    O lançamento não tem cliente — tem uma descrição, escrita quando foi criado.

    Vincular a venda depois não a reescreve, e é isso que se quer: a linha do
    caixa diz o que se sabia quando o dinheiro foi registrado. Corrigi-la agora
    seria editar um registro financeiro depois do fato.
    """
    venda = _criar_venda(usuario, camisa)  # balcão
    cli = _client(usuario)
    cli.post(f"/api/vendas/{venda['id']}/financeiro/", {}, format="json")
    assert Lancamento.objects.get().descricao == "Venda - balcão"

    _vincular(usuario, venda["id"], str(maria.id))

    assert Lancamento.objects.get().descricao == "Venda - balcão"


@pytest.mark.django_db
def test_venda_paga_continua_paga_ao_trocar_de_cliente(usuario, camisa, maria, joao):
    venda = _criar_venda(usuario, camisa, cliente=str(maria.id), status_pagamento="pago")
    cli = _client(usuario)
    cli.post(f"/api/vendas/{venda['id']}/financeiro/", {}, format="json")
    lancamento = Lancamento.objects.get()
    assert lancamento.status == "pago"

    _vincular(usuario, venda["id"], str(joao.id))

    depois = Venda.objects.get()
    assert depois.status_pagamento == "pago"
    assert depois.total == Decimal("100.00")
    lancamento.refresh_from_db()
    assert lancamento.status == "pago"
    assert lancamento.valor == Decimal("100.00")


@pytest.mark.django_db
def test_o_que_ja_foi_recebido_nao_se_move(usuario, camisa, maria, joao):
    """
    Recebimento parcial: metade entrou com a Maria, o resto se cobra do João.

    O dinheiro que já entrou não volta atrás — `valor_recebido` fica. O que
    muda é de quem se cobra daqui para a frente.
    """
    venda = _criar_venda(
        usuario, camisa, cliente=str(maria.id),
        status_pagamento="pendente", data_prevista_pagamento=str(hoje()),
    )
    cli = _client(usuario)
    cli.post(
        f"/api/vendas/{venda['id']}/confirmar-pagamento/",
        {"valor_recebido": "40.00"}, format="json",
    )

    _vincular(usuario, venda["id"], str(joao.id))

    depois = Venda.objects.get()
    assert depois.valor_recebido == Decimal("40.00")
    assert depois.saldo_devedor == Decimal("60.00")
    assert depois.status_pagamento == "pendente"


# ── A cobrança futura segue o novo cliente ───────────────────────────────────

@pytest.mark.django_db
def test_fiado_pendente_passa_a_cobrar_o_novo_cliente(usuario, camisa, maria, joao):
    """
    Cobrança futura ainda não aconteceu: ela pertence a quem deve agora.

    Nada precisou ser feito para isso — a notificação lê o cliente na hora de
    sair, e é o que faz o vínculo valer para o que ainda vai acontecer.
    """
    venda = _criar_venda(
        usuario, camisa, cliente=str(maria.id),
        status_pagamento="pendente", data_prevista_pagamento=str(hoje()),
    )

    _vincular(usuario, venda["id"], str(joao.id))
    assert VendaService.notificar_vendas_fiado() == 1

    notificacao = Notificacao.objects.get()
    assert "João Lima" in notificacao.titulo
    assert "Maria Souza" not in notificacao.titulo


@pytest.mark.django_db
def test_desvincular_nao_cala_a_cobranca(usuario, camisa, maria):
    """Sem cliente, ainda se cobra — a venda diz o que dá para dizer."""
    venda = _criar_venda(
        usuario, camisa, cliente=str(maria.id),
        status_pagamento="pendente", data_prevista_pagamento=str(hoje()),
    )

    _vincular(usuario, venda["id"], None)

    assert VendaService.notificar_vendas_fiado() == 1
    assert "venda" in Notificacao.objects.get().titulo.lower()


@pytest.mark.django_db
def test_vincular_nao_rearma_uma_cobranca_ja_avisada(usuario, camisa, maria):
    """
    Trocar o dono não é motivo para tocar o sino de novo.

    A cobrança de hoje já saiu; refazer o vínculo não a faz sair outra vez.
    """
    venda = _criar_venda(
        usuario, camisa, status_pagamento="pendente",
        data_prevista_pagamento=str(hoje()),
    )
    assert VendaService.notificar_vendas_fiado() == 1

    _vincular(usuario, venda["id"], str(maria.id))

    assert VendaService.notificar_vendas_fiado() == 0
    assert Notificacao.objects.count() == 1


# ── O estoque também não se mexe ─────────────────────────────────────────────

@pytest.mark.django_db
def test_trocar_cliente_nao_mexe_no_estoque_ja_baixado(usuario, camisa, maria, joao):
    venda = _criar_venda(usuario, camisa, cliente=str(maria.id))
    cli = _client(usuario)
    cli.post(f"/api/vendas/{venda['id']}/estoque/", {}, format="json")
    camisa.refresh_from_db()
    assert camisa.estoque_atual == Decimal("9")

    _vincular(usuario, venda["id"], str(joao.id))

    camisa.refresh_from_db()
    assert camisa.estoque_atual == Decimal("9")
    assert Venda.objects.get().movimentacoes.count() == 1


# ── GUARDA: as vendas migradas na fase 2 ─────────────────────────────────────

@pytest.fixture
def venda_migrada(db, empresa, maria, usuario):
    """Uma venda migrada de verdade, com a interação de origem por trás."""
    categoria = Categoria.objects.create(empresa=empresa, nome="Vendas", tipo="receita")
    lancamento = Lancamento.objects.create(
        empresa=empresa, categoria=categoria, tipo="receita",
        descricao="Venda antiga", valor=Decimal("120.00"),
        data_vencimento=hoje(), status="pago", criado_por=usuario,
    )
    InteracaoCliente.objects.create(
        empresa=empresa, cliente=maria, tipo="venda", titulo="Venda antiga",
        valor=Decimal("120.00"), status_pagamento="pago",
        data_interacao=timezone.now(), lancamento_financeiro=lancamento,
        criado_por=usuario,
    )
    call_command("migrar_vendas", verbosity=0)
    return Venda.objects.get()


@pytest.mark.django_db
def test_venda_migrada_ja_nasce_com_cliente(venda_migrada, maria):
    """O modelo antigo exigia cliente — nenhuma das 22 é avulsa."""
    assert venda_migrada.cliente_id == maria.id


@pytest.mark.django_db
def test_trocar_cliente_da_migrada_preserva_o_vinculo_com_a_interacao(
    usuario, venda_migrada, joao
):
    """
    A interação de origem continua apontando para a venda.

    É esse vínculo que mantém a compra fora da timeline duas vezes. Se ele se
    perdesse ao trocar o cliente, a interação voltaria a ser listada e a mesma
    compra apareceria duplicada.
    """
    interacao_antes = InteracaoCliente.objects.get(migrada_para_venda=venda_migrada)

    _vincular(usuario, str(venda_migrada.id), str(joao.id))

    interacao = InteracaoCliente.objects.get(pk=interacao_antes.pk)
    assert interacao.migrada_para_venda_id == venda_migrada.id
    assert Venda.objects.get().cliente_id == joao.id


@pytest.mark.django_db
def test_a_compra_migrada_nao_reaparece_no_cliente_antigo(
    usuario, venda_migrada, maria, joao
):
    """
    Trocada de dono, ela sai do histórico do antigo — inclusive a interação.

    A interação segue escondida porque está migrada; a venda saiu porque agora
    é do João. O cliente antigo fica sem nenhuma das duas, que é o certo: a
    compra não é mais dele.
    """
    _vincular(usuario, str(venda_migrada.id), str(joao.id))
    cli = _client(usuario)

    interacoes = cli.get(f"/api/clientes/{maria.id}/interacoes/").json()["data"]
    vendas = cli.get(f"/api/vendas/?cliente_id={maria.id}").json()["data"]
    assert len(interacoes) + len(vendas) == 0

    assert len(cli.get(f"/api/vendas/?cliente_id={joao.id}").json()["data"]) == 1


@pytest.mark.django_db
def test_migrada_desvinculada_nao_perde_o_lancamento_herdado(usuario, venda_migrada):
    """O lançamento das 22 veio da interação — desvincular não encosta nele."""
    lancamento_id = venda_migrada.lancamento_financeiro_id

    _vincular(usuario, str(venda_migrada.id), None)

    assert Venda.objects.get().lancamento_financeiro_id == lancamento_id
    assert Lancamento.objects.count() == 1


# ── PATCH parcial não pode reescrever o que não foi enviado ──────────────────

@pytest.mark.django_db
def test_patch_parcial_preserva_o_desconto_e_o_total(usuario, camisa, maria):
    """
    Regressão de um bug de dinheiro, achado ao construir esta fase.

    O PATCH marcava os campos como não obrigatórios mas mantinha os defaults —
    e `desconto` tem default zero. Mandar só o cliente zerava o desconto e
    mudava o total da venda, em silêncio. Foi por causa disto que o vínculo
    ganhou endpoint próprio, e o PATCH foi corrigido.
    """
    venda = _criar_venda(usuario, camisa, desconto="10.00", observacoes="nota")
    assert Decimal(venda["total"]) == Decimal("90.00")

    resp = _client(usuario).patch(
        f"/api/vendas/{venda['id']}/", {"cliente": str(maria.id)}, format="json"
    )

    assert resp.status_code == 200
    depois = Venda.objects.get()
    assert depois.desconto == Decimal("10.00")
    assert depois.total == Decimal("90.00")
    assert depois.observacoes == "nota"
    assert depois.cliente_id == maria.id


@pytest.mark.django_db
def test_patch_que_manda_o_desconto_ainda_muda_o_desconto(usuario, camisa):
    """A correção não pode ter desligado a edição de verdade."""
    venda = _criar_venda(usuario, camisa, desconto="10.00")

    _client(usuario).patch(
        f"/api/vendas/{venda['id']}/", {"desconto": "25.00"}, format="json"
    )

    depois = Venda.objects.get()
    assert depois.desconto == Decimal("25.00")
    assert depois.total == Decimal("75.00")


# ── Multi-tenant ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_nao_vincula_venda_de_outra_empresa(usuario, camisa, maria, usuario_outra):
    venda = _criar_venda(usuario, camisa)

    resp = _vincular(usuario_outra, venda["id"], str(maria.id))

    assert resp.status_code == 404
    assert Venda.objects.get().cliente_id is None


@pytest.mark.django_db
def test_nao_vincula_a_cliente_de_outra_empresa(usuario, camisa, cliente_alheio):
    """
    Cliente alheio não é "não encontrado" por acaso — é dado de outra empresa.

    Deixar passar aqui ligaria uma venda a um cadastro que não é desta loja.
    """
    venda = _criar_venda(usuario, camisa)

    resp = _vincular(usuario, venda["id"], str(cliente_alheio.id))

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "CLIENTE_NAO_ENCONTRADO"
    assert Venda.objects.get().cliente_id is None


@pytest.mark.django_db
def test_cliente_inexistente_e_recusado(usuario, camisa):
    venda = _criar_venda(usuario, camisa)

    resp = _vincular(usuario, venda["id"], "00000000-0000-0000-0000-000000000000")

    assert resp.status_code == 404
    assert Venda.objects.get().cliente_id is None


@pytest.mark.django_db
def test_venda_inexistente_e_recusada(usuario, maria):
    resp = _vincular(usuario, "00000000-0000-0000-0000-000000000000", str(maria.id))

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "VENDA_NAO_ENCONTRADA"
