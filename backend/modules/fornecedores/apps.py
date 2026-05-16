from django.apps import AppConfig


class FornecedoresConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "modules.fornecedores"
    label = "synapse_fornecedores"
    verbose_name = "Fornecedores"

    def ready(self):
        import modules.fornecedores.signals  # noqa: F401
