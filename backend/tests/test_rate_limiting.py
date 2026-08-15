"""
Synapse — Rate limiting dos fluxos de conta e senha (ALTO-03).

Sem limite, `registro` permite criação automatizada de empresas e
`recuperar-senha` vira email bombing (que ainda queima a quota do provedor
de e-mail). Estes testes cobrem os limites e, principalmente, a propriedade
que não pode ser perdida junto: o fluxo de recuperação continua sem revelar
se um e-mail está cadastrado.
"""
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from modules.auth.models import CustomUser, Empresa


@pytest.fixture(autouse=True)
def _limpa_cache():
    """Throttle guarda contagem no cache — cada teste começa do zero."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def usuario(db):
    empresa = Empresa.objects.create(nome="Empresa RL", plano="pro")
    return CustomUser.objects.create_user(
        email="existe@empresa.com", nome="Existe", senha="Senha@12345",
        empresa=empresa, perfil="admin",
    )


def _payload_registro(i):
    return {
        "nome_usuario": f"Fulano {i}",
        "email": f"novo{i}@empresa.com",
        "senha": "Senha@12345",
        "confirmar_senha": "Senha@12345",
        "nome_empresa": f"Empresa {i}",
        "segmento": "varejo",
    }


# ── Limites ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_registro_dentro_do_limite_funciona():
    resp = APIClient().post(
        "/api/auth/registro/", _payload_registro(0), format="json"
    )
    assert resp.status_code == 201


@pytest.mark.django_db
def test_registro_excedendo_o_limite_retorna_429():
    client = APIClient()
    # limite: 5/hora por IP
    for i in range(5):
        resp = client.post("/api/auth/registro/", _payload_registro(i), format="json")
        assert resp.status_code == 201, f"cadastro {i} deveria passar"

    resp = client.post("/api/auth/registro/", _payload_registro(99), format="json")
    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "RATE_LIMIT_EXCEDIDO"


@pytest.mark.django_db
def test_recuperar_senha_excedendo_o_limite_por_ip_retorna_429(usuario):
    client = APIClient()
    # 5/hora por IP — e-mails distintos para não bater antes no limite por e-mail
    for i in range(5):
        resp = client.post(
            "/api/auth/recuperar-senha/", {"email": f"alvo{i}@empresa.com"}, format="json"
        )
        assert resp.status_code == 200

    resp = client.post(
        "/api/auth/recuperar-senha/", {"email": "alvo99@empresa.com"}, format="json"
    )
    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "RATE_LIMIT_EXCEDIDO"


@pytest.mark.django_db
def test_recuperar_senha_limita_por_email_mesmo_variando_o_ip(usuario):
    """Protege a caixa da vítima contra atacante com IPs rotativos."""
    alvo = {"email": "existe@empresa.com"}
    for i in range(3):  # limite por e-mail: 3/hora
        resp = APIClient().post(
            "/api/auth/recuperar-senha/", alvo, format="json",
            REMOTE_ADDR=f"10.0.0.{i}",
        )
        assert resp.status_code == 200

    resp = APIClient().post(
        "/api/auth/recuperar-senha/", alvo, format="json", REMOTE_ADDR="10.0.0.200"
    )
    assert resp.status_code == 429


@pytest.mark.django_db
def test_redefinir_senha_excedendo_o_limite_retorna_429():
    client = APIClient()
    payload = {
        "token": "token-invalido-qualquer",
        "nova_senha": "Senha@12345",
        "confirmar_senha": "Senha@12345",
    }
    for _ in range(10):  # limite: 10/hora por IP
        resp = client.post("/api/auth/redefinir-senha/", payload, format="json")
        assert resp.status_code == 400  # token inválido, mas não bloqueado

    resp = client.post("/api/auth/redefinir-senha/", payload, format="json")
    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "RATE_LIMIT_EXCEDIDO"


@pytest.mark.django_db
def test_resposta_429_informa_tempo_de_espera():
    client = APIClient()
    for i in range(5):
        client.post("/api/auth/registro/", _payload_registro(i), format="json")
    resp = client.post("/api/auth/registro/", _payload_registro(99), format="json")

    assert resp.status_code == 429
    assert resp.json()["error"]["details"]["retry_after_segundos"] > 0


@pytest.mark.django_db
def test_login_continua_com_o_limite_de_antes(usuario):
    """O escopo do login não foi alterado — 5/minuto."""
    client = APIClient()
    credenciais = {"email": "existe@empresa.com", "senha": "errada"}
    for _ in range(5):
        assert client.post("/api/auth/login/", credenciais, format="json").status_code == 401

    resp = client.post("/api/auth/login/", credenciais, format="json")
    assert resp.status_code == 429


# ── Enumeração de usuário: a propriedade que não pode ser perdida ───────────

@pytest.mark.django_db
def test_recuperar_senha_responde_identico_para_email_existente_e_inexistente(usuario):
    existente = APIClient().post(
        "/api/auth/recuperar-senha/", {"email": "existe@empresa.com"}, format="json"
    )
    inexistente = APIClient().post(
        "/api/auth/recuperar-senha/", {"email": "naoexiste@empresa.com"}, format="json"
    )

    assert existente.status_code == inexistente.status_code == 200
    assert existente.json() == inexistente.json()


@pytest.mark.django_db
def test_throttle_por_email_nao_revela_cadastro(usuario):
    """
    O limite conta o e-mail SUBMETIDO, sem consultar se existe. Cadastrado e
    não cadastrado precisam ser bloqueados na mesma tentativa, com a mesma
    resposta — senão o 429 vira oráculo de "esta conta existe".
    """
    def esgota(email):
        respostas = []
        for i in range(4):  # 3 passam, a 4ª bate no limite
            respostas.append(
                APIClient().post(
                    "/api/auth/recuperar-senha/", {"email": email}, format="json",
                    REMOTE_ADDR=f"172.16.0.{i}",
                )
            )
        return respostas

    existente = esgota("existe@empresa.com")
    cache.clear()
    inexistente = esgota("naoexiste@empresa.com")

    assert [r.status_code for r in existente] == [r.status_code for r in inexistente]
    assert [r.json() for r in existente] == [r.json() for r in inexistente]
    assert existente[-1].status_code == 429


@pytest.mark.django_db
def test_throttle_de_email_usa_hash_e_nao_guarda_endereco_em_claro():
    """Cache de throttle não deve carregar PII em claro."""
    from shared.throttling import RecuperarSenhaEmailThrottle

    class _Req:
        data = {"email": "Alguem@Empresa.com"}

    chave = RecuperarSenhaEmailThrottle().get_cache_key(_Req(), None)
    assert "alguem@empresa.com" not in chave
    assert "Alguem@Empresa.com" not in chave


@pytest.mark.django_db
def test_throttle_de_email_ignora_corpo_sem_email():
    """Sem e-mail no corpo, quem responde é o limite por IP."""
    from shared.throttling import RecuperarSenhaEmailThrottle

    class _Req:
        data = {}

    assert RecuperarSenhaEmailThrottle().get_cache_key(_Req(), None) is None


@pytest.mark.django_db
def test_throttle_de_email_normaliza_maiusculas_e_espacos(usuario):
    """Variar caixa/espaço não pode ser um jeito de burlar o limite."""
    variantes = [
        "existe@empresa.com",
        "EXISTE@empresa.com",
        "  Existe@Empresa.com  ",
    ]
    for i, email in enumerate(variantes):
        resp = APIClient().post(
            "/api/auth/recuperar-senha/", {"email": email}, format="json",
            REMOTE_ADDR=f"192.168.1.{i}",
        )
        assert resp.status_code == 200

    resp = APIClient().post(
        "/api/auth/recuperar-senha/", {"email": "existe@empresa.com"}, format="json",
        REMOTE_ADDR="192.168.1.99",
    )
    assert resp.status_code == 429
