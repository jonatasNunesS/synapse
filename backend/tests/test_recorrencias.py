"""
Synapse — Recorrências Inteligentes: testes.

Princípio testado: "esperado" ≠ "aconteceu". A task cria PERGUNTAS; só a
confirmação do usuário cria Lançamento.
"""
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa
from modules.financeiro.models import Categoria, Lancamento
from modules.recorrencias.models import OcorrenciaRecorrencia, Recorrencia
from modules.recorrencias.services import RecorrenciaService
from modules.recorrencias.calculo import proxima_data_esperada
from modules.recorrencias.dias_uteis import proximo_dia_util, eh_dia_util


@pytest.fixture(autouse=True)
def _limpa_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def empresa(db):
    return Empresa.objects.create(nome="Impactar", segmento="eventos", plano="pro")


@pytest.fixture
def outra(db):
    return Empresa.objects.create(nome="Outra", segmento="eventos", plano="pro")


@pytest.fixture
def user(db, empresa):
    return CustomUser.objects.create_user(
        email="p@imp.com", nome="Patrícia", senha="Senha@12345", empresa=empresa, perfil="admin"
    )


def _cli(u):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(u).access_token)
    return c


def _rec(empresa, user, **kw):
    dados = dict(
        titulo="Salário Patrícia", tipo="receita", valor_padrao=Decimal("3000"),
        frequencia_tipo="mensal", dia_referencia=5, usa_dia_util=False,
        avisar_com_antecedencia=0,
    )
    dados.update(kw)
    return Recorrencia.objects.create(empresa=empresa, criado_por=user, **dados)


# ── Task: gera no dia certo respeitando antecedência ────────────────────────

@pytest.mark.django_db
def test_task_gera_no_dia_com_antecedencia(empresa, user):
    rec = _rec(empresa, user, dia_referencia=10, avisar_com_antecedencia=2)
    # hoje = dia 8; esperada = dia 10; gatilho = 10 - 2 = 8 <= hoje → gera
    hoje = date(2026, 7, 8)
    n = RecorrenciaService.gerar_ocorrencias(hoje=hoje)
    assert n == 1
    oc = OcorrenciaRecorrencia.objects.get(recorrencia=rec)
    assert oc.status == "pendente"
    assert oc.data_esperada == date(2026, 7, 10)
    # NENHUM lançamento foi criado (só pergunta)
    assert Lancamento.objects.filter(empresa=empresa).count() == 0


@pytest.mark.django_db
def test_task_nao_gera_antes_da_hora(empresa, user):
    _rec(empresa, user, dia_referencia=20, avisar_com_antecedencia=0)
    hoje = date(2026, 7, 5)  # muito antes do dia 20
    assert RecorrenciaService.gerar_ocorrencias(hoje=hoje) == 0
    assert OcorrenciaRecorrencia.objects.count() == 0


# ── Idempotência ────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_task_idempotente(empresa, user):
    _rec(empresa, user, dia_referencia=10)
    hoje = date(2026, 7, 10)
    RecorrenciaService.gerar_ocorrencias(hoje=hoje)
    RecorrenciaService.gerar_ocorrencias(hoje=hoje)  # roda de novo
    assert OcorrenciaRecorrencia.objects.count() == 1  # não duplicou


# ── Dia útil: sábado empurra pra segunda ────────────────────────────────────

@pytest.mark.django_db
def test_dia_util_empurra_sabado_para_segunda(empresa, user):
    # 05/07/2026 é um domingo; 04 é sábado. dia 4 com dia útil → segunda 06.
    rec = _rec(empresa, user, dia_referencia=4, usa_dia_util=True)
    d = proxima_data_esperada(rec, None, date(2026, 7, 1))
    assert d == date(2026, 7, 6)  # segunda-feira


@pytest.mark.django_db
def test_feriado_nacional_nao_e_dia_util():
    assert eh_dia_util(date(2026, 12, 25)) is False  # Natal
    assert proximo_dia_util(date(2026, 12, 25)) == date(2026, 12, 28)  # 26 sex? 25=sex


# ── Confirmar cria Lançamento correto ───────────────────────────────────────

@pytest.mark.django_db
def test_confirmar_cria_lancamento(empresa, user):
    cat = Categoria.objects.create(empresa=empresa, nome="Salários", tipo="receita")
    rec = _rec(empresa, user, categoria=cat, dia_referencia=5)
    RecorrenciaService.gerar_ocorrencias(hoje=date(2026, 7, 5))
    oc = OcorrenciaRecorrencia.objects.get(recorrencia=rec)

    oc2, lanc = RecorrenciaService.confirmar(empresa.id, oc.id)
    assert oc2.status == "confirmada"
    assert oc2.lancamento_gerado_id == lanc.id
    assert lanc.tipo == "receita"
    assert lanc.valor == Decimal("3000")
    assert lanc.status == "pago"
    assert lanc.categoria_id == cat.id
    assert lanc.data_pagamento is not None


# ── Editar valor: +/- atualizar recorrência ─────────────────────────────────

@pytest.mark.django_db
def test_editar_valor_atualiza_recorrencia(empresa, user):
    rec = _rec(empresa, user, dia_referencia=5, valor_padrao=Decimal("3000"))
    RecorrenciaService.gerar_ocorrencias(hoje=date(2026, 7, 5))
    oc = OcorrenciaRecorrencia.objects.get(recorrencia=rec)

    _, lanc = RecorrenciaService.confirmar(
        empresa.id, oc.id, valor=Decimal("3500"), atualizar_recorrencia=True
    )
    assert lanc.valor == Decimal("3500")
    rec.refresh_from_db()
    assert rec.valor_padrao == Decimal("3500")  # template atualizado


@pytest.mark.django_db
def test_editar_valor_sem_atualizar_recorrencia(empresa, user):
    rec = _rec(empresa, user, dia_referencia=5, valor_padrao=Decimal("3000"))
    RecorrenciaService.gerar_ocorrencias(hoje=date(2026, 7, 5))
    oc = OcorrenciaRecorrencia.objects.get(recorrencia=rec)

    _, lanc = RecorrenciaService.confirmar(
        empresa.id, oc.id, valor=Decimal("3500"), atualizar_recorrencia=False
    )
    assert lanc.valor == Decimal("3500")
    rec.refresh_from_db()
    assert rec.valor_padrao == Decimal("3000")  # template NÃO mudou


# ── Adiar reagenda ──────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_adiar_reagenda_e_reativa(empresa, user):
    rec = _rec(empresa, user, dia_referencia=5)
    RecorrenciaService.gerar_ocorrencias(hoje=date(2026, 7, 5))
    oc = OcorrenciaRecorrencia.objects.get(recorrencia=rec)

    with_patch = RecorrenciaService.adiar(empresa.id, oc.id, dias=3)
    assert with_patch.status == "adiada"
    assert with_patch.data_adiada_para is not None

    # Simula a task no dia do retorno → vira pendente de novo
    futuro = with_patch.data_adiada_para
    RecorrenciaService.gerar_ocorrencias(hoje=futuro)
    oc.refresh_from_db()
    assert oc.status == "pendente"
    assert oc.data_esperada == futuro


# ── Cancelar esse mês não afeta próximas ────────────────────────────────────

@pytest.mark.django_db
def test_cancelar_mes_nao_afeta_proximas(empresa, user):
    rec = _rec(empresa, user, dia_referencia=5)
    RecorrenciaService.gerar_ocorrencias(hoje=date(2026, 7, 5))
    oc = OcorrenciaRecorrencia.objects.get(recorrencia=rec)
    RecorrenciaService.cancelar(empresa.id, oc.id)
    oc.refresh_from_db()
    assert oc.status == "cancelada"

    # Mês seguinte → nova ocorrência é gerada normalmente
    RecorrenciaService.gerar_ocorrencias(hoje=date(2026, 8, 5))
    assert OcorrenciaRecorrencia.objects.filter(recorrencia=rec).count() == 2


# ── Pausar para de gerar ────────────────────────────────────────────────────

@pytest.mark.django_db
def test_pausar_para_de_gerar(empresa, user):
    rec = _rec(empresa, user, dia_referencia=5)
    RecorrenciaService.definir_ativa(empresa.id, rec.id, False)
    assert RecorrenciaService.gerar_ocorrencias(hoje=date(2026, 7, 5)) == 0
    assert OcorrenciaRecorrencia.objects.count() == 0


# ── Multi-tenant ────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_multitenant_nao_ve_recorrencia_de_outra(empresa, outra, user):
    rec_b = _rec(outra, None, titulo="Da outra empresa")
    # A empresa do user não enxerga a recorrência de 'outra'
    from modules.recorrencias.repository import RecorrenciaRepository
    ids = list(RecorrenciaRepository.listar(empresa.id).values_list("id", flat=True))
    assert rec_b.id not in ids
    # Endpoint também bloqueia
    resp = _cli(user).get(f"/api/recorrencias/{rec_b.id}/")
    assert resp.status_code == 404


# ── Notificação no sino ─────────────────────────────────────────────────────

@pytest.mark.django_db
def test_gera_notificacao_no_sino(empresa, user):
    from modules.notificacoes.models import Notificacao
    _rec(empresa, user, dia_referencia=5)
    RecorrenciaService.gerar_ocorrencias(hoje=date(2026, 7, 5))
    n = Notificacao.objects.filter(usuario=user, tipo="financeiro")
    assert n.count() == 1
    assert "Chegou o dia" in n.first().titulo


# ── Endpoints ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_endpoint_crud_e_confirmar(user, empresa):
    c = _cli(user)
    # criar
    resp = c.post("/api/recorrencias/", {
        "titulo": "Aluguel", "tipo": "despesa", "valor_padrao": "1500",
        "frequencia_tipo": "mensal", "dia_referencia": 10,
    }, format="json")
    assert resp.status_code == 201
    rec_id = resp.json()["data"]["id"]
    # lista
    assert c.get("/api/recorrencias/").status_code == 200
    # gera ocorrência e confirma via endpoint
    RecorrenciaService.gerar_ocorrencias(hoje=date(2026, 7, 10))
    oc = OcorrenciaRecorrencia.objects.get(recorrencia_id=rec_id)
    r = c.post(f"/api/recorrencias/ocorrencias/{oc.id}/confirmar/", {}, format="json")
    assert r.status_code == 200
    assert Lancamento.objects.filter(empresa=empresa, descricao="Aluguel").count() == 1


@pytest.mark.django_db
def test_endpoint_nao_autenticado_401():
    assert APIClient().get("/api/recorrencias/").status_code == 401


# ── Migração das recorrências antigas ───────────────────────────────────────

@pytest.mark.django_db
def test_migracao_converte_lancamento_recorrente():
    """Simula a lógica da data migration convertendo um lançamento antigo."""
    from django.core.management import call_command
    from io import StringIO

    emp = Empresa.objects.create(nome="Velha", segmento="eventos", plano="pro")
    u = CustomUser.objects.create_user(
        email="v@v.com", nome="V", senha="Senha@12345", empresa=emp, perfil="admin"
    )
    cat = Categoria.objects.create(empresa=emp, nome="Fixas", tipo="despesa")
    lanc = Lancamento.objects.create(
        empresa=emp, tipo="despesa", descricao="Internet", valor=Decimal("200"),
        categoria=cat, data_vencimento=date(2026, 7, 15), status="pendente",
        recorrente=True, recorrencia="mensal", criado_por=u,
    )
    # Reaproveita a função da data migration diretamente
    import importlib
    mod = importlib.import_module(
        "modules.recorrencias.migrations.0002_migrar_recorrencias_antigas"
    )
    from django.apps import apps as django_apps
    mod.migrar(django_apps, None)

    lanc.refresh_from_db()
    assert lanc.recorrente is False  # marcado como histórico
    rec = Recorrencia.objects.get(empresa=emp, titulo="Internet")
    assert rec.tipo == "despesa"
    assert rec.valor_padrao == Decimal("200")
    assert rec.frequencia_tipo == "mensal"
    assert rec.dia_referencia == 15
    assert rec.categoria_id == cat.id
