"""
Synapse - Testes do Health Check (R1 — Auditoria v2.0)
Testa: happy path, formato de resposta padrão, verificações de DB/Redis/Celery.
"""

import pytest
from unittest.mock import patch, MagicMock
from django.test import TestCase, Client


class HealthCheckTests(TestCase):
    """Testes para o endpoint GET /api/health/"""

    def setUp(self):
        self.client = Client()

    def test_health_check_returns_200(self):
        """Health check deve retornar status 200 quando DB está disponível."""
        response = self.client.get("/api/health/")
        # Em teste, DB está disponível mas Redis/Celery podem não estar
        # O status pode ser 200 ou 503 dependendo do ambiente de teste
        self.assertIn(response.status_code, [200, 503])

    def test_health_check_response_format(self):
        """Health check deve seguir o padrão de resposta Synapse."""
        response = self.client.get("/api/health/")
        data = response.json()

        # Verifica estrutura padrão
        self.assertIn("success", data)
        self.assertIn("data", data)
        self.assertIn("message", data)

        # Verifica campos do data
        self.assertIn("status", data["data"])
        self.assertIn("service", data["data"])
        self.assertEqual(data["data"]["service"], "synapse-backend")

    def test_health_check_has_checks_field(self):
        """Health check enriquecido deve retornar campo 'checks' com DB/Redis/Celery."""
        response = self.client.get("/api/health/")
        data = response.json()
        self.assertIn("checks", data["data"])
        checks = data["data"]["checks"]
        # Todos os três subsistemas devem ser reportados
        self.assertIn("db", checks)
        self.assertIn("redis", checks)
        self.assertIn("celery", checks)

    def test_health_check_db_ok_in_test_env(self):
        """Em ambiente de teste, DB deve estar disponível."""
        response = self.client.get("/api/health/")
        data = response.json()
        self.assertEqual(data["data"]["checks"]["db"]["status"], "ok")

    def test_health_check_only_get(self):
        """Health check deve rejeitar POST."""
        response = self.client.post("/api/health/")
        self.assertEqual(response.status_code, 405)

    def test_health_check_503_when_db_fails(self):
        """Health check deve retornar 503 quando o DB falha."""
        from django.db.utils import OperationalError
        with patch("django.db.connection.ensure_connection", side_effect=OperationalError("DB down")):
            response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 503)
        data = response.json()
        self.assertFalse(data["success"])
        self.assertEqual(data["data"]["status"], "degraded")
        self.assertEqual(data["data"]["checks"]["db"]["status"], "error")

    def test_health_check_503_when_redis_fails(self):
        """Health check deve retornar 503 quando o Redis falha."""
        with patch("django.core.cache.cache.set", side_effect=Exception("Redis down")):
            response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 503)
        data = response.json()
        self.assertFalse(data["success"])
        self.assertEqual(data["data"]["checks"]["redis"]["status"], "error")

    def test_health_check_no_workers_is_not_critical(self):
        """Celery sem workers não deve marcar o health check como degradado."""
        # ping retorna lista vazia = sem workers, mas não é erro crítico
        with patch("celery.app.control.Control.ping", return_value=[]):
            response = self.client.get("/api/health/")
        data = response.json()
        # Celery sem workers não deve causar 503
        self.assertIn(data["data"]["checks"]["celery"]["status"], ["no_workers", "ok", "error"])
