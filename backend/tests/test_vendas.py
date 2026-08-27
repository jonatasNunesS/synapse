"""
Synapse — Vendas como entidade própria (fase 1).

A venda deixa de ser uma InteracaoCliente com um valor só e passa a ter
itens. Estes testes fixam as duas coisas que sustentam o modelo: o dinheiro
é sempre derivado dos itens no backend, e a fase 1 CONVIVE com o fluxo atual
— criar uma venda aqui não baixa estoque nem lança financeiro.

O que a interface calcula enquanto a pessoa monta a venda serve para ela ver
o total na hora; o número que vale é o que o servidor devolve. Por isso
vários testes mandam totais errados de propósito e conferem que o backend
ignora.
"""
from decimal import Decimal

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from django.core.exceptions import ValidationError

from modules.auth.models import CustomUser, Empresa
from modules.clientes.models import Cliente
from modules.estoque.models import CategoriaEstoque, Produto
from modules.vendas.models import ItemVenda, Venda


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


def _produto(empresa, usuario, nome, preco, estoque="10"):
    categoria = CategoriaEstoque.objects.create(empresa=empresa, nome=f"Cat {nome}")
    return Produto.objects.create(
        empresa=empresa,
        categoria=categoria,
        nome=nome,
        sku=f"SKU-{nome[:6].upper().replace(' ', '')}",
        preco_custo=Decimal("10.00"),
        preco_venda=Decimal(preco),
        estoque_atual=Decimal(estoque),
        estoque_minimo=Decimal("1"),
        criado_por=usuario,
    )


@pytest.fixture
def camisa(db, empresa, usuario):
    return _produto(empresa, usuario, "Camisa", "50.00")


@pytest.fixture
def bone(db, empresa, usuario):
    return _produto(empresa, usuario, "Bone", "30.00")


def _client(user):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(user).access_token)
    return c


def _venda(itens, **extra):
    corpo = {"itens": itens}
    corpo.update(extra)
    return corpo


# ── O cálculo do dinheiro ────────────────────────────────────────────────────

@pytest.mark.django_db
def test_venda_com_um_item_soma_certo(usuario, camisa):
    resp = _client(usuario).post(
        "/api/vendas/",
        _venda([{"produto": str(camisa.id), "quantidade": "2", "preco_unitario": "50.00"}]),
        format="json",
    )

    assert resp.status_code == 201
    dados = resp.json()["data"]
    assert Decimal(dados["subtotal"]) == Decimal("100.00")
    assert Decimal(dados["total"]) == Decimal("100.00")
    assert Decimal(dados["itens"][0]["subtotal"]) == Decimal("100.00")


@pytest.mark.django_db
def test_venda_com_varios_itens_e_desconto(usuario, camisa, bone):
    # 2 × 50,00 = 100,00 · 1 × 30,00 = 30,00 · subtotal 130,00 − 10,00 = 120,00
    resp = _client(usuario).post(
        "/api/vendas/",
        _venda(
            [
                {"produto": str(camisa.id), "quantidade": "2", "preco_unitario": "50.00"},
                {"produto": str(bone.id), "quantidade": "1", "preco_unitario": "30.00"},
            ],
            desconto="10.00",
        ),
        format="json",
    )

    assert resp.status_code == 201
    dados = resp.json()["data"]
    assert Decimal(dados["subtotal"]) == Decimal("130.00")
    assert Decimal(dados["desconto"]) == Decimal("10.00")
    assert Decimal(dados["total"]) == Decimal("120.00")


@pytest.mark.django_db
def test_backend_ignora_totais_mandados_pelo_cliente(usuario, camisa):
    """O que a tela soma não é o que fica gravado."""
    resp = _client(usuario).post(
        "/api/vendas/",
        _venda(
            [{"produto": str(camisa.id), "quantidade": "2", "preco_unitario": "50.00"}],
            subtotal="1.00",
            total="1.00",
        ),
        format="json",
    )

    assert resp.status_code == 201
    dados = resp.json()["data"]
    assert Decimal(dados["subtotal"]) == Decimal("100.00")
    assert Decimal(dados["total"]) == Decimal("100.00")


@pytest.mark.django_db
def test_preco_em_branco_cai_no_preco_do_cadastro(usuario, camisa):
    resp = _client(usuario).post(
        "/api/vendas/",
        _venda([{"produto": str(camisa.id), "quantidade": "3"}]),
        format="json",
    )

    assert resp.status_code == 201
    dados = resp.json()["data"]
    assert Decimal(dados["itens"][0]["preco_unitario"]) == Decimal("50.00")
    assert Decimal(dados["total"]) == Decimal("150.00")


@pytest.mark.django_db
def test_preco_editado_e_respeitado(usuario, camisa):
    """Preço combinado no balcão vale mais que o de tabela."""
    resp = _client(usuario).post(
        "/api/vendas/",
        _venda([{"produto": str(camisa.id), "quantidade": "2", "preco_unitario": "45.00"}]),
        format="json",
    )

    dados = resp.json()["data"]
    assert Decimal(dados["itens"][0]["preco_unitario"]) == Decimal("45.00")
    assert Decimal(dados["total"]) == Decimal("90.00")


@pytest.mark.django_db
def test_desconto_maior_que_subtotal_e_recusado(usuario, camisa):
    """Total negativo não é venda."""
    resp = _client(usuario).post(
        "/api/vendas/",
        _venda(
            [{"produto": str(camisa.id), "quantidade": "1", "preco_unitario": "50.00"}],
            desconto="80.00",
        ),
        format="json",
    )

    assert resp.status_code == 400
    assert "desconto" in str(resp.json()["error"]).lower()
    assert Venda.objects.count() == 0


@pytest.mark.django_db
def test_desconto_igual_ao_subtotal_zera_o_total(usuario, camisa):
    """Zerar é legítimo (brinde, cortesia); negativar não."""
    resp = _client(usuario).post(
        "/api/vendas/",
        _venda(
            [{"produto": str(camisa.id), "quantidade": "1", "preco_unitario": "50.00"}],
            desconto="50.00",
        ),
        format="json",
    )

    assert resp.status_code == 201
    assert Decimal(resp.json()["data"]["total"]) == Decimal("0.00")


@pytest.mark.django_db
def test_quantidade_zero_ou_negativa_e_recusada(usuario, camisa):
    for qtd in ("0", "-1"):
        resp = _client(usuario).post(
            "/api/vendas/",
            _venda([{"produto": str(camisa.id), "quantidade": qtd, "preco_unitario": "50.00"}]),
            format="json",
        )
        assert resp.status_code == 400, f"quantidade {qtd} deveria ser recusada"


@pytest.mark.django_db
def test_venda_sem_item_e_recusada(usuario):
    resp = _client(usuario).post("/api/vendas/", {"itens": []}, format="json")
    assert resp.status_code == 400


# ── Cliente opcional ─────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_venda_sem_cliente_e_criada_normalmente(usuario, camisa):
    """Venda de balcão não exige inventar cadastro."""
    resp = _client(usuario).post(
        "/api/vendas/",
        _venda(
            [{"produto": str(camisa.id), "quantidade": "1", "preco_unitario": "50.00"}],
            cliente=None,
        ),
        format="json",
    )

    assert resp.status_code == 201
    dados = resp.json()["data"]
    assert dados["cliente"] is None
    assert dados["cliente_nome"] is None


@pytest.mark.django_db
def test_venda_com_cliente_vincula_certo(usuario, camisa, cliente):
    resp = _client(usuario).post(
        "/api/vendas/",
        _venda(
            [{"produto": str(camisa.id), "quantidade": "1", "preco_unitario": "50.00"}],
            cliente=str(cliente.id),
        ),
        format="json",
    )

    assert resp.status_code == 201
    dados = resp.json()["data"]
    assert dados["cliente"] == str(cliente.id)
    assert dados["cliente_nome"] == "Maria Souza"


# ── Isolamento entre empresas ────────────────────────────────────────────────

@pytest.mark.django_db
def test_produto_de_outra_empresa_e_recusado(usuario, outra_empresa, usuario_outra):
    alheio = _produto(outra_empresa, usuario_outra, "Alheio", "99.00")

    resp = _client(usuario).post(
        "/api/vendas/",
        _venda([{"produto": str(alheio.id), "quantidade": "1", "preco_unitario": "99.00"}]),
        format="json",
    )

    assert resp.status_code == 400
    assert Venda.objects.count() == 0


@pytest.mark.django_db
def test_cliente_de_outra_empresa_e_recusado(usuario, camisa, outra_empresa):
    alheio = Cliente.objects.create(empresa=outra_empresa, nome="Cliente Alheio")

    resp = _client(usuario).post(
        "/api/vendas/",
        _venda(
            [{"produto": str(camisa.id), "quantidade": "1", "preco_unitario": "50.00"}],
            cliente=str(alheio.id),
        ),
        format="json",
    )

    assert resp.status_code == 400


@pytest.mark.django_db
def test_empresa_nao_ve_venda_de_outra(usuario, camisa, usuario_outra):
    _client(usuario).post(
        "/api/vendas/",
        _venda([{"produto": str(camisa.id), "quantidade": "1", "preco_unitario": "50.00"}]),
        format="json",
    )

    resp = _client(usuario_outra).get("/api/vendas/")
    assert resp.status_code == 200
    assert resp.json()["data"] == []


@pytest.mark.django_db
def test_detalhe_de_venda_alheia_da_404(usuario, camisa, usuario_outra):
    criada = _client(usuario).post(
        "/api/vendas/",
        _venda([{"produto": str(camisa.id), "quantidade": "1", "preco_unitario": "50.00"}]),
        format="json",
    ).json()["data"]

    resp = _client(usuario_outra).get(f"/api/vendas/{criada['id']}/")
    assert resp.status_code == 404


# ── Edição e exclusão ────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_editar_itens_recalcula_o_total(usuario, camisa, bone):
    criada = _client(usuario).post(
        "/api/vendas/",
        _venda([{"produto": str(camisa.id), "quantidade": "1", "preco_unitario": "50.00"}]),
        format="json",
    ).json()["data"]
    assert Decimal(criada["total"]) == Decimal("50.00")

    resp = _client(usuario).patch(
        f"/api/vendas/{criada['id']}/",
        {
            "itens": [
                {"produto": str(camisa.id), "quantidade": "2", "preco_unitario": "50.00"},
                {"produto": str(bone.id), "quantidade": "1", "preco_unitario": "30.00"},
            ]
        },
        format="json",
    )

    assert resp.status_code == 200
    dados = resp.json()["data"]
    assert Decimal(dados["subtotal"]) == Decimal("130.00")
    assert Decimal(dados["total"]) == Decimal("130.00")
    assert len(dados["itens"]) == 2


@pytest.mark.django_db
def test_patch_sem_itens_preserva_os_itens(usuario, camisa):
    criada = _client(usuario).post(
        "/api/vendas/",
        _venda([{"produto": str(camisa.id), "quantidade": "2", "preco_unitario": "50.00"}]),
        format="json",
    ).json()["data"]

    resp = _client(usuario).patch(
        f"/api/vendas/{criada['id']}/", {"observacoes": "cliente pediu nota"}, format="json"
    )

    assert resp.status_code == 200
    dados = resp.json()["data"]
    assert len(dados["itens"]) == 1
    assert Decimal(dados["total"]) == Decimal("100.00")


@pytest.mark.django_db
def test_patch_que_reduz_itens_revalida_o_desconto(usuario, camisa, bone):
    """
    O desconto é validado contra os itens NOVOS.

    Sem isso, uma venda de 130,00 com 30,00 de desconto poderia ter os itens
    reduzidos para 50,00 e ficar com total negativo.
    """
    criada = _client(usuario).post(
        "/api/vendas/",
        _venda(
            [
                {"produto": str(camisa.id), "quantidade": "2", "preco_unitario": "50.00"},
                {"produto": str(bone.id), "quantidade": "1", "preco_unitario": "30.00"},
            ],
            desconto="30.00",
        ),
        format="json",
    ).json()["data"]

    resp = _client(usuario).patch(
        f"/api/vendas/{criada['id']}/",
        {
            "desconto": "30.00",
            "itens": [{"produto": str(bone.id), "quantidade": "1", "preco_unitario": "20.00"}],
        },
        format="json",
    )

    assert resp.status_code == 400


@pytest.mark.django_db
def test_excluir_venda(usuario, camisa):
    criada = _client(usuario).post(
        "/api/vendas/",
        _venda([{"produto": str(camisa.id), "quantidade": "1", "preco_unitario": "50.00"}]),
        format="json",
    ).json()["data"]

    resp = _client(usuario).delete(f"/api/vendas/{criada['id']}/")
    assert resp.status_code == 204
    assert Venda.objects.count() == 0


# ── Fase 1 convive com o fluxo atual: nada de integrações ────────────────────

@pytest.mark.django_db
def test_criar_venda_NAO_baixa_estoque(usuario, camisa):
    """
    Integrações são da fase 3.

    Enquanto o fluxo antigo (InteracaoCliente) ainda baixa estoque, baixar
    aqui também faria a mesma venda descontar duas vezes.
    """
    antes = camisa.estoque_atual

    _client(usuario).post(
        "/api/vendas/",
        _venda([{"produto": str(camisa.id), "quantidade": "3", "preco_unitario": "50.00"}]),
        format="json",
    )

    camisa.refresh_from_db()
    assert camisa.estoque_atual == antes


@pytest.mark.django_db
def test_criar_venda_NAO_lanca_financeiro(usuario, camisa):
    from modules.financeiro.models import Lancamento

    _client(usuario).post(
        "/api/vendas/",
        _venda([{"produto": str(camisa.id), "quantidade": "1", "preco_unitario": "50.00"}]),
        format="json",
    )

    assert Lancamento.objects.count() == 0


@pytest.mark.django_db
def test_criar_venda_NAO_cria_interacao_de_cliente(usuario, camisa, cliente):
    """O fluxo antigo segue intocado — as duas formas coexistem."""
    from modules.clientes.models import InteracaoCliente

    _client(usuario).post(
        "/api/vendas/",
        _venda(
            [{"produto": str(camisa.id), "quantidade": "1", "preco_unitario": "50.00"}],
            cliente=str(cliente.id),
        ),
        format="json",
    )

    assert InteracaoCliente.objects.count() == 0


# ── Item livre: a linha que não tem produto no catálogo ──────────────────────
#
# Existe por dois motivos. O primeiro é o serviço — "cerimonial", "montagem",
# "frete" — que se vende junto do produto e nunca esteve no estoque. O segundo
# é a fase 2: a venda antiga guardava só um valor, e migrar sem isto obrigaria
# a inventar produto no catálogo de estoque só para a venda velha caber aqui.
#
# A regra que sustenta os dois: a linha precisa dizer o que está sendo vendido.
# Com produto o nome sai do cadastro; sem produto, a descrição é obrigatória.

def _linha_livre(empresa, venda, descricao, quantidade="1", preco="50.00"):
    return ItemVenda(
        venda=venda,
        empresa=empresa,
        produto=None,
        descricao=descricao,
        quantidade=Decimal(quantidade),
        preco_unitario=Decimal(preco),
    )


@pytest.mark.django_db
def test_item_com_produto_e_sem_descricao_e_valido(empresa, camisa):
    """Os itens da fase 1 continuam válidos exatamente como eram."""
    venda = Venda.objects.create(empresa=empresa)
    item = ItemVenda(
        venda=venda,
        empresa=empresa,
        produto=camisa,
        quantidade=Decimal("2"),
        preco_unitario=Decimal("50.00"),
    )

    item.full_clean()
    item.save()

    assert item.descricao == ""
    assert item.nome_exibido == "Camisa"


@pytest.mark.django_db
def test_item_sem_produto_e_com_descricao_e_valido(empresa):
    venda = Venda.objects.create(empresa=empresa)
    item = _linha_livre(empresa, venda, "Cerimonial")

    item.full_clean()
    item.save()

    assert item.produto_id is None
    assert item.nome_exibido == "Cerimonial"


@pytest.mark.django_db
def test_item_sem_produto_e_sem_descricao_e_recusado(empresa):
    """Uma linha que não diz o que é ainda somaria ao total. Não entra."""
    venda = Venda.objects.create(empresa=empresa)

    for vazia in ("", "   "):
        with pytest.raises(ValidationError) as erro:
            _linha_livre(empresa, venda, vazia).full_clean()
        assert "descricao" in erro.value.message_dict


@pytest.mark.django_db
def test_recalcular_totais_soma_item_livre(empresa, camisa):
    """Item livre entra na conta como qualquer outro."""
    venda = Venda.objects.create(empresa=empresa, desconto=Decimal("10.00"))
    ItemVenda.objects.create(
        venda=venda, empresa=empresa, produto=camisa,
        quantidade=Decimal("2"), preco_unitario=Decimal("50.00"),
    )
    _linha_livre(empresa, venda, "Montagem", "1", "80.00").save()

    venda.recalcular_totais()
    venda.refresh_from_db()

    assert venda.subtotal == Decimal("180.00")
    assert venda.total == Decimal("170.00")


@pytest.mark.django_db
def test_venda_so_de_item_livre_pela_api(usuario):
    resp = _client(usuario).post(
        "/api/vendas/",
        _venda([{"descricao": "Cerimonial", "quantidade": "1", "preco_unitario": "1200.00"}]),
        format="json",
    )

    assert resp.status_code == 201
    dados = resp.json()["data"]
    assert Decimal(dados["total"]) == Decimal("1200.00")
    item = dados["itens"][0]
    assert item["produto"] is None
    assert item["descricao"] == "Cerimonial"
    # A tela lê produto_nome; sem produto, quem responde é a descrição.
    assert item["produto_nome"] == "Cerimonial"
    assert item["produto_unidade"] == ""


@pytest.mark.django_db
def test_venda_mistura_produto_e_item_livre(usuario, camisa):
    resp = _client(usuario).post(
        "/api/vendas/",
        _venda([
            {"produto": str(camisa.id), "quantidade": "2", "preco_unitario": "50.00"},
            {"descricao": "Frete", "quantidade": "1", "preco_unitario": "25.00"},
        ]),
        format="json",
    )

    assert resp.status_code == 201
    dados = resp.json()["data"]
    assert Decimal(dados["subtotal"]) == Decimal("125.00")
    assert [i["produto_nome"] for i in dados["itens"]] == ["Camisa", "Frete"]


@pytest.mark.django_db
def test_api_recusa_item_sem_produto_e_sem_descricao(usuario):
    resp = _client(usuario).post(
        "/api/vendas/",
        _venda([{"quantidade": "1", "preco_unitario": "50.00"}]),
        format="json",
    )

    assert resp.status_code == 400
    assert "descri" in str(resp.json()["error"]).lower()
    assert Venda.objects.count() == 0


@pytest.mark.django_db
def test_api_recusa_item_livre_sem_preco(usuario):
    """Sem produto o preço não tem cadastro de onde cair. Precisa vir."""
    resp = _client(usuario).post(
        "/api/vendas/",
        _venda([{"descricao": "Cerimonial", "quantidade": "1"}]),
        format="json",
    )

    assert resp.status_code == 400
    assert Venda.objects.count() == 0


@pytest.mark.django_db
def test_descricao_em_item_com_produto_nao_atrapalha(usuario, camisa):
    """Com produto o nome sai do cadastro — a descrição fica como anotação."""
    resp = _client(usuario).post(
        "/api/vendas/",
        _venda([{
            "produto": str(camisa.id),
            "descricao": "tamanho G",
            "quantidade": "1",
            "preco_unitario": "50.00",
        }]),
        format="json",
    )

    assert resp.status_code == 201
    item = resp.json()["data"]["itens"][0]
    assert item["produto_nome"] == "Camisa"
    assert item["descricao"] == "tamanho G"
