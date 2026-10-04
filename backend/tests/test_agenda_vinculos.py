"""
Synapse — Agenda: vínculo do evento com projeto e venda (AGENDA_AUDIT, item 7).

Última peça da Fase B. O evento já sabia de que CLIENTE era; agora sabe também
de que projeto e de que venda. Os três são independentes e podem coexistir: a
reunião de entrega é do cliente, do projeto e da venda ao mesmo tempo.

O que mais importa aqui:

1. EVENTO ANTIGO NÃO QUEBRA. Quem existia antes chega com projeto=null e
   venda=null, continua na listagem e continua respondendo no detalhe.
2. Multi-tenant nos dois vínculos novos — mesma guarda que o cliente já tinha.
3. Módulo Projetos desligado não deixa criar um vínculo que nenhuma tela mostra.
4. Os filtros `?projeto=` e `?venda=` são o que alimenta as duas telas novas.
"""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.agenda.models import Evento
from modules.auth.models import CustomUser, Empresa
from modules.clientes.models import Cliente
from modules.projetos.models import Projeto
from modules.vendas.models import Venda

URL = "/api/agenda/"


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(nome="Empresa A Vínculos", plano="starter")


@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(nome="Empresa B Vínculos", plano="starter")


@pytest.fixture
def user_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="user@vinc.com", nome="Usuário A", senha="Senha@12345",
        empresa=empresa_a, perfil="admin",
    )


@pytest.fixture
def user_b(db, empresa_b):
    return CustomUser.objects.create_user(
        email="user@vinc-b.com", nome="Usuário B", senha="Senha@12345",
        empresa=empresa_b, perfil="admin",
    )


def _client(usuario):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(usuario).access_token)
    return c


def _projeto(empresa, nome="Casamento Ana e João"):
    return Projeto.objects.create(empresa=empresa, nome=nome)


def _venda(empresa, cliente=None, **over):
    dados = {"empresa": empresa, "cliente": cliente, "total": Decimal("150.00")}
    dados.update(over)
    return Venda.objects.create(**dados)


def _cliente(empresa, nome="Ana Paula"):
    return Cliente.objects.create(empresa=empresa, nome=nome)


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


def _payload(**over):
    inicio = timezone.now() + timedelta(days=2)
    dados = {
        "titulo": "Reunião de entrega",
        "data_inicio": inicio.isoformat(),
        "data_fim": (inicio + timedelta(hours=1)).isoformat(),
    }
    dados.update(over)
    return dados


# ═══════════════════════════════════════════════════════════════════════════
# 1. O EVENTO ANTIGO NÃO QUEBRA
# ═══════════════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_evento_de_antes_chega_com_projeto_e_venda_nulos(empresa_a):
    """O estado de TODOS os eventos que já existiam quando os vínculos entraram."""
    antigo = _evento(empresa_a, titulo="De antes dos vínculos")

    assert antigo.projeto_id is None
    assert antigo.venda_id is None


@pytest.mark.django_db
def test_evento_antigo_continua_na_listagem(user_a, empresa_a):
    """Não basta não quebrar: ele não pode SUMIR."""
    _evento(empresa_a, titulo="De antes dos vínculos")

    r = _client(user_a).get(URL)

    assert r.status_code == 200
    item = r.data["data"][0]
    assert item["titulo"] == "De antes dos vínculos"
    assert item["projeto"] is None
    assert item["projeto_nome"] is None
    assert item["venda"] is None
    assert item["venda_rotulo"] is None


@pytest.mark.django_db
def test_evento_antigo_continua_respondendo_no_detalhe(user_a, empresa_a):
    antigo = _evento(empresa_a)

    r = _client(user_a).get(f"{URL}{antigo.id}/")

    assert r.status_code == 200
    assert r.data["data"]["projeto"] is None


@pytest.mark.django_db
def test_editar_evento_antigo_sem_mandar_os_vinculos_nao_os_inventa(user_a, empresa_a):
    """PATCH parcial: mexer no título não pode preencher vínculo nenhum."""
    antigo = _evento(empresa_a, titulo="Antigo")

    r = _client(user_a).patch(
        f"{URL}{antigo.id}/", {"titulo": "Antigo renomeado"}, format="json"
    )

    assert r.status_code == 200
    antigo.refresh_from_db()
    assert antigo.titulo == "Antigo renomeado"
    assert antigo.projeto_id is None
    assert antigo.venda_id is None


# ═══════════════════════════════════════════════════════════════════════════
# 2. VINCULAR FUNCIONA — E OS TRÊS CONVIVEM
# ═══════════════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_vincula_evento_a_projeto(user_a, empresa_a):
    projeto = _projeto(empresa_a)

    r = _client(user_a).post(URL, _payload(projeto=str(projeto.id)), format="json")

    assert r.status_code == 201
    assert str(r.data["data"]["projeto"]) == str(projeto.id)
    assert r.data["data"]["projeto_nome"] == "Casamento Ana e João"


@pytest.mark.django_db
def test_vincula_evento_a_venda(user_a, empresa_a):
    venda = _venda(empresa_a)

    r = _client(user_a).post(URL, _payload(venda=str(venda.id)), format="json")

    assert r.status_code == 201
    assert str(r.data["data"]["venda"]) == str(venda.id)
    # A venda não tem nome: o rótulo é a data, que é como a pessoa a reconhece.
    assert r.data["data"]["venda_rotulo"].startswith("Venda de ")


@pytest.mark.django_db
def test_cliente_projeto_e_venda_ao_mesmo_tempo(user_a, empresa_a):
    """
    O caso que justifica a fase: a reunião de entrega É das três coisas. Nada
    aqui pode tratar os vínculos como mutuamente exclusivos.
    """
    cliente = _cliente(empresa_a)
    projeto = _projeto(empresa_a)
    venda = _venda(empresa_a, cliente=cliente)

    r = _client(user_a).post(
        URL,
        _payload(
            cliente=str(cliente.id), projeto=str(projeto.id), venda=str(venda.id)
        ),
        format="json",
    )

    assert r.status_code == 201
    dados = r.data["data"]
    assert str(dados["cliente"]) == str(cliente.id)
    assert str(dados["projeto"]) == str(projeto.id)
    assert str(dados["venda"]) == str(venda.id)


@pytest.mark.django_db
def test_evento_sem_vinculo_nenhum_continua_valido(user_a, empresa_a):
    """A maioria dos eventos é assim — nenhum vínculo é obrigatório."""
    r = _client(user_a).post(URL, _payload(), format="json")

    assert r.status_code == 201
    assert r.data["data"]["projeto"] is None
    assert r.data["data"]["venda"] is None


@pytest.mark.django_db
def test_desvincular_manda_null(user_a, empresa_a):
    projeto = _projeto(empresa_a)
    evento = _evento(empresa_a, projeto=projeto)

    r = _client(user_a).patch(
        f"{URL}{evento.id}/", {"projeto": None}, format="json"
    )

    assert r.status_code == 200
    evento.refresh_from_db()
    assert evento.projeto_id is None


@pytest.mark.django_db
def test_apagar_o_projeto_nao_apaga_o_evento(empresa_a):
    """
    SET_NULL, não CASCADE: a reunião aconteceu. Apagar o projeto não pode
    apagar o registro de que ela aconteceu.
    """
    projeto = _projeto(empresa_a)
    evento = _evento(empresa_a, projeto=projeto)

    projeto.delete()

    evento.refresh_from_db()
    assert evento.projeto_id is None


@pytest.mark.django_db
def test_apagar_a_venda_nao_apaga_o_evento(empresa_a):
    venda = _venda(empresa_a)
    evento = _evento(empresa_a, venda=venda)

    venda.delete()

    evento.refresh_from_db()
    assert evento.venda_id is None


# ═══════════════════════════════════════════════════════════════════════════
# 3. MULTI-TENANT
# ═══════════════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_projeto_de_outra_empresa_e_recusado(user_a, empresa_b):
    projeto_alheio = _projeto(empresa_b, nome="Projeto do vizinho")

    r = _client(user_a).post(
        URL, _payload(projeto=str(projeto_alheio.id)), format="json"
    )

    assert r.status_code == 400
    assert "projeto" in r.data["error"]["details"]


@pytest.mark.django_db
def test_venda_de_outra_empresa_e_recusada(user_a, empresa_b):
    venda_alheia = _venda(empresa_b)

    r = _client(user_a).post(
        URL, _payload(venda=str(venda_alheia.id)), format="json"
    )

    assert r.status_code == 400
    assert "venda" in r.data["error"]["details"]


@pytest.mark.django_db
def test_patch_nao_deixa_trocar_para_projeto_alheio(user_a, empresa_a, empresa_b):
    """A guarda não pode existir só na criação."""
    evento = _evento(empresa_a)
    projeto_alheio = _projeto(empresa_b)

    r = _client(user_a).patch(
        f"{URL}{evento.id}/", {"projeto": str(projeto_alheio.id)}, format="json"
    )

    assert r.status_code == 400
    evento.refresh_from_db()
    assert evento.projeto_id is None


@pytest.mark.django_db
def test_filtro_por_projeto_nao_atravessa_empresa(user_a, empresa_a, empresa_b):
    """
    Pedir o projeto do vizinho pelo filtro devolve lista vazia, não os eventos
    dele: o recorte por empresa vem antes do filtro no queryset.
    """
    projeto_alheio = _projeto(empresa_b)
    _evento(empresa_b, projeto=projeto_alheio, titulo="Evento do vizinho")

    r = _client(user_a).get(URL, {"projeto": str(projeto_alheio.id)})

    assert r.status_code == 200
    assert r.data["data"] == []


# ═══════════════════════════════════════════════════════════════════════════
# 4. MÓDULO PROJETOS DESLIGADO
# ═══════════════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_modulo_projetos_desligado_recusa_o_vinculo(user_a, empresa_a):
    """
    Sem isto o vínculo nasceria invisível: nenhuma tela de projeto existe para
    a empresa que desligou o módulo, então quem criou não teria como revê-lo.
    """
    projeto = _projeto(empresa_a)
    empresa_a.modulo_projetos = False
    empresa_a.save()

    r = _client(user_a).post(URL, _payload(projeto=str(projeto.id)), format="json")

    assert r.status_code == 400
    assert "projeto" in r.data["error"]["details"]


@pytest.mark.django_db
def test_modulo_desligado_nao_impede_evento_sem_projeto(user_a, empresa_a):
    """A agenda continua inteira: só o vínculo com projeto é que não vale."""
    empresa_a.modulo_projetos = False
    empresa_a.save()

    r = _client(user_a).post(URL, _payload(), format="json")

    assert r.status_code == 201


@pytest.mark.django_db
def test_vinculo_antigo_sobrevive_a_desligar_o_modulo(user_a, empresa_a):
    """
    Desligar módulo OCULTA, não apaga — é a filosofia do sistema. O evento que
    já estava vinculado mantém o vínculo e continua listando.
    """
    projeto = _projeto(empresa_a)
    evento = _evento(empresa_a, projeto=projeto)

    empresa_a.modulo_projetos = False
    empresa_a.save()

    r = _client(user_a).get(URL)

    assert r.status_code == 200
    assert str(r.data["data"][0]["projeto"]) == str(projeto.id)
    evento.refresh_from_db()
    assert evento.projeto_id == projeto.id


@pytest.mark.django_db
def test_venda_nao_e_barrada_por_modulo(user_a, empresa_a):
    """
    "vendas" não é módulo opcional e as views de venda não têm ModuloAtivo.
    Barrar aqui criaria uma inconsistência: a empresa teria vendas no banco,
    a API de vendas respondendo, e só a agenda recusando vinculá-las.
    """
    venda = _venda(empresa_a)
    empresa_a.modulo_estoque = False
    empresa_a.save()

    r = _client(user_a).post(URL, _payload(venda=str(venda.id)), format="json")

    assert r.status_code == 201


# ═══════════════════════════════════════════════════════════════════════════
# 5. OS FILTROS QUE ALIMENTAM AS TELAS NOVAS
# ═══════════════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_filtra_eventos_de_um_projeto(user_a, empresa_a):
    projeto = _projeto(empresa_a)
    outro = _projeto(empresa_a, nome="Outro projeto")
    _evento(empresa_a, projeto=projeto, titulo="Do projeto")
    _evento(empresa_a, projeto=outro, titulo="Do outro")
    _evento(empresa_a, titulo="Sem projeto")

    r = _client(user_a).get(URL, {"projeto": str(projeto.id)})

    assert r.status_code == 200
    assert [e["titulo"] for e in r.data["data"]] == ["Do projeto"]


@pytest.mark.django_db
def test_filtra_eventos_de_uma_venda(user_a, empresa_a):
    venda = _venda(empresa_a)
    _evento(empresa_a, venda=venda, titulo="Da venda")
    _evento(empresa_a, titulo="Sem venda")

    r = _client(user_a).get(URL, {"venda": str(venda.id)})

    assert r.status_code == 200
    assert [e["titulo"] for e in r.data["data"]] == ["Da venda"]


@pytest.mark.django_db
def test_um_evento_de_cliente_e_projeto_sai_nos_dois_filtros(user_a, empresa_a):
    """
    Não é duplicação: o evento É dos dois, e aparecer nas duas telas é o
    comportamento correto.
    """
    cliente = _cliente(empresa_a)
    projeto = _projeto(empresa_a)
    _evento(empresa_a, cliente=cliente, projeto=projeto, titulo="Dos dois")

    c = _client(user_a)
    por_cliente = c.get(URL, {"cliente": str(cliente.id)})
    por_projeto = c.get(URL, {"projeto": str(projeto.id)})

    assert [e["titulo"] for e in por_cliente.data["data"]] == ["Dos dois"]
    assert [e["titulo"] for e in por_projeto.data["data"]] == ["Dos dois"]


@pytest.mark.django_db
def test_filtro_com_id_invalido_nao_estoura(user_a, empresa_a):
    """Lixo no query param lista sem o filtro, não devolve 500."""
    _evento(empresa_a, titulo="Qualquer")

    r = _client(user_a).get(URL, {"projeto": "nao-e-uuid"})

    assert r.status_code == 200
    assert len(r.data["data"]) == 1


@pytest.mark.django_db
def test_combinar_projeto_e_venda_e_E_nao_OU(user_a, empresa_a):
    projeto = _projeto(empresa_a)
    venda = _venda(empresa_a)
    _evento(empresa_a, projeto=projeto, venda=venda, titulo="Tem os dois")
    _evento(empresa_a, projeto=projeto, titulo="Só projeto")
    _evento(empresa_a, venda=venda, titulo="Só venda")

    r = _client(user_a).get(
        URL, {"projeto": str(projeto.id), "venda": str(venda.id)}
    )

    assert [e["titulo"] for e in r.data["data"]] == ["Tem os dois"]


@pytest.mark.django_db
def test_listagem_com_vinculos_nao_faz_query_por_evento(user_a, empresa_a):
    """
    O serializer publica o nome de cada vínculo. Sem select_related, uma lista
    de eventos vira uma enxurrada de queries — e o custo cresce com o uso.
    """
    from django.test.utils import CaptureQueriesContext
    from django.db import connection

    projeto = _projeto(empresa_a)
    venda = _venda(empresa_a, cliente=_cliente(empresa_a))
    for i in range(7):
        _evento(
            empresa_a,
            titulo=f"Evento {i}",
            projeto=projeto,
            venda=venda,
            cliente=venda.cliente,
        )

    c = _client(user_a)
    with CaptureQueriesContext(connection) as capturadas:
        r = c.get(URL)

    assert r.status_code == 200
    assert len(r.data["data"]) == 7
    # Uma consulta por evento seriam 20+. O teto aqui é folgado de propósito:
    # o que ele pega é a volta do N+1, não o número exato de hoje.
    assert len(capturadas) < 15, f"{len(capturadas)} queries — N+1 voltou?"


# ═══════════════════════════════════════════════════════════════════════════
# 6. MÓDULO DESLIGADO NÃO TRANCA O EVENTO (CODE_HEALTH_AUDIT, PR54-01)
#
# O gating recusava qualquer `projeto` não-nulo com o módulo off, sem distinguir
# CRIAR vínculo de MANTER o que já estava. Como o formulário reenvia o vínculo
# atual (o estado inicial vem de `evento.projeto`, independente do gating), todo
# PATCH chegava com o projeto preenchido e levava 400 — a empresa que desligou
# Projetos não conseguia nem renomear um evento vinculado, e a tela não oferecia
# saída, porque com o módulo off o seletor não aparece.
# ═══════════════════════════════════════════════════════════════════════════

@pytest.fixture
def evento_vinculado_modulo_off(empresa_a, user_a):
    """Evento com projeto, numa empresa que depois desligou o módulo."""
    projeto = _projeto(empresa_a)
    evento = _evento(empresa_a, titulo="Reunião do projeto", projeto=projeto)
    empresa_a.modulo_projetos = False
    empresa_a.save()
    return evento, projeto


@pytest.mark.django_db
def test_renomear_evento_vinculado_com_modulo_off(
    user_a, empresa_a, evento_vinculado_modulo_off
):
    """O caso que estava quebrado: mexer só no título."""
    evento, projeto = evento_vinculado_modulo_off

    r = _client(user_a).patch(
        f"{URL}{evento.id}/",
        {"titulo": "Reunião renomeada", "projeto": str(projeto.id)},
        format="json",
    )

    assert r.status_code == 200, r.data
    evento.refresh_from_db()
    assert evento.titulo == "Reunião renomeada"
    assert evento.projeto_id == projeto.id, "o vínculo foi perdido na edição"


@pytest.mark.django_db
def test_remarcar_evento_vinculado_com_modulo_off(
    user_a, empresa_a, evento_vinculado_modulo_off
):
    """Arrastar no calendário também manda o vínculo atual de volta."""
    evento, projeto = evento_vinculado_modulo_off
    novo_inicio = timezone.now() + timedelta(days=5)

    r = _client(user_a).patch(
        f"{URL}{evento.id}/",
        {
            "data_inicio": novo_inicio.isoformat(),
            "data_fim": (novo_inicio + timedelta(hours=1)).isoformat(),
            "projeto": str(projeto.id),
        },
        format="json",
    )

    assert r.status_code == 200, r.data


@pytest.mark.django_db
def test_trocar_para_outro_projeto_com_modulo_off_continua_bloqueado(
    user_a, empresa_a, evento_vinculado_modulo_off
):
    """
    O que o gating existe para impedir segue impedido: um vínculo NOVO, que
    nenhuma tela mostraria.
    """
    evento, _ = evento_vinculado_modulo_off
    outro = _projeto(empresa_a, nome="Outro projeto")

    r = _client(user_a).patch(
        f"{URL}{evento.id}/", {"projeto": str(outro.id)}, format="json"
    )

    assert r.status_code == 400
    assert "projeto" in r.data["error"]["details"]


@pytest.mark.django_db
def test_criar_evento_com_projeto_e_modulo_off_continua_bloqueado(
    user_a, empresa_a
):
    projeto = _projeto(empresa_a)
    empresa_a.modulo_projetos = False
    empresa_a.save()

    r = _client(user_a).post(URL, _payload(projeto=str(projeto.id)), format="json")

    assert r.status_code == 400
    assert "projeto" in r.data["error"]["details"]


@pytest.mark.django_db
def test_desvincular_com_modulo_off_e_permitido(
    user_a, empresa_a, evento_vinculado_modulo_off
):
    """
    Mandar null é se livrar do vínculo, não criar um. Tem de passar — é a única
    forma de a pessoa limpar o vínculo depois de desligar o módulo.
    """
    evento, _ = evento_vinculado_modulo_off

    r = _client(user_a).patch(f"{URL}{evento.id}/", {"projeto": None}, format="json")

    assert r.status_code == 200
    evento.refresh_from_db()
    assert evento.projeto_id is None


@pytest.mark.django_db
def test_a_guarda_de_empresa_nao_afrouxa_com_o_modulo_off(
    user_a, empresa_a, empresa_b, evento_vinculado_modulo_off
):
    """
    A exceção é só para o GATING DE MÓDULO. A guarda multi-tenant é segurança
    e vale sempre — inclusive quando o id mandado é o de um projeto alheio.
    """
    evento, _ = evento_vinculado_modulo_off
    alheio = _projeto(empresa_b, nome="Projeto do vizinho")

    r = _client(user_a).patch(
        f"{URL}{evento.id}/", {"projeto": str(alheio.id)}, format="json"
    )

    assert r.status_code == 400
    assert "projeto" in r.data["error"]["details"]


@pytest.mark.django_db
def test_com_modulo_ligado_trocar_de_projeto_funciona(user_a, empresa_a):
    """A correção não pode ter afrouxado o caminho normal."""
    projeto = _projeto(empresa_a)
    outro = _projeto(empresa_a, nome="Outro")
    evento = _evento(empresa_a, projeto=projeto)

    r = _client(user_a).patch(
        f"{URL}{evento.id}/", {"projeto": str(outro.id)}, format="json"
    )

    assert r.status_code == 200
    evento.refresh_from_db()
    assert evento.projeto_id == outro.id
