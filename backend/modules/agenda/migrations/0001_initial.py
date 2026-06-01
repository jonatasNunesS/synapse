from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("synapse_auth", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Evento",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("titulo", models.CharField(max_length=200)),
                ("descricao", models.TextField(blank=True)),
                ("tipo", models.CharField(
                    choices=[("reuniao", "Reunião"), ("tarefa", "Tarefa"), ("lembrete", "Lembrete"), ("compromisso", "Compromisso"), ("outro", "Outro")],
                    default="reuniao",
                    max_length=20,
                )),
                ("cor", models.CharField(default="#6D28D9", max_length=7)),
                ("data_inicio", models.DateTimeField()),
                ("data_fim", models.DateTimeField(blank=True, null=True)),
                ("dia_inteiro", models.BooleanField(default=False)),
                ("local", models.CharField(blank=True, max_length=255)),
                ("concluido", models.BooleanField(default=False)),
                ("lembrete_minutos", models.IntegerField(blank=True, null=True)),
                ("lembrete_enviado", models.BooleanField(default=False)),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                ("atualizado_em", models.DateTimeField(auto_now=True)),
                ("empresa", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="eventos", to="synapse_auth.empresa")),
                ("criado_por", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="eventos_criados", to=settings.AUTH_USER_MODEL)),
            ],
            options={"verbose_name": "Evento", "verbose_name_plural": "Eventos", "db_table": "synapse_eventos", "ordering": ["data_inicio"]},
        ),
        migrations.AddIndex(
            model_name="evento",
            index=models.Index(fields=["empresa", "data_inicio"], name="evento_emp_inicio_idx"),
        ),
        migrations.AddIndex(
            model_name="evento",
            index=models.Index(fields=["empresa", "concluido"], name="evento_emp_concluido_idx"),
        ),
    ]
