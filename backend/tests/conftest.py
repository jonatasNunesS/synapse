"""
Synapse - Configuração de Testes (conftest.py)
Fixtures compartilhadas para todos os testes.
"""

import pytest
from django.core.cache import cache
from django.test import RequestFactory


@pytest.fixture(autouse=True)
def _cache_limpo():
    """
    Cada teste começa com o cache zerado.

    O rate limiting guarda a contagem no cache, e a chave é o IP — que na
    suite é sempre o mesmo. Sem isso, requisições de um teste contam contra o
    limite do teste seguinte e o resultado passa a depender da ordem de
    execução.
    """
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def request_factory():
    """Retorna uma instância de RequestFactory."""
    return RequestFactory()


@pytest.fixture
def api_client():
    """Retorna um client REST para testes de API."""
    from rest_framework.test import APIClient

    return APIClient()
