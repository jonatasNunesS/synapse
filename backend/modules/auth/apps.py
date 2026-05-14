"""Synapse - Módulo de Autenticação (App Config)"""

from django.apps import AppConfig


class SynapseAuthConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "modules.auth"
    label = "synapse_auth"
    verbose_name = "Autenticação"

    def ready(self):
        pass  # Signals serão registrados aqui nos próximos milestones
