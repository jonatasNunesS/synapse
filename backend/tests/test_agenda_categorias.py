"""
Synapse — Agenda: categorias de evento (AGENDA_AUDIT, item 5).

A categoria é o que dá NOME à cor. O que mais importa aqui:

1. EVENTO ANTIGO NÃO QUEBRA NEM MUDA DE COR. Quem existia antes das categorias
   chega com categoria=null e segue exibindo a cor que já tinha. Se um teste
   falha, é esse que precisa falhar primeiro.
2. Só admin gerencia; todos usam.
3. Desativar OCULTA, não apaga — o vínculo e a cor dos eventos continuam.
4. Multi-tenant em tudo.
"""
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.agenda.models import COR_PADRAO, CategoriaEvento, Evento
from modules.auth.models import CustomUser, Empresa

URL = "/api/agenda/categorias/"


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(nome="Empresa A Categorias", plano="starter")


@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(nome="Empresa B Categorias", plano="starter")


@pytest.fixture
def admin_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="admin@cat.com", nome="Admin", senha="Senha@12345",
        empresa=empresa_a, perfil="admin",
    )


@pytest.fixture
def colaborador_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="colab@cat.com", nome="Colaborador", senha="Senha@12345",
        empresa=empresa_a, perfil="colaborador",
    )


@pytest.fixture
def admin_b(db, empresa_b):
    return CustomUser.objects.create_user(
        email="admin@cat-b.com", nome="Admin B", senha="Senha@12345",
        empresa=empresa_b, perfil="admin",
    )


def _client(usuario):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(usuario).access_token)
    return c


def _categoria(empresa, nome="Reunião", cor="#22c55e", **over):
    return CategoriaEvento.objects.create(empresa=empresa, nome=nome, cor=cor, **over)


def _evento(empresa, **over):
    inicio = timezone.now() + timedelta(days=1)
    dados = {
        "empresa": empresa,
        "titulo": "Compromisso",
        "data_inicio": inicio,
        "data_fim": inicio + timedelta(hours=1),
    }
    dados.update(over)
    return Evento.objects.create(**dados)


# ═══════════════════════════════════════════════════════════════════════════
# 1. O EVENTO ANTIGO NÃO QUEBRA
# ═══════════════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_evento_sem_categoria_mantem_a_cor_que_tinha(empresa_a):
    """O caso de TODOS os eventos que já existiam quando as categorias entraram."""
    antigo = _evento(empresa_a, cor="#ef4444")

    assert antigo.categoria_id is None
    assert antigo.cor_efetiva == "#ef4444"


@pytest.mark.django_db
def test_evento_antigo_continua_aparecendo_na_api(admin_a, empresa_a):
    """Não basta a cor: o evento não pode SUMIR da listagem."""
    _evento(empresa_a, titulo="De antes das categorias", cor="#f97316")

    r = _client(admin_a).get("/api/agenda/")

    assert r.status_code == 200
    item = r.data["data"][0]
    assert item["titulo"] == "De antes das categorias"
    assert item["categoria"] is None
    assert item["categoria_nome"] is None
    assert item["cor_efetiva"] == "#f97316"


@pytest.mark.django_db
def test_evento_do_followup_mantem_o_azul_dele(empresa_a):
    """
    O follow-up do CRM crava #3B82F6, um azul que nem está no seletor antigo.
    Ele não tem categoria e precisa continuar azul.
    """
    followup = _evento(empresa_a, titulo="Follow-up: Maria", cor="#3B82F6")

    assert followup.cor_efetiva == "#3B82F6"


@pytest.mark.django_db
def test_evento_sem_cor_nenhuma_nao_fica_invisivel(empresa_a):
    """Cor vazia no banco (dado torto) cai no padrão, não em string vazia."""
    evento = _evento(empresa_a)
    Evento.objects.filter(pk=evento.pk).update(cor="")
    evento.refresh_from_db()

    assert evento.cor_efetiva == COR_PADRAO


# ═══════════════════════════════════════════════════════════════════════════
# 2. A COR VEM DA CATEGORIA
# ═══════════════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_evento_com_categoria_usa_a_cor_dela(empresa_a):
    cobranca = _categoria(empresa_a, nome="Cobrança", cor="#eab308")
    # A cor própria do evento é outra de propósito: a da categoria manda.
    evento = _evento(empresa_a, categoria=cobranca, cor="#ef4444")

    assert evento.cor_efetiva == "#eab308"


@pytest.mark.django_db
def test_trocar_a_cor_da_categoria_repinta_os_eventos(admin_a, empresa_a):
    """É o que faz a categoria valer: mudar num lugar muda em todos."""
    cat = _categoria(empresa_a, nome="Entrega", cor="#22c55e")
    _evento(empresa_a, categoria=cat)

    _client(admin_a).patch(f"{URL}{cat.id}/", {"cor": "#0ea5e9"}, format="json")

    r = _client(admin_a).get("/api/agenda/")
    assert r.data["data"][0]["cor_efetiva"] == "#0ea5e9"


@pytest.mark.django_db
def test_api_devolve_o_nome_da_categoria(admin_a, empresa_a):
    """O detalhe mostra o nome — é o que tira o colorido do anonimato."""
    cat = _categoria(empresa_a, nome="Reunião")
    _evento(empresa_a, categoria=cat)

    r = _client(admin_a).get("/api/agenda/")

    assert r.data["data"][0]["categoria_nome"] == "Reunião"


@pytest.mark.django_db
def test_criar_evento_com_categoria_pela_api(admin_a, empresa_a):
    cat = _categoria(empresa_a, nome="Pessoal", cor="#64748b")
    inicio = timezone.now() + timedelta(days=2)

    r = _client(admin_a).post("/api/agenda/", {
        "titulo": "Médico",
        "data_inicio": inicio.isoformat(),
        "data_fim": (inicio + timedelta(hours=1)).isoformat(),
        "categoria": str(cat.id),
    }, format="json")

    assert r.status_code == 201, r.data
    assert r.data["data"]["categoria_nome"] == "Pessoal"
    assert r.data["data"]["cor_efetiva"] == "#64748b"


@pytest.mark.django_db
def test_tirar_a_categoria_volta_para_a_cor_do_evento(admin_a, empresa_a):
    cat = _categoria(empresa_a, nome="Entrega", cor="#22c55e")
    evento = _evento(empresa_a, categoria=cat, cor="#ef4444")

    r = _client(admin_a).patch(
        f"/api/agenda/{evento.id}/", {"categoria": None}, format="json"
    )

    assert r.status_code == 200, r.data
    assert r.data["data"]["cor_efetiva"] == "#ef4444"


# ═══════════════════════════════════════════════════════════════════════════
# 3. QUEM PODE O QUE
# ═══════════════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_admin_cria_categoria(admin_a, empresa_a):
    r = _client(admin_a).post(
        URL, {"nome": "Cobrança", "cor": "#eab308"}, format="json"
    )

    assert r.status_code == 201, r.data
    assert CategoriaEvento.objects.filter(empresa=empresa_a, nome="Cobrança").exists()


@pytest.mark.django_db
def test_colaborador_nao_cria_categoria(colaborador_a, empresa_a):
    """Colaborador USA as categorias; quem define quais existem é o admin."""
    r = _client(colaborador_a).post(
        URL, {"nome": "Inventada", "cor": "#eab308"}, format="json"
    )

    assert r.status_code == 403
    assert not CategoriaEvento.objects.filter(empresa=empresa_a).exists()


@pytest.mark.django_db
def test_colaborador_nao_edita_categoria(colaborador_a, empresa_a):
    cat = _categoria(empresa_a, nome="Reunião", cor="#22c55e")

    r = _client(colaborador_a).patch(f"{URL}{cat.id}/", {"cor": "#ef4444"}, format="json")

    assert r.status_code == 403
    cat.refresh_from_db()
    assert cat.cor == "#22c55e"


@pytest.mark.django_db
def test_colaborador_LE_as_categorias(colaborador_a, empresa_a):
    """O formulário de evento e a legenda dependem desta leitura."""
    _categoria(empresa_a, nome="Reunião")

    r = _client(colaborador_a).get(URL)

    assert r.status_code == 200
    assert [c["nome"] for c in r.data["data"]] == ["Reunião"]


@pytest.mark.django_db
def test_nao_autenticado_401():
    assert APIClient().get(URL).status_code == 401


@pytest.mark.django_db
def test_modulo_agenda_desligado_bloqueia(admin_a, empresa_a):
    empresa_a.modulo_agenda = False
    empresa_a.save(update_fields=["modulo_agenda"])

    assert _client(admin_a).get(URL).status_code == 403


# ═══════════════════════════════════════════════════════════════════════════
# 4. DESATIVAR OCULTA, NÃO APAGA
# ═══════════════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_desativar_some_da_lista_de_opcoes(admin_a, empresa_a):
    cat = _categoria(empresa_a, nome="Antiga")

    _client(admin_a).patch(f"{URL}{cat.id}/", {"ativo": False}, format="json")

    r = _client(admin_a).get(URL)
    assert [c["nome"] for c in r.data["data"]] == []


@pytest.mark.django_db
def test_desativada_ainda_aparece_na_gestao(admin_a, empresa_a):
    """Para poder religar: escondê-la da própria gestão seria um beco."""
    cat = _categoria(empresa_a, nome="Antiga", ativo=False)

    r = _client(admin_a).get(f"{URL}?inativas=1")

    assert [c["nome"] for c in r.data["data"]] == ["Antiga"]
    assert r.data["data"][0]["ativo"] is False
    assert str(cat.id) == r.data["data"][0]["id"]


@pytest.mark.django_db
def test_desativar_nao_apaga_nem_desliga_o_evento(admin_a, empresa_a):
    """
    O ponto que a filosofia do sistema exige: o evento mantém o vínculo e a
    COR. Desativar é para a categoria parar de ser oferecida, não para eventos
    históricos mudarem de aparência sozinhos.
    """
    cat = _categoria(empresa_a, nome="Entrega", cor="#22c55e")
    evento = _evento(empresa_a, categoria=cat)

    _client(admin_a).patch(f"{URL}{cat.id}/", {"ativo": False}, format="json")

    evento.refresh_from_db()
    assert evento.categoria_id == cat.id
    assert evento.cor_efetiva == "#22c55e"
    assert CategoriaEvento.objects.filter(pk=cat.id).exists()


@pytest.mark.django_db
def test_nao_existe_delete_de_categoria(admin_a, empresa_a):
    """Apagar faria eventos antigos trocarem de cor; a rota não existe."""
    cat = _categoria(empresa_a, nome="Reunião")

    r = _client(admin_a).delete(f"{URL}{cat.id}/")

    assert r.status_code == 405
    assert CategoriaEvento.objects.filter(pk=cat.id).exists()


@pytest.mark.django_db
def test_gestao_mostra_quantos_eventos_usam(admin_a, empresa_a):
    """A tela avisa antes de desligar algo que está em uso."""
    cat = _categoria(empresa_a, nome="Entrega")
    _evento(empresa_a, categoria=cat)
    _evento(empresa_a, categoria=cat)
    _evento(empresa_a)  # sem categoria, não conta

    r = _client(admin_a).get(URL)

    assert r.data["data"][0]["eventos_count"] == 2


# ═══════════════════════════════════════════════════════════════════════════
# 5. MULTI-TENANT
# ═══════════════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_empresa_a_nao_ve_categoria_de_b(admin_a, empresa_a, empresa_b):
    _categoria(empresa_a, nome="Da A")
    _categoria(empresa_b, nome="Da B")

    r = _client(admin_a).get(URL)

    assert [c["nome"] for c in r.data["data"]] == ["Da A"]


@pytest.mark.django_db
def test_nao_edita_categoria_de_outra_empresa(admin_a, empresa_b):
    da_b = _categoria(empresa_b, nome="Da B", cor="#22c55e")

    r = _client(admin_a).patch(f"{URL}{da_b.id}/", {"cor": "#ef4444"}, format="json")

    assert r.status_code == 404
    da_b.refresh_from_db()
    assert da_b.cor == "#22c55e"


@pytest.mark.django_db
def test_nao_vincula_evento_a_categoria_de_outra_empresa(admin_a, empresa_b):
    """Passar o id do vizinho pintaria o evento com a cor dele."""
    da_b = _categoria(empresa_b, nome="Da B")
    inicio = timezone.now() + timedelta(days=1)

    r = _client(admin_a).post("/api/agenda/", {
        "titulo": "Tentativa",
        "data_inicio": inicio.isoformat(),
        "data_fim": (inicio + timedelta(hours=1)).isoformat(),
        "categoria": str(da_b.id),
    }, format="json")

    assert r.status_code == 400
    assert "categoria" in r.data["error"]["details"]


@pytest.mark.django_db
def test_nome_repetido_em_empresas_diferentes_e_permitido(admin_a, admin_b):
    """"Reunião" na A e "Reunião" na B são coisas diferentes."""
    assert _client(admin_a).post(
        URL, {"nome": "Reunião", "cor": "#22c55e"}, format="json"
    ).status_code == 201
    assert _client(admin_b).post(
        URL, {"nome": "Reunião", "cor": "#ef4444"}, format="json"
    ).status_code == 201


# ═══════════════════════════════════════════════════════════════════════════
# 6. VALIDAÇÃO
# ═══════════════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_nome_repetido_na_mesma_empresa_e_recusado(admin_a, empresa_a):
    _categoria(empresa_a, nome="Reunião")

    r = _client(admin_a).post(URL, {"nome": "Reunião", "cor": "#ef4444"}, format="json")

    assert r.status_code == 400
    assert "nome" in r.data["error"]["details"]


@pytest.mark.django_db
def test_nome_repetido_ignora_maiusculas(admin_a, empresa_a):
    """"reunião" e "Reunião" são a mesma categoria para quem lê a legenda."""
    _categoria(empresa_a, nome="Reunião")

    r = _client(admin_a).post(URL, {"nome": "reunião", "cor": "#ef4444"}, format="json")

    assert r.status_code == 400


@pytest.mark.django_db
def test_editar_a_propria_categoria_nao_colide_com_ela_mesma(admin_a, empresa_a):
    cat = _categoria(empresa_a, nome="Reunião")

    r = _client(admin_a).patch(
        f"{URL}{cat.id}/", {"nome": "Reunião", "cor": "#ef4444"}, format="json"
    )

    assert r.status_code == 200, r.data


@pytest.mark.django_db
def test_cor_invalida_e_recusada(admin_a):
    """
    A cor vai direto para um style inline: um valor torto viraria evento sem
    cor na tela, sem erro nenhum aparecendo.
    """
    for ruim in ["vermelho", "#GGG", "#12345", "rgb(1,2,3)", ""]:
        r = _client(admin_a).post(URL, {"nome": f"X{ruim}", "cor": ruim}, format="json")
        assert r.status_code == 400, f"aceitou a cor {ruim!r}"


@pytest.mark.django_db
def test_nome_curto_e_recusado(admin_a):
    r = _client(admin_a).post(URL, {"nome": "A", "cor": "#22c55e"}, format="json")

    assert r.status_code == 400


@pytest.mark.django_db
def test_nome_com_espacos_e_aparado(admin_a, empresa_a):
    _client(admin_a).post(URL, {"nome": "  Reunião  ", "cor": "#22c55e"}, format="json")

    assert CategoriaEvento.objects.get(empresa=empresa_a).nome == "Reunião"


@pytest.mark.django_db
def test_ordem_manda_na_listagem(admin_a, empresa_a):
    """A legenda sai na ordem que a empresa acha útil, não alfabética."""
    _categoria(empresa_a, nome="Zebra", ordem=1)
    _categoria(empresa_a, nome="Abelha", ordem=2)

    r = _client(admin_a).get(URL)

    assert [c["nome"] for c in r.data["data"]] == ["Zebra", "Abelha"]
