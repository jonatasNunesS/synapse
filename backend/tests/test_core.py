"""
Synapse - Testes das Entidades Core (M0)
Testa: dataclasses, herança, valores padrão.
"""

from django.test import TestCase

from core.entities.base import BaseEntity, TenantEntity
from core.entities.empresa import EmpresaEntity, PLANOS, SEGMENTOS
from core.entities.user import UserEntity, PERFIS


class BaseEntityTests(TestCase):
    """Testes para a entidade base."""

    def test_base_entity_defaults(self):
        """BaseEntity deve ter valores padrão None."""
        entity = BaseEntity()
        self.assertIsNone(entity.id)
        self.assertIsNone(entity.criado_em)
        self.assertIsNone(entity.atualizado_em)

    def test_tenant_entity_has_empresa_id(self):
        """TenantEntity deve ter campo empresa_id."""
        entity = TenantEntity(empresa_id=1)
        self.assertEqual(entity.empresa_id, 1)

    def test_tenant_entity_inherits_base(self):
        """TenantEntity deve herdar de BaseEntity."""
        self.assertTrue(issubclass(TenantEntity, BaseEntity))


class EmpresaEntityTests(TestCase):
    """Testes para a entidade Empresa."""

    def test_empresa_defaults(self):
        """EmpresaEntity deve ter valores padrão corretos."""
        empresa = EmpresaEntity()
        self.assertEqual(empresa.nome, "")
        self.assertEqual(empresa.plano, "starter")
        self.assertTrue(empresa.ativo)
        self.assertTrue(empresa.plano_ativo)
        self.assertEqual(empresa.segmento, "outro")

    def test_planos_validos(self):
        """Deve ter os 4 planos definidos."""
        self.assertEqual(len(PLANOS), 4)
        self.assertIn("starter", PLANOS)
        self.assertIn("enterprise", PLANOS)

    def test_segmentos_validos(self):
        """Deve ter pelo menos 10 segmentos."""
        self.assertGreaterEqual(len(SEGMENTOS), 10)


class UserEntityTests(TestCase):
    """Testes para a entidade Usuário."""

    def test_user_defaults(self):
        """UserEntity deve ter perfil 'colaborador' por padrão."""
        user = UserEntity()
        self.assertEqual(user.perfil, "colaborador")
        self.assertTrue(user.ativo)

    def test_perfis_validos(self):
        """Deve ter os 3 perfis definidos."""
        self.assertEqual(len(PERFIS), 3)
        self.assertIn("admin", PERFIS)
        self.assertIn("gerente", PERFIS)
        self.assertIn("colaborador", PERFIS)
