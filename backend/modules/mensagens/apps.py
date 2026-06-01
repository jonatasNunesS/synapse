from django.apps import AppConfig


class MensagensConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "modules.mensagens"
    label = "synapse_mensagens"
    verbose_name = "Mensagens Automáticas"
