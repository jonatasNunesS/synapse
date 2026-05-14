"""
Synapse - Configuração de Testes (conftest.py)
Fixtures compartilhadas para todos os testes.
"""

import pytest
from django.test import RequestFactory


@pytest.fixture
def request_factory():
    """Retorna uma instância de RequestFactory."""
    return RequestFactory()


@pytest.fixture
def api_client():
    """Retorna um client REST para testes de API."""
    from rest_framework.test import APIClient

    return APIClient()
