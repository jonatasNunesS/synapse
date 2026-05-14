from django.apps import AppConfig


class FinanceiroConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "modules.financeiro"
    label = "synapse_financeiro"
    verbose_name = "Financeiro"
