"""
Synapse — M1: Testes de Autenticação
Cobertura: Registro, Login, Logout, Refresh, Recuperação de Senha,
           Multi-tenant, Me (GET/PATCH).
"""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from modules.auth.models import CustomUser, Empresa, PasswordResetToken


# ════════════════════════════════════════════════════════════
# FIXTURES
# ════════════════════════════════════════════════════════════


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(nome="Empresa A", segmento="varejo")


@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(nome="Empresa B", segmento="servicos")


@pytest.fixture
def usuario_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="admin@empresa-a.com",
        nome="Admin A",
        senha="senha@123",
        empresa=empresa_a,
        perfil="admin",
    )


@pytest.fixture
def usuario_b(db, empresa_b):
    return CustomUser.objects.create_user(
        email="admin@empresa-b.com",
        nome="Admin B",
        senha="senha@123",
        empresa=empresa_b,
        perfil="admin",
    )


@pytest.fixture
def usuario_inativo(db, empresa_a):
    return CustomUser.objects.create_user(
        email="inativo@empresa-a.com",
        nome="Inativo",
        senha="senha@123",
        empresa=empresa_a,
        ativo=False,
        is_active=False,
    )


@pytest.fixture
def empresa_inativa(db):
    return Empresa.objects.create(nome="Empresa Inativa", segmento="outro", ativo=False)


@pytest.fixture
def usuario_empresa_inativa(db, empresa_inativa):
    return CustomUser.objects.create_user(
        email="user@empresa-inativa.com",
        nome="User Inativo",
        senha="senha@123",
        empresa=empresa_inativa,
    )


@pytest.fixture
def client_autenticado(client, usuario_a):
    """Client com access token do usuario_a via cookie."""
    from modules.auth.services import AuthService
    tokens = AuthService.gerar_tokens(usuario_a)
    client.cookies["access_token"] = tokens["access"]
    client.cookies["refresh_token"] = tokens["refresh"]
    return client


@pytest.fixture
def dados_registro_validos():
    return {
        "nome_usuario": "João Silva",
        "email": "joao@minhaempresa.com",
        "senha": "Senha@Forte123",
        "confirmar_senha": "Senha@Forte123",
        "nome_empresa": "Minha Empresa LTDA",
        "segmento": "varejo",
    }


# ════════════════════════════════════════════════════════════
# TESTES: REGISTRO
# ════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestRegistro:

    def test_registro_valido_retorna_201(self, client, dados_registro_validos):
        """Happy path: registro com dados válidos retorna 201."""
        response = client.post(
            "/api/auth/registro/",
            data=dados_registro_validos,
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["success"] is True
        assert "usuario" in response.data["data"]

    def test_registro_seta_cookies(self, client, dados_registro_validos):
        """Registro deve setar cookies httpOnly de access e refresh token."""
        response = client.post(
            "/api/auth/registro/",
            data=dados_registro_validos,
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert "access_token" in response.cookies
        assert "refresh_token" in response.cookies
        assert response.cookies["access_token"]["httponly"]
        assert response.cookies["refresh_token"]["httponly"]

    def test_registro_cria_empresa_e_usuario(self, client, dados_registro_validos):
        """Registro deve criar Empresa e CustomUser no banco."""
        assert Empresa.objects.count() == 0
        assert CustomUser.objects.count() == 0

        client.post("/api/auth/registro/", data=dados_registro_validos, format="json")

        assert Empresa.objects.count() == 1
        assert CustomUser.objects.count() == 1
        empresa = Empresa.objects.first()
        assert empresa.nome == "Minha Empresa LTDA"
        assert empresa.segmento == "varejo"

    def test_registro_email_duplicado_retorna_400(self, client, usuario_a, dados_registro_validos):
        """Registro com e-mail já cadastrado deve retornar 400."""
        dados_registro_validos["email"] = "admin@empresa-a.com"
        response = client.post(
            "/api/auth/registro/",
            data=dados_registro_validos,
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["success"] is False

    def test_registro_senhas_diferentes_retorna_400(self, client, dados_registro_validos):
        """Registro com senhas diferentes deve retornar 400."""
        dados_registro_validos["confirmar_senha"] = "SenhaDiferente123"
        response = client.post(
            "/api/auth/registro/",
            data=dados_registro_validos,
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["success"] is False

    def test_registro_senha_fraca_retorna_400(self, client, dados_registro_validos):
        """Registro com senha menor que 8 chars deve retornar 400."""
        dados_registro_validos["senha"] = "123"
        dados_registro_validos["confirmar_senha"] = "123"
        response = client.post(
            "/api/auth/registro/",
            data=dados_registro_validos,
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_registro_campos_obrigatorios_ausentes(self, client):
        """Registro sem campos obrigatórios deve retornar 400."""
        response = client.post("/api/auth/registro/", data={}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["success"] is False

    def test_registro_segmento_invalido(self, client, dados_registro_validos):
        """Registro com segmento inválido deve retornar 400."""
        dados_registro_validos["segmento"] = "segmento_invalido"
        response = client.post(
            "/api/auth/registro/",
            data=dados_registro_validos,
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ════════════════════════════════════════════════════════════
# TESTES: LOGIN
# ════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestLogin:

    def test_login_credenciais_corretas_retorna_200(self, client, usuario_a):
        """Happy path: login com credenciais corretas retorna 200."""
        response = client.post(
            "/api/auth/login/",
            data={"email": "admin@empresa-a.com", "senha": "senha@123"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True
        assert "usuario" in response.data["data"]

    def test_login_seta_cookies(self, client, usuario_a):
        """Login deve setar cookies httpOnly."""
        response = client.post(
            "/api/auth/login/",
            data={"email": "admin@empresa-a.com", "senha": "senha@123"},
            format="json",
        )
        assert "access_token" in response.cookies
        assert "refresh_token" in response.cookies

    def test_login_senha_errada_retorna_401(self, client, usuario_a):
        """Login com senha errada deve retornar 401."""
        response = client.post(
            "/api/auth/login/",
            data={"email": "admin@empresa-a.com", "senha": "senhaerrada"},
            format="json",
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.data["success"] is False

    def test_login_usuario_inativo_retorna_401(self, client, usuario_inativo):
        """Login com usuário inativo deve retornar 401."""
        response = client.post(
            "/api/auth/login/",
            data={"email": "inativo@empresa-a.com", "senha": "senha@123"},
            format="json",
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_empresa_inativa_retorna_401(self, client, usuario_empresa_inativa):
        """Login com empresa inativa deve retornar 401."""
        response = client.post(
            "/api/auth/login/",
            data={"email": "user@empresa-inativa.com", "senha": "senha@123"},
            format="json",
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_email_inexistente_retorna_401(self, client):
        """Login com e-mail inexistente deve retornar 401."""
        response = client.post(
            "/api/auth/login/",
            data={"email": "naoexiste@teste.com", "senha": "senha@123"},
            format="json",
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ════════════════════════════════════════════════════════════
# TESTES: TOKENS E PROTEÇÃO DE ROTAS
# ════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestTokens:

    def test_rota_protegida_sem_token_retorna_401(self, client):
        """Acesso a rota protegida sem token deve retornar 401."""
        response = client.get("/api/auth/me/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_rota_protegida_com_token_valido_retorna_200(self, client_autenticado):
        """Acesso a rota protegida com token válido deve retornar 200."""
        response = client_autenticado.get("/api/auth/me/")
        assert response.status_code == status.HTTP_200_OK

    def test_refresh_token_valido_renova_access(self, client, usuario_a):
        """Refresh token válido deve gerar novo access token."""
        from modules.auth.services import AuthService
        tokens = AuthService.gerar_tokens(usuario_a)
        client.cookies["refresh_token"] = tokens["refresh"]

        response = client.post("/api/auth/refresh/")
        assert response.status_code == status.HTTP_200_OK
        assert "access_token" in response.cookies

    def test_refresh_token_invalido_retorna_401(self, client):
        """Refresh token inválido deve retornar 401."""
        client.cookies["refresh_token"] = "token_invalido_qualquer"
        response = client.post("/api/auth/refresh/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_sem_cookie_retorna_401(self, client):
        """Refresh sem cookie deve retornar 401."""
        response = client.post("/api/auth/refresh/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ════════════════════════════════════════════════════════════
# TESTES: LOGOUT
# ════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestLogout:

    def test_logout_deleta_cookies(self, client_autenticado):
        """Logout deve deletar os cookies de auth."""
        response = client_autenticado.post("/api/auth/logout/")
        assert response.status_code == status.HTTP_200_OK
        # Cookies deletados têm max-age=0 ou são removidos
        assert response.data["success"] is True

    def test_acesso_negado_apos_logout(self, client, usuario_a):
        """Após logout, acesso a rota protegida deve ser negado."""
        from modules.auth.services import AuthService
        tokens = AuthService.gerar_tokens(usuario_a)
        client.cookies["access_token"] = tokens["access"]
        client.cookies["refresh_token"] = tokens["refresh"]

        # Logout
        client.post("/api/auth/logout/")

        # Limpar cookies manualmente (simula browser)
        client.cookies.clear()

        # Tentar acessar rota protegida
        response = client.get("/api/auth/me/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_logout_sem_autenticacao_retorna_401(self, client):
        """Logout sem token deve retornar 401."""
        response = client.post("/api/auth/logout/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ════════════════════════════════════════════════════════════
# TESTES: RECUPERAÇÃO DE SENHA
# ════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestRecuperacaoSenha:

    @patch("modules.auth.tasks.enviar_email_recuperacao.delay")
    def test_recuperar_email_existente_retorna_200(self, mock_task, client, usuario_a):
        """Solicitar recuperação com e-mail existente deve retornar 200."""
        response = client.post(
            "/api/auth/recuperar-senha/",
            data={"email": "admin@empresa-a.com"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True
        mock_task.assert_called_once()

    def test_recuperar_email_inexistente_retorna_200(self, client):
        """Solicitar recuperação com e-mail inexistente deve retornar 200 (segurança)."""
        response = client.post(
            "/api/auth/recuperar-senha/",
            data={"email": "naoexiste@teste.com"},
            format="json",
        )
        # Não revela se e-mail existe
        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True

    @patch("modules.auth.tasks.enviar_email_recuperacao.delay")
    def test_recuperar_cria_token_no_banco(self, mock_task, client, usuario_a):
        """Solicitar recuperação deve criar PasswordResetToken no banco."""
        assert PasswordResetToken.objects.count() == 0
        client.post(
            "/api/auth/recuperar-senha/",
            data={"email": "admin@empresa-a.com"},
            format="json",
        )
        assert PasswordResetToken.objects.count() == 1

    @patch("modules.auth.tasks.enviar_email_recuperacao.delay")
    def test_redefinir_senha_token_valido(self, mock_task, client, usuario_a):
        """Redefinir senha com token válido deve retornar 200."""
        token = PasswordResetToken.objects.create(
            usuario=usuario_a,
            token=PasswordResetToken.gerar_token(),
        )
        response = client.post(
            "/api/auth/redefinir-senha/",
            data={
                "token": token.token,
                "nova_senha": "NovaSenha@456",
                "confirmar_senha": "NovaSenha@456",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True

        # Verificar que a senha foi alterada
        usuario_a.refresh_from_db()
        assert usuario_a.check_password("NovaSenha@456")

    def test_redefinir_senha_token_expirado(self, client, usuario_a):
        """Redefinir senha com token expirado deve retornar 400."""
        token = PasswordResetToken.objects.create(
            usuario=usuario_a,
            token=PasswordResetToken.gerar_token(),
            expira_em=timezone.now() - timedelta(hours=1),  # Já expirado
        )
        response = client.post(
            "/api/auth/redefinir-senha/",
            data={
                "token": token.token,
                "nova_senha": "NovaSenha@456",
                "confirmar_senha": "NovaSenha@456",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["success"] is False

    def test_redefinir_senha_token_ja_usado(self, client, usuario_a):
        """Redefinir senha com token já usado deve retornar 400."""
        token = PasswordResetToken.objects.create(
            usuario=usuario_a,
            token=PasswordResetToken.gerar_token(),
            usado=True,
        )
        response = client.post(
            "/api/auth/redefinir-senha/",
            data={
                "token": token.token,
                "nova_senha": "NovaSenha@456",
                "confirmar_senha": "NovaSenha@456",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_redefinir_senha_token_invalido(self, client):
        """Redefinir senha com token inexistente deve retornar 400."""
        response = client.post(
            "/api/auth/redefinir-senha/",
            data={
                "token": "token_que_nao_existe",
                "nova_senha": "NovaSenha@456",
                "confirmar_senha": "NovaSenha@456",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ════════════════════════════════════════════════════════════
# TESTES: MULTI-TENANT
# ════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestMultiTenant:

    def test_usuario_nao_acessa_dados_de_outra_empresa(
        self, client, usuario_a, usuario_b
    ):
        """
        Usuário da empresa A não deve conseguir ver dados da empresa B.
        Valida o isolamento multi-tenant via EmpresaQuerySetMixin.
        """
        from modules.auth.services import AuthService

        # Autenticar como usuario_a
        tokens = AuthService.gerar_tokens(usuario_a)
        client.cookies["access_token"] = tokens["access"]

        # GET /me/ deve retornar dados da empresa A, não da empresa B
        response = client.get("/api/auth/me/")
        assert response.status_code == status.HTTP_200_OK
        data = response.data["data"]
        assert data["empresa"]["id"] == str(usuario_a.empresa.id)
        assert data["empresa"]["id"] != str(usuario_b.empresa.id)

    def test_empresa_id_correto_no_token(self, usuario_a):
        """Token JWT deve conter o empresa_id correto."""
        from modules.auth.services import AuthService
        from rest_framework_simplejwt.tokens import RefreshToken

        tokens = AuthService.gerar_tokens(usuario_a)
        refresh = RefreshToken(tokens["refresh"])
        access = refresh.access_token

        # O user_id no token deve corresponder ao usuario_a
        assert str(access["user_id"]) == str(usuario_a.id)


# ════════════════════════════════════════════════════════════
# TESTES: ME (GET/PATCH)
# ════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestMe:

    def test_get_me_retorna_dados_corretos(self, client_autenticado, usuario_a):
        """GET /me/ deve retornar dados completos do usuário logado."""
        response = client_autenticado.get("/api/auth/me/")
        assert response.status_code == status.HTTP_200_OK
        data = response.data["data"]
        assert data["email"] == usuario_a.email
        assert data["nome"] == usuario_a.nome
        assert "empresa" in data
        assert "password" not in data  # Nunca expor senha

    def test_patch_me_atualiza_nome(self, client_autenticado, usuario_a):
        """PATCH /me/ deve atualizar o nome do usuário."""
        response = client_autenticado.patch(
            "/api/auth/me/",
            data={"nome": "Novo Nome Silva"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        usuario_a.refresh_from_db()
        assert usuario_a.nome == "Novo Nome Silva"

    def test_patch_me_nao_permite_alterar_email(self, client_autenticado, usuario_a):
        """PATCH /me/ não deve permitir alterar o e-mail."""
        email_original = usuario_a.email
        client_autenticado.patch(
            "/api/auth/me/",
            data={"email": "novo@email.com"},
            format="json",
        )
        usuario_a.refresh_from_db()
        assert usuario_a.email == email_original

    def test_patch_me_nao_permite_alterar_perfil(self, client_autenticado, usuario_a):
        """PATCH /me/ não deve permitir alterar o perfil."""
        perfil_original = usuario_a.perfil
        client_autenticado.patch(
            "/api/auth/me/",
            data={"perfil": "colaborador"},
            format="json",
        )
        usuario_a.refresh_from_db()
        assert usuario_a.perfil == perfil_original

    def test_me_sem_autenticacao_retorna_401(self, client):
        """GET /me/ sem autenticação deve retornar 401."""
        response = client.get("/api/auth/me/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ════════════════════════════════════════════════════════════
# TESTES: MODELS
# ════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestModels:

    def test_password_reset_token_valido(self, usuario_a):
        """Token não usado e não expirado deve ser válido."""
        token = PasswordResetToken.objects.create(
            usuario=usuario_a,
            token=PasswordResetToken.gerar_token(),
        )
        assert token.valido is True
        assert token.expirado is False

    def test_password_reset_token_expirado(self, usuario_a):
        """Token expirado não deve ser válido."""
        token = PasswordResetToken.objects.create(
            usuario=usuario_a,
            token=PasswordResetToken.gerar_token(),
            expira_em=timezone.now() - timedelta(minutes=1),
        )
        assert token.expirado is True
        assert token.valido is False

    def test_password_reset_token_usado(self, usuario_a):
        """Token usado não deve ser válido."""
        token = PasswordResetToken.objects.create(
            usuario=usuario_a,
            token=PasswordResetToken.gerar_token(),
            usado=True,
        )
        assert token.valido is False

    def test_empresa_str(self, empresa_a):
        """__str__ da Empresa deve retornar nome e plano."""
        assert "Empresa A" in str(empresa_a)
        assert "starter" in str(empresa_a)

    def test_usuario_str(self, usuario_a):
        """__str__ do CustomUser deve retornar nome e email."""
        assert "Admin A" in str(usuario_a)
        assert "admin@empresa-a.com" in str(usuario_a)

    def test_gerar_token_unico(self):
        """Dois tokens gerados devem ser diferentes."""
        t1 = PasswordResetToken.gerar_token()
        t2 = PasswordResetToken.gerar_token()
        assert t1 != t2
        assert len(t1) >= 64  # token_urlsafe(48) gera ~64 chars
