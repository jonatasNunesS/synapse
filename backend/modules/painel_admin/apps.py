from django.apps import AppConfig


class PainelAdminConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "modules.painel_admin"
    label = "synapse_painel_admin"
    verbose_name = "Painel Administrativo"
