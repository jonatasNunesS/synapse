"""
Synapse - Testes dos Utilitários Compartilhados (M0)
Testa: pagination, responses, cache, exceptions.
"""

import pytest
from django.test import TestCase

from shared.responses import success_response, created_response, error_response
from shared.cache import build_cache_key
from shared.exceptions import (
    SynapseException,
    BusinessRuleViolation,
    ResourceNotFound,
    TenantAccessDenied,
    _format_error,
)


class ResponseHelpersTests(TestCase):
    """Testes para os helpers de resposta padrão."""

    def test_success_response_format(self):
        """success_response deve retornar o padrão Synapse."""
        response = success_response(data={"id": 1}, message="OK")
        self.assertEqual(response.status_code, 200)
        data = response.data
        self.assertTrue(data["success"])
        self.assertEqual(data["data"]["id"], 1)
        self.assertEqual(data["message"], "OK")

    def test_created_response_status_201(self):
        """created_response deve retornar status 201."""
        response = created_response(data={"id": 1})
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["success"])

    def test_error_response_format(self):
        """error_response deve retornar o padrão de erro Synapse."""
        response = error_response(
            code="VALIDATION_ERROR",
            message="Campo obrigatório.",
            details={"field": "nome"},
        )
        self.assertEqual(response.status_code, 400)
        data = response.data
        self.assertFalse(data["success"])
        self.assertEqual(data["error"]["code"], "VALIDATION_ERROR")
        self.assertEqual(data["error"]["message"], "Campo obrigatório.")
        self.assertEqual(data["error"]["details"]["field"], "nome")

    def test_error_response_custom_status(self):
        """error_response deve aceitar status code customizado."""
        response = error_response(
            code="NOT_FOUND",
            message="Não encontrado.",
            status_code=404,
        )
        self.assertEqual(response.status_code, 404)


class CacheKeyTests(TestCase):
    """Testes para construção de chaves de cache."""

    def test_build_cache_key_simple(self):
        """Deve construir chave no padrão synapse:{empresa_id}:{modulo}:{tipo}."""
        key = build_cache_key(empresa_id=1, modulo="financeiro", tipo="resumo")
        self.assertEqual(key, "synapse:1:financeiro:resumo")

    def test_build_cache_key_with_params(self):
        """Deve incluir hash dos parâmetros na chave."""
        key = build_cache_key(
            empresa_id=1,
            modulo="financeiro",
            tipo="lista",
            params={"page": "1", "status": "pago"},
        )
        self.assertTrue(key.startswith("synapse:1:financeiro:lista:"))
        # Hash deve ter 8 caracteres
        hash_part = key.split(":")[-1]
        self.assertEqual(len(hash_part), 8)

    def test_build_cache_key_deterministic(self):
        """Mesmos parâmetros devem gerar a mesma chave."""
        params = {"page": "1", "status": "pago"}
        key1 = build_cache_key(1, "financeiro", "lista", params)
        key2 = build_cache_key(1, "financeiro", "lista", params)
        self.assertEqual(key1, key2)

    def test_build_cache_key_different_params(self):
        """Parâmetros diferentes devem gerar chaves diferentes."""
        key1 = build_cache_key(1, "financeiro", "lista", {"page": "1"})
        key2 = build_cache_key(1, "financeiro", "lista", {"page": "2"})
        self.assertNotEqual(key1, key2)


class ExceptionTests(TestCase):
    """Testes para exceções customizadas."""

    def test_synapse_exception(self):
        """SynapseException deve ter code, message e details."""
        exc = SynapseException(code="TEST", message="Teste", details={"key": "value"})
        self.assertEqual(exc.code, "TEST")
        self.assertEqual(exc.message, "Teste")
        self.assertEqual(exc.details["key"], "value")

    def test_resource_not_found(self):
        """ResourceNotFound deve formatar mensagem corretamente."""
        exc = ResourceNotFound(resource="Produto", identifier="123")
        self.assertEqual(exc.code, "NOT_FOUND")
        self.assertIn("Produto", exc.message)

    def test_tenant_access_denied(self):
        """TenantAccessDenied deve ter código correto."""
        exc = TenantAccessDenied()
        self.assertEqual(exc.code, "TENANT_ACCESS_DENIED")

    def test_format_error(self):
        """_format_error deve retornar dict no padrão Synapse."""
        result = _format_error("CODE", "Message", {"key": "val"})
        self.assertFalse(result["success"])
        self.assertEqual(result["error"]["code"], "CODE")
        self.assertEqual(result["error"]["message"], "Message")
        self.assertEqual(result["error"]["details"]["key"], "val")
