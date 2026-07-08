"""
Synapse — Comando: promover um usuário a staff da plataforma.

Uso:
    python manage.py criar_staff_synapse usuario@exemplo.com

Idempotente: rodar de novo num usuário que já é staff não quebra nem duplica.
Não há UI para isso — promoção de staff é sempre pelo terminal.
"""
from django.core.management.base import BaseCommand, CommandError

from modules.auth.models import CustomUser


class Command(BaseCommand):
    help = "Promove um usuário (por e-mail) a staff da plataforma Synapse."

    def add_arguments(self, parser):
        parser.add_argument("email", type=str, help="E-mail do usuário a promover.")

    def handle(self, *args, **options):
        email = (options["email"] or "").strip().lower()
        if not email:
            raise CommandError("Informe o e-mail do usuário.")

        try:
            user = CustomUser.objects.get(email__iexact=email)
        except CustomUser.DoesNotExist:
            raise CommandError(f"Nenhum usuário encontrado com o e-mail '{email}'.")

        if user.is_staff_synapse:
            self.stdout.write(
                self.style.WARNING(
                    f"'{user.email}' já é staff da plataforma. Nada a fazer."
                )
            )
            return

        user.is_staff_synapse = True
        user.save(update_fields=["is_staff_synapse", "atualizado_em"])
        self.stdout.write(
            self.style.SUCCESS(
                f"'{user.email}' agora é staff da plataforma Synapse."
            )
        )
