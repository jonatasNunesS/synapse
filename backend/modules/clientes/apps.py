from django.apps import AppConfig


class ClientesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "modules.clientes"
    label = "synapse_clientes"
    verbose_name = "CRM — Clientes"

    def ready(self):
        import modules.clientes.signals  # noqa: F401
