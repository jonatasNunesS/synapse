from django.apps import AppConfig


class EstoqueConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "modules.estoque"
    label = "synapse_estoque"
    verbose_name = "Estoque"
