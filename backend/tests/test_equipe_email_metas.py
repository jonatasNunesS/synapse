"""
Synapse — E-mail HTML de metas da equipe.

Cobre os 3 momentos (criada/editada/concluída), o disparo único do e-mail de
conclusão, o destinatário (só o membro — nunca o admin), o diff no e-mail de
edição, a resiliência (Resend ausente/erro não quebra o save) e o multi-tenant.

Estratégia: patch de `modules.equipe.emails._enviar` (boundary de envio) — assim
o HTML é REALMENTE montado (exercitando o template) e inspecionamos to/assunto/html.
"""
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest

from modules.auth.models import CustomUser, Empresa
from modules.equipe.models import MembroEquipe, MetaMembro
from modules.equipe.services import EquipeService


@pytest.fixture
def empresa(db):
    return Empresa.objects.create(nome="Empresa Meta", plano="pro")


@pytest.fixture
def admin(db, empresa):
    return CustomUser.objects.create_user(
        email="admin@meta.com", nome="Admin", senha="Senha@12345",
        empresa=empresa, perfil="admin",
    )


@pytest.fixture
def usuario_membro(db, empresa):
    return CustomUser.objects.create_user(
        email="membro@meta.com", nome="Maria Membro", senha="Senha@12345",
        empresa=empresa, perfil="colaborador",
    )


@pytest.fixture
def membro(db, empresa, usuario_membro):
    return MembroEquipe.objects.create(empresa=empresa, usuario=usuario_membro)


def _dados_meta(**over):
    base = {
        "titulo": "Vender 100 mil",
        "tipo": "vendas",
        "valor_meta": Decimal("100000"),
        "valor_atual": Decimal("0"),
        "periodo": "mensal",
        "data_inicio": date.today(),
        "data_fim": date.today() + timedelta(days=30),
    }
    base.update(over)
    return base


def _criar(membro, empresa, **over):
    return EquipeService.criar_meta(
        str(membro.id), str(empresa.id), _dados_meta(**over)
    )


# ── Momento 1: criada ───────────────────────────────────────────────────────

@pytest.mark.django_db
def test_criar_meta_envia_email_ao_membro(membro, empresa, admin):
    with patch("modules.equipe.emails._enviar") as mock:
        _criar(membro, empresa)
    assert mock.call_count == 1
    to, assunto, html = mock.call_args.args
    assert to == "membro@meta.com"          # o MEMBRO recebe
    assert to != admin.email                 # o admin NÃO
    assert "nova meta" in html               # variante "criada"
    assert "Vender 100 mil" in html


@pytest.mark.django_db
def test_admin_criador_nao_recebe(membro, empresa, admin):
    """O destinatário é sempre o membro; o admin nunca entra no 'to'."""
    with patch("modules.equipe.emails._enviar") as mock:
        _criar(membro, empresa)
    destinatarios = [c.args[0] for c in mock.call_args_list]
    assert destinatarios == ["membro@meta.com"]
    assert admin.email not in destinatarios


# ── Momento 2: editada ──────────────────────────────────────────────────────

@pytest.mark.django_db
def test_editar_titulo_envia_email_editada_com_diff(membro, empresa):
    meta = _criar(membro, empresa)
    with patch("modules.equipe.emails._enviar") as mock:
        EquipeService.atualizar_meta(
            str(meta.id), str(membro.id), str(empresa.id), {"titulo": "Vender 200 mil"}
        )
    assert mock.call_count == 1
    _, assunto, html = mock.call_args.args
    assert "atualizada" in html                       # variante "editada"
    assert "O que mudou" in html
    assert "Título alterado de" in html
    assert "Vender 100 mil" in html and "Vender 200 mil" in html


@pytest.mark.django_db
def test_editar_prazo_mostra_de_para(membro, empresa):
    meta = _criar(membro, empresa)
    novo_prazo = date.today() + timedelta(days=60)
    with patch("modules.equipe.emails._enviar") as mock:
        EquipeService.atualizar_meta(
            str(meta.id), str(membro.id), str(empresa.id), {"data_fim": novo_prazo}
        )
    _, _, html = mock.call_args.args
    assert "Prazo alterado de" in html


# ── Momento 3: concluída ────────────────────────────────────────────────────

@pytest.mark.django_db
def test_valor_atingido_envia_email_concluida(membro, empresa):
    meta = _criar(membro, empresa)
    with patch("modules.equipe.emails._enviar") as mock:
        EquipeService.atualizar_meta(
            str(meta.id), str(membro.id), str(empresa.id),
            {"valor_atual": Decimal("100000")},
        )
    assert mock.call_count == 1
    _, assunto, html = mock.call_args.args
    assert "Parabéns" in assunto or "Parabéns" in html
    assert "Meta concluída" in html or "Meta atingida" in html
    meta.refresh_from_db()
    assert meta.email_conclusao_enviado is True
    assert meta.atingida is True


@pytest.mark.django_db
def test_email_conclusao_enviado_uma_vez_so(membro, empresa):
    meta = _criar(membro, empresa)
    with patch("modules.equipe.emails._enviar") as mock:
        # 1ª vez conclui → parabéns
        EquipeService.atualizar_meta(
            str(meta.id), str(membro.id), str(empresa.id),
            {"valor_atual": Decimal("100000")},
        )
        # Passa do alvo de novo → NÃO manda outro parabéns (vira "editada")
        EquipeService.atualizar_meta(
            str(meta.id), str(membro.id), str(empresa.id),
            {"valor_atual": Decimal("150000")},
        )
    assuntos = [c.args[1] for c in mock.call_args_list]
    parabens = [a for a in assuntos if "Parabéns" in a]
    assert len(parabens) == 1


# ── Resiliência ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_resend_ausente_apenas_loga_nao_quebra(membro, empresa, caplog):
    """RESEND_API_KEY vazia (padrão nos testes) → loga, não levanta."""
    import logging
    with caplog.at_level(logging.INFO, logger="synapse"):
        meta = _criar(membro, empresa)  # _enviar REAL: sem chave, só loga
    assert MetaMembro.objects.filter(id=meta.id).exists()
    assert any("RESEND ausente" in r.message for r in caplog.records)


@pytest.mark.django_db
def test_falha_no_envio_nao_quebra_save(membro, empresa):
    with patch("modules.equipe.emails._enviar", side_effect=RuntimeError("boom")):
        meta = _criar(membro, empresa)  # não deve levantar
    assert MetaMembro.objects.filter(id=meta.id).exists()


# ── Multi-tenant ────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_email_usa_dados_da_empresa_correta(membro, empresa):
    with patch("modules.equipe.emails._enviar") as mock:
        _criar(membro, empresa)
    _, _, html = mock.call_args.args
    assert "Empresa Meta" in html
