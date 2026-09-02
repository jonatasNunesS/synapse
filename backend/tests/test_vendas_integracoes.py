"""
Synapse — Vendas: as integrações com estoque e financeiro (fase 3A).

Duas guardas sustentam esta fase, e as duas existem por causa das vendas que a
fase 2 migrou:

1. Venda que JÁ tem lançamento não gera outro. As migradas nasceram com o
   lancamento_financeiro copiado da interação original — lançar de novo
   contaria a mesma receita duas vezes.
2. Item sem produto não baixa estoque. Os itens migrados são livres, porque a
   interação antiga não guardava o vínculo com o produto.

Os testes das duas guardas usam vendas migradas de verdade, criadas rodando o
`migrar_vendas` — não uma imitação montada à mão. Se a forma do que a migração
produz mudar, é aqui que aparece.
"""
from decimal import Decimal

import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa
from modules.clientes.models import Cliente, InteracaoCliente
from modules.estoque.models import CategoriaEstoque, Movimentacao, Produto
from modules.financeiro.models import Categoria, Lancamento
from modules.vendas.models import Venda


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


def _produto(empresa, usuario, nome, preco, estoque):
    categoria = CategoriaEstoque.objects.create(empresa=empresa, nome=f"Cat {nome}")
    return Produto.objects.create(
        empresa=empresa, categoria=categoria, nome=nome,
        sku=f"SKU-{nome[:6].upper()}",
        preco_custo=Decimal("10.00"), preco_venda=Decimal(preco),
        estoque_atual=Decimal(estoque), estoque_minimo=Decimal("1"),
        criado_por=usuario,
    )


@pytest.fixture
def camisa(db, empresa, usuario):
    return _produto(empresa, usuario, "Camisa", "50.00", "10")


@pytest.fixture
def bone(db, empresa, usuario):
    return _produto(empresa, usuario, "Bone", "30.00", "4")


def _client(user):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(user).access_token)
    return c


def _criar_venda(usuario, itens, **extra):
    corpo = {"itens": itens}
    corpo.update(extra)
    resp = _client(usuario).post("/api/vendas/", corpo, format="json")
    assert resp.status_code == 201, resp.json()
    return resp.json()["data"]


def _item(produto, quantidade="1", preco=None):
    dados = {"produto": str(produto.id), "quantidade": quantidade}
    if preco is not None:
        dados["preco_unitario"] = preco
    return dados


def _item_livre(descricao, quantidade="1", preco="100.00"):
    return {"descricao": descricao, "quantidade": quantidade, "preco_unitario": preco}


# ── Prévia: ver antes de confirmar ───────────────────────────────────────────

@pytest.mark.django_db
def test_previa_mostra_o_saldo_antes_e_depois(usuario, camisa):
    """A pessoa decide olhando o que vai acontecer, não depois."""
    venda = _criar_venda(usuario, [_item(camisa, "3", "50.00")])

    resp = _client(usuario).get(f"/api/vendas/{venda['id']}/estoque/")

    assert resp.status_code == 200
    dados = resp.json()["data"]
    assert dados["ja_baixou"] is False
    assert dados["tem_itens_com_produto"] is True
    linha = dados["itens"][0]
    assert linha["produto_nome"] == "Camisa"
    assert Decimal(linha["estoque_antes"]) == Decimal("10")
    assert Decimal(linha["estoque_depois"]) == Decimal("7")
    assert linha["suficiente"] is True


@pytest.mark.django_db
def test_previa_nao_grava_nada(usuario, camisa):
    venda = _criar_venda(usuario, [_item(camisa, "3", "50.00")])

    _client(usuario).get(f"/api/vendas/{venda['id']}/estoque/")

    camisa.refresh_from_db()
    assert camisa.estoque_atual == Decimal("10")
    assert Movimentacao.objects.count() == 0


# ── Baixa de estoque ─────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_baixa_desconta_e_vincula_a_venda(usuario, camisa):
    venda = _criar_venda(usuario, [_item(camisa, "3", "50.00")])

    resp = _client(usuario).post(f"/api/vendas/{venda['id']}/estoque/", {}, format="json")

    assert resp.status_code == 200
    camisa.refresh_from_db()
    assert camisa.estoque_atual == Decimal("7")

    movimentacao = Movimentacao.objects.get()
    assert movimentacao.tipo == "saida"
    assert movimentacao.motivo == "venda"
    assert movimentacao.quantidade == Decimal("3.000")
    # O vínculo é o que a fase 3B e o estorno vão usar para saber o que reverter.
    assert str(movimentacao.venda_id) == venda["id"]
    # E o preço praticado fica guardado — foi a falta disso no fluxo antigo que
    # deixou as 22 vendas migradas sem produto.
    assert movimentacao.preco_unitario == Decimal("50.00")


@pytest.mark.django_db
def test_baixa_de_venda_com_varios_produtos_gera_uma_saida_por_item(
    usuario, camisa, bone
):
    venda = _criar_venda(
        usuario, [_item(camisa, "2", "50.00"), _item(bone, "1", "30.00")]
    )

    _client(usuario).post(f"/api/vendas/{venda['id']}/estoque/", {}, format="json")

    assert Movimentacao.objects.count() == 2
    camisa.refresh_from_db()
    bone.refresh_from_db()
    assert camisa.estoque_atual == Decimal("8")
    assert bone.estoque_atual == Decimal("3")


@pytest.mark.django_db
def test_venda_marca_que_ja_baixou(usuario, camisa):
    venda = _criar_venda(usuario, [_item(camisa, "1", "50.00")])
    assert venda["ja_baixou_estoque"] is False

    resp = _client(usuario).post(f"/api/vendas/{venda['id']}/estoque/", {}, format="json")

    assert resp.json()["data"]["ja_baixou_estoque"] is True


# ── GUARDA 1: item livre não toca estoque ────────────────────────────────────

@pytest.mark.django_db
def test_venda_so_de_item_livre_nao_baixa_estoque(usuario, camisa):
    """
    Item livre não tem produto — não há de onde descontar.

    É o caso de todas as vendas migradas na fase 2, e de qualquer serviço.
    """
    venda = _criar_venda(usuario, [_item_livre("Cerimonial", "1", "1200.00")])
    assert venda["tem_itens_com_produto"] is False

    resp = _client(usuario).post(f"/api/vendas/{venda['id']}/estoque/", {}, format="json")

    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VENDA_SEM_PRODUTO"
    camisa.refresh_from_db()
    assert camisa.estoque_atual == Decimal("10")
    assert Movimentacao.objects.count() == 0


@pytest.mark.django_db
def test_previa_de_venda_so_livre_avisa_que_nao_ha_o_que_baixar(usuario):
    venda = _criar_venda(usuario, [_item_livre("Montagem", "1", "80.00")])

    dados = _client(usuario).get(f"/api/vendas/{venda['id']}/estoque/").json()["data"]

    assert dados["tem_itens_com_produto"] is False
    assert dados["itens"] == []


@pytest.mark.django_db
def test_venda_mista_baixa_so_o_item_com_produto(usuario, camisa):
    venda = _criar_venda(
        usuario,
        [_item(camisa, "2", "50.00"), _item_livre("Frete", "1", "25.00")],
    )

    _client(usuario).post(f"/api/vendas/{venda['id']}/estoque/", {}, format="json")

    # Uma movimentação só: a do produto. O frete não tem estoque.
    assert Movimentacao.objects.count() == 1
    assert Movimentacao.objects.get().produto_id == camisa.id
    camisa.refresh_from_db()
    assert camisa.estoque_atual == Decimal("8")


@pytest.mark.django_db
def test_movimentacao_com_preco_serializa_o_valor_total(usuario, camisa):
    """
    Guardar o preço acordou uma conta que nunca tinha rodado.

    `valor_total` só é calculado quando há preço — e como o repositório nunca
    gravava preço, a linha era código morto com um erro dentro (Decimal × float).
    Este teste existe para a conta não voltar a quebrar agora que ela roda.
    """
    from modules.estoque.serializers import MovimentacaoSerializer

    venda = _criar_venda(usuario, [_item(camisa, "2", "50.00")])
    _client(usuario).post(f"/api/vendas/{venda['id']}/estoque/", {}, format="json")

    dados = MovimentacaoSerializer(Movimentacao.objects.get()).data

    assert dados["valor_total"] == 100.0  # 2 × 50,00, sem desconto


# ── Idempotência ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_baixar_duas_vezes_nao_desconta_duas_vezes(usuario, camisa):
    venda = _criar_venda(usuario, [_item(camisa, "3", "50.00")])
    cliente = _client(usuario)

    cliente.post(f"/api/vendas/{venda['id']}/estoque/", {}, format="json")
    resp = cliente.post(f"/api/vendas/{venda['id']}/estoque/", {}, format="json")

    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VENDA_JA_BAIXADA"
    camisa.refresh_from_db()
    assert camisa.estoque_atual == Decimal("7")
    assert Movimentacao.objects.count() == 1


# ── Estoque insuficiente: o mesmo caminho do fluxo antigo ────────────────────

@pytest.mark.django_db
def test_estoque_insuficiente_recusa_e_informa_o_saldo(usuario, bone):
    """Recusa com o saldo nos details — é o que deixa a tela oferecer o parcial."""
    venda = _criar_venda(usuario, [_item(bone, "10", "30.00")])  # só há 4

    resp = _client(usuario).post(f"/api/vendas/{venda['id']}/estoque/", {}, format="json")

    assert resp.status_code == 400
    erro = resp.json()["error"]
    assert erro["code"] == "ESTOQUE_INSUFICIENTE"
    assert erro["details"]["itens"][0]["saldo_atual"] == "4.000"
    bone.refresh_from_db()
    assert bone.estoque_atual == Decimal("4")


@pytest.mark.django_db
def test_parcial_baixa_o_que_tem(usuario, bone):
    venda = _criar_venda(usuario, [_item(bone, "10", "30.00")])

    resp = _client(usuario).post(
        f"/api/vendas/{venda['id']}/estoque/", {"parcial": True}, format="json"
    )

    assert resp.status_code == 200
    bone.refresh_from_db()
    assert bone.estoque_atual == Decimal("0")
    assert Movimentacao.objects.get().quantidade == Decimal("4.000")


@pytest.mark.django_db
def test_uma_venda_meio_baixada_nao_acontece(usuario, camisa, bone):
    """
    Ou todas as saídas, ou nenhuma.

    Uma venda que baixou metade é pior do que uma que não baixou: ninguém sabe
    onde parou.
    """
    venda = _criar_venda(
        usuario, [_item(camisa, "2", "50.00"), _item(bone, "99", "30.00")]
    )

    resp = _client(usuario).post(f"/api/vendas/{venda['id']}/estoque/", {}, format="json")

    assert resp.status_code == 400
    camisa.refresh_from_db()
    assert camisa.estoque_atual == Decimal("10")  # o que cabia também não desceu
    assert Movimentacao.objects.count() == 0


# ── Lançamento financeiro ────────────────────────────────────────────────────

@pytest.mark.django_db
def test_lanca_receita_com_o_total_da_venda(usuario, camisa, cliente):
    venda = _criar_venda(
        usuario,
        [_item(camisa, "2", "50.00")],
        cliente=str(cliente.id),
        desconto="10.00",
    )

    resp = _client(usuario).post(f"/api/vendas/{venda['id']}/financeiro/", {}, format="json")

    assert resp.status_code == 200
    lancamento = Lancamento.objects.get()
    assert lancamento.tipo == "receita"
    assert lancamento.valor == Decimal("90.00")  # 100 − 10 de desconto
    assert "Maria Souza" in lancamento.descricao
    assert resp.json()["data"]["tem_lancamento_financeiro"] is True


@pytest.mark.django_db
@pytest.mark.parametrize(
    "status_venda,status_lancamento", [("pago", "pago"), ("pendente", "pendente")]
)
def test_status_do_lancamento_herda_o_da_venda(
    usuario, camisa, status_venda, status_lancamento
):
    venda = _criar_venda(
        usuario, [_item(camisa, "1", "50.00")], status_pagamento=status_venda
    )

    _client(usuario).post(f"/api/vendas/{venda['id']}/financeiro/", {}, format="json")

    lancamento = Lancamento.objects.get()
    assert lancamento.status == status_lancamento
    assert (lancamento.data_pagamento is not None) is (status_venda == "pago")


@pytest.mark.django_db
def test_venda_de_balcao_lanca_sem_cliente(usuario, camisa):
    venda = _criar_venda(usuario, [_item(camisa, "1", "50.00")], cliente=None)

    resp = _client(usuario).post(f"/api/vendas/{venda['id']}/financeiro/", {}, format="json")

    assert resp.status_code == 200
    assert "balcão" in Lancamento.objects.get().descricao


# ── GUARDA 2: não duplicar financeiro ────────────────────────────────────────

@pytest.mark.django_db
def test_lancar_duas_vezes_nao_duplica(usuario, camisa):
    venda = _criar_venda(usuario, [_item(camisa, "1", "50.00")])
    cli = _client(usuario)

    cli.post(f"/api/vendas/{venda['id']}/financeiro/", {}, format="json")
    resp = cli.post(f"/api/vendas/{venda['id']}/financeiro/", {}, format="json")

    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VENDA_JA_COM_LANCAMENTO"
    assert Lancamento.objects.count() == 1


# ── As vendas migradas na fase 2 — a armadilha desta fase ────────────────────

@pytest.fixture
def venda_migrada(db, empresa, cliente, usuario):
    """
    Uma venda migrada de verdade: roda o `migrar_vendas` sobre uma interação
    antiga que já tinha lançamento financeiro.

    É assim que as 22 vendas em produção nasceram — com lancamento_financeiro
    copiado e item livre, sem produto.
    """
    categoria = Categoria.objects.create(empresa=empresa, nome="Vendas", tipo="receita")
    lancamento = Lancamento.objects.create(
        empresa=empresa, categoria=categoria, tipo="receita",
        descricao="Venda antiga", valor=Decimal("120.00"),
        data_vencimento=timezone.localdate(), status="pago", criado_por=usuario,
    )
    InteracaoCliente.objects.create(
        empresa=empresa, cliente=cliente, tipo="venda", titulo="Venda antiga",
        valor=Decimal("120.00"), status_pagamento="pago",
        data_interacao=timezone.now(), lancamento_financeiro=lancamento,
        criado_por=usuario,
    )
    call_command("migrar_vendas", verbosity=0)
    return Venda.objects.get()


@pytest.mark.django_db
def test_venda_migrada_nasce_com_lancamento_e_sem_produto(venda_migrada):
    """A forma que a fase 2 produz — é o que as duas guardas precisam cobrir."""
    assert venda_migrada.lancamento_financeiro_id is not None
    assert venda_migrada.itens.get().produto_id is None


@pytest.mark.django_db
def test_venda_migrada_NAO_gera_lancamento_novo(usuario, venda_migrada):
    """
    A guarda que protege o dinheiro.

    A receita desta venda já está no caixa desde o fluxo antigo. Um segundo
    lançamento contaria o mesmo dinheiro duas vezes.
    """
    antes = Lancamento.objects.count()

    resp = _client(usuario).post(
        f"/api/vendas/{venda_migrada.id}/financeiro/", {}, format="json"
    )

    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VENDA_JA_COM_LANCAMENTO"
    assert Lancamento.objects.count() == antes


@pytest.mark.django_db
def test_venda_migrada_NAO_baixa_estoque(usuario, camisa, venda_migrada):
    """Sem produto, não há o que descontar — e nada quebra ao tentar."""
    resp = _client(usuario).post(
        f"/api/vendas/{venda_migrada.id}/estoque/", {}, format="json"
    )

    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VENDA_SEM_PRODUTO"
    assert Movimentacao.objects.count() == 0
    camisa.refresh_from_db()
    assert camisa.estoque_atual == Decimal("10")


@pytest.mark.django_db
def test_tela_da_venda_migrada_nao_oferece_nenhuma_das_duas_acoes(
    usuario, venda_migrada
):
    """O serializer diz à tela para não nem oferecer — o erro é a última linha."""
    dados = _client(usuario).get(f"/api/vendas/{venda_migrada.id}/").json()["data"]

    assert dados["tem_lancamento_financeiro"] is True
    assert dados["tem_itens_com_produto"] is False
    assert dados["ja_baixou_estoque"] is False


# ── Timeline do cliente: a venda migrada não aparece duas vezes ──────────────

@pytest.mark.django_db
def test_interacao_migrada_sai_da_timeline(usuario, cliente, venda_migrada):
    """
    A interação original continua no banco, intacta — só não é mostrada.

    Quem representa aquela venda agora é a Venda, que tem itens e integrações.
    Mostrar as duas faria o cliente ver a mesma compra duas vezes.
    """
    resp = _client(usuario).get(f"/api/clientes/{cliente.id}/interacoes/")

    assert resp.status_code == 200
    assert resp.json()["data"] == []
    # Nada foi apagado: a interação segue lá, com o vínculo.
    assert InteracaoCliente.objects.filter(
        migrada_para_venda=venda_migrada
    ).count() == 1


@pytest.mark.django_db
def test_interacao_nao_migrada_continua_na_timeline(usuario, empresa, cliente):
    InteracaoCliente.objects.create(
        empresa=empresa, cliente=cliente, tipo="ligacao", titulo="Liguei",
        data_interacao=timezone.now(),
    )

    resp = _client(usuario).get(f"/api/clientes/{cliente.id}/interacoes/")

    assert len(resp.json()["data"]) == 1
    assert resp.json()["data"][0]["titulo"] == "Liguei"


@pytest.mark.django_db
def test_venda_migrada_aparece_uma_vez_so_no_historico(usuario, cliente, venda_migrada):
    """
    A prova da dedup, olhando as duas fontes juntas.

    O histórico do cliente lê interações E vendas. A mesma compra migrada está
    nos dois lugares no banco, e é a soma das duas listas que a tela mostra —
    então é a soma que precisa dar um.
    """
    cli = _client(usuario)

    interacoes = cli.get(f"/api/clientes/{cliente.id}/interacoes/").json()["data"]
    vendas = cli.get(f"/api/vendas/?cliente_id={cliente.id}").json()["data"]

    assert len(interacoes) == 0
    assert len(vendas) == 1
    assert len(interacoes) + len(vendas) == 1


@pytest.mark.django_db
def test_interacao_comum_e_venda_convivem_no_historico(
    usuario, empresa, cliente, camisa
):
    """Esconder a migrada não pode esconder o que nunca virou venda."""
    InteracaoCliente.objects.create(
        empresa=empresa, cliente=cliente, tipo="ligacao", titulo="Liguei",
        data_interacao=timezone.now(),
    )
    _criar_venda(usuario, [_item(camisa, "1", "50.00")], cliente=str(cliente.id))
    cli = _client(usuario)

    interacoes = cli.get(f"/api/clientes/{cliente.id}/interacoes/").json()["data"]
    vendas = cli.get(f"/api/vendas/?cliente_id={cliente.id}").json()["data"]

    assert len(interacoes) + len(vendas) == 2


@pytest.mark.django_db
def test_venda_com_cliente_aparece_na_listagem_dele(usuario, camisa, cliente):
    _criar_venda(usuario, [_item(camisa, "1", "50.00")], cliente=str(cliente.id))
    _criar_venda(usuario, [_item(camisa, "1", "50.00")], cliente=None)

    resp = _client(usuario).get(f"/api/vendas/?cliente_id={cliente.id}")

    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 1


# ── Apagar a venda ajustando os vínculos ─────────────────────────────────────

@pytest.mark.django_db
def test_apagar_com_estorno_devolve_o_estoque(usuario, camisa):
    venda = _criar_venda(usuario, [_item(camisa, "3", "50.00")])
    cli = _client(usuario)
    cli.post(f"/api/vendas/{venda['id']}/estoque/", {}, format="json")
    camisa.refresh_from_db()
    assert camisa.estoque_atual == Decimal("7")

    resp = cli.delete(f"/api/vendas/{venda['id']}/?estornar_estoque=true")

    assert resp.status_code == 204
    camisa.refresh_from_db()
    assert camisa.estoque_atual == Decimal("10")
    # A movimentação original é imutável: o estorno soma de volta, não apaga.
    assert Movimentacao.objects.count() == 2


@pytest.mark.django_db
def test_apagar_sem_marcar_nada_nao_mexe_no_estoque(usuario, camisa):
    venda = _criar_venda(usuario, [_item(camisa, "3", "50.00")])
    cli = _client(usuario)
    cli.post(f"/api/vendas/{venda['id']}/estoque/", {}, format="json")

    cli.delete(f"/api/vendas/{venda['id']}/")

    camisa.refresh_from_db()
    assert camisa.estoque_atual == Decimal("7")
    assert Movimentacao.objects.count() == 1


@pytest.mark.django_db
def test_apagar_com_financeiro_pago_cancela_em_vez_de_apagar(usuario, camisa):
    """Lançamento pago é histórico — cancela, não some."""
    venda = _criar_venda(
        usuario, [_item(camisa, "1", "50.00")], status_pagamento="pago"
    )
    cli = _client(usuario)
    cli.post(f"/api/vendas/{venda['id']}/financeiro/", {}, format="json")

    cli.delete(f"/api/vendas/{venda['id']}/?apagar_financeiro=true")

    lancamento = Lancamento.objects.get()
    assert lancamento.status == "cancelado"


@pytest.mark.django_db
def test_apagar_com_financeiro_pendente_apaga_o_lancamento(usuario, camisa):
    venda = _criar_venda(
        usuario, [_item(camisa, "1", "50.00")], status_pagamento="pendente"
    )
    cli = _client(usuario)
    cli.post(f"/api/vendas/{venda['id']}/financeiro/", {}, format="json")

    cli.delete(f"/api/vendas/{venda['id']}/?apagar_financeiro=true")

    assert Lancamento.objects.count() == 0


@pytest.mark.django_db
def test_estorno_e_movimentacao_inversa_e_nao_apaga_a_original(usuario, camisa):
    """
    O estoque é imutável por design: desfazer é somar de volta.

    Apagar a saída faria o saldo bater e o histórico mentir — ninguém saberia
    que a mercadoria chegou a sair. O que fica é o par: a saída original e a
    entrada que a estorna.
    """
    venda = _criar_venda(usuario, [_item(camisa, "3", "50.00")])
    cli = _client(usuario)
    cli.post(f"/api/vendas/{venda['id']}/estoque/", {}, format="json")
    original = Movimentacao.objects.get()

    cli.delete(f"/api/vendas/{venda['id']}/?estornar_estoque=true")

    # A original continua lá, do jeito que era.
    original.refresh_from_db()
    assert original.tipo == "saida"
    assert original.quantidade == Decimal("3.000")

    estorno = Movimentacao.objects.exclude(pk=original.pk).get()
    assert estorno.tipo == "entrada"
    assert estorno.quantidade == original.quantidade
    assert str(original.id) in estorno.referencia


@pytest.mark.django_db
def test_apagar_com_ajustes_e_tudo_ou_nada(usuario, camisa, monkeypatch):
    """
    Uma falha no meio não pode deixar o estoque devolvido e a venda viva.

    É a diferença deliberada em relação ao fluxo antigo de interação, onde a
    sequência não era transacional: lá, um erro depois do estorno deixava um
    estado que ninguém descobria até conferir o estoque na mão.
    """
    from modules.vendas.repository import VendaRepository
    from modules.vendas.services import VendaService

    venda = _criar_venda(usuario, [_item(camisa, "3", "50.00")])
    cli = _client(usuario)
    cli.post(f"/api/vendas/{venda['id']}/estoque/", {}, format="json")
    camisa.refresh_from_db()
    assert camisa.estoque_atual == Decimal("7")

    # O último passo falha, depois de o estorno já ter acontecido. Chamado no
    # serviço, e não pela rota: o handler da API transformaria a exceção em 500
    # e esconderia justamente o que este teste quer ver.
    def explode(_venda):
        raise RuntimeError("falha ao apagar a venda")

    monkeypatch.setattr(VendaRepository, "deletar", staticmethod(explode))

    with pytest.raises(RuntimeError):
        VendaService.apagar_com_ajustes(
            usuario.empresa_id, usuario.id, venda["id"], estornar_estoque=True
        )

    # Nada aconteceu: o estorno voltou atrás junto com a exclusão.
    camisa.refresh_from_db()
    assert camisa.estoque_atual == Decimal("7")
    assert Movimentacao.objects.count() == 1
    assert Venda.objects.filter(pk=venda["id"]).exists()


# ── Multi-tenant ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_nao_baixa_estoque_de_venda_alheia(usuario, camisa, usuario_outra):
    venda = _criar_venda(usuario, [_item(camisa, "1", "50.00")])

    resp = _client(usuario_outra).post(
        f"/api/vendas/{venda['id']}/estoque/", {}, format="json"
    )

    assert resp.status_code == 404
    camisa.refresh_from_db()
    assert camisa.estoque_atual == Decimal("10")


@pytest.mark.django_db
def test_nao_lanca_financeiro_de_venda_alheia(usuario, camisa, usuario_outra):
    venda = _criar_venda(usuario, [_item(camisa, "1", "50.00")])

    resp = _client(usuario_outra).post(
        f"/api/vendas/{venda['id']}/financeiro/", {}, format="json"
    )

    assert resp.status_code == 404
    assert Lancamento.objects.count() == 0


@pytest.mark.django_db
def test_movimentacao_da_venda_fica_na_empresa_da_venda(usuario, camisa, empresa):
    venda = _criar_venda(usuario, [_item(camisa, "1", "50.00")])

    _client(usuario).post(f"/api/vendas/{venda['id']}/estoque/", {}, format="json")

    assert Movimentacao.objects.get().empresa_id == empresa.id


# ── O POST de criar não age sozinho; quem age é a resposta à pergunta ────────

@pytest.mark.django_db
def test_criar_venda_nao_age_sozinha_e_devolve_o_que_a_tela_precisa_perguntar(
    usuario, camisa
):
    """
    Criar a venda não baixa nem lança — mas devolve com o que perguntar.

    Este teste já existiu afirmando só a metade de cima, e foi por isso que ele
    ficou verde enquanto, na tela, a venda era registrada e nenhuma das duas
    perguntas aparecia: nada aqui obrigava a resposta a dizer se havia o que
    perguntar. A ausência de efeito continua sendo o certo — quem decide é a
    pessoa —, mas o que sustenta a decisão são os dois campos abaixo, e é a
    partir deles que a tela monta as perguntas.
    """
    venda = _criar_venda(usuario, [_item(camisa, "3", "50.00")])

    camisa.refresh_from_db()
    assert camisa.estoque_atual == Decimal("10")
    assert Movimentacao.objects.count() == 0
    assert Lancamento.objects.count() == 0

    # O que a tela lê para saber o que oferecer logo depois de salvar.
    assert venda["tem_itens_com_produto"] is True
    assert venda["ja_baixou_estoque"] is False
    assert venda["tem_lancamento_financeiro"] is False


@pytest.mark.django_db
def test_venda_so_de_item_livre_diz_que_nao_ha_estoque_a_perguntar(usuario):
    """A venda migrada tem esta forma: a tela não deve oferecer a baixa."""
    venda = _criar_venda(
        usuario,
        [{"produto": None, "descricao": "Consultoria", "quantidade": "1",
          "preco_unitario": "300.00"}],
    )

    assert venda["tem_itens_com_produto"] is False
