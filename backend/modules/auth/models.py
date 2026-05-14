"""
Synapse - Models de Autenticação (M0 Placeholder)
CustomUser será completado no M1.
"""

from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomUser(AbstractUser):
    """
    Usuário customizado do Synapse.
    Placeholder para M0 - campos adicionais no M1.
    """

    empresa_id = models.IntegerField(null=True, blank=True, db_index=True)
    perfil = models.CharField(
        max_length=20,
        choices=[
            ("admin", "Administrador"),
            ("gerente", "Gerente"),
            ("colaborador", "Colaborador"),
        ],
        default="colaborador",
    )

    class Meta:
        db_table = "synapse_users"
        verbose_name = "Usuário"
        verbose_name_plural = "Usuários"

    def __str__(self):
        return self.email or self.username
