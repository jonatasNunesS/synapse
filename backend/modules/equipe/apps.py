from django.apps import AppConfig


class EquipeConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "modules.equipe"
    verbose_name = "Equipe"

    def ready(self):
        import modules.equipe.signals  # noqa: F401
