"""
Synapse - Testes do Health Check (M0)
Testa: happy path, formato de resposta padrão.
"""

import pytest
from django.test import TestCase, Client


class HealthCheckTests(TestCase):
    """Testes para o endpoint GET /api/health/"""

    def setUp(self):
        self.client = Client()

    def test_health_check_returns_200(self):
        """Health check deve retornar status 200."""
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)

    def test_health_check_response_format(self):
        """Health check deve seguir o padrão de resposta Synapse."""
        response = self.client.get("/api/health/")
        data = response.json()

        # Verifica estrutura padrão
        self.assertIn("success", data)
        self.assertIn("data", data)
        self.assertIn("message", data)

        # Verifica valores
        self.assertTrue(data["success"])
        self.assertEqual(data["data"]["status"], "ok")
        self.assertEqual(data["data"]["service"], "synapse-backend")

    def test_health_check_only_get(self):
        """Health check deve rejeitar POST."""
        response = self.client.post("/api/health/")
        self.assertEqual(response.status_code, 405)
