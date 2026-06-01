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
            name="MensagemAutomatica",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("nome", models.CharField(max_length=150)),
                ("assunto", models.CharField(max_length=255)),
                ("corpo_html", models.TextField()),
                ("gatilho", models.CharField(
                    choices=[
                        ("aniversario", "Aniversário do Cliente"),
                        ("followup_atrasado", "Follow-up Atrasado"),
                        ("boas_vindas", "Boas-vindas (novo cliente)"),
                        ("inativo_30d", "Cliente Inativo 30 dias"),
                        ("inativo_60d", "Cliente Inativo 60 dias"),
                        ("vencimento_proximo", "Vencimento Próximo (7 dias)"),
                        ("manual", "Disparo Manual"),
                    ],
                    max_length=30,
                )),
                ("status", models.CharField(
                    choices=[("ativa", "Ativa"), ("pausada", "Pausada"), ("rascunho", "Rascunho")],
                    default="rascunho",
                    max_length=15,
                )),
                ("total_enviados", models.IntegerField(default=0)),
                ("ultimo_disparo", models.DateTimeField(blank=True, null=True)),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                ("atualizado_em", models.DateTimeField(auto_now=True)),
                ("empresa", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="mensagens_automaticas", to="synapse_auth.empresa")),
                ("criado_por", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="mensagens_criadas", to=settings.AUTH_USER_MODEL)),
            ],
            options={"verbose_name": "Mensagem Automática", "verbose_name_plural": "Mensagens Automáticas", "db_table": "synapse_mensagens_automaticas", "ordering": ["-criado_em"]},
        ),
        migrations.AddIndex(
            model_name="mensagemautomatica",
            index=models.Index(fields=["empresa", "status"], name="msg_emp_status_idx"),
        ),
        migrations.CreateModel(
            name="LogEnvioMensagem",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("destinatario_email", models.EmailField()),
                ("destinatario_nome", models.CharField(blank=True, max_length=255)),
                ("status", models.CharField(
                    choices=[("enviado", "Enviado"), ("falhou", "Falhou"), ("simulado", "Simulado (dev)")],
                    default="enviado",
                    max_length=15,
                )),
                ("erro", models.TextField(blank=True)),
                ("enviado_em", models.DateTimeField(auto_now_add=True)),
                ("empresa", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="logs_envio", to="synapse_auth.empresa")),
                ("mensagem", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="logs", to="synapse_mensagens.mensagemautomatica")),
            ],
            options={"verbose_name": "Log de Envio", "verbose_name_plural": "Logs de Envio", "db_table": "synapse_logs_envio_mensagem", "ordering": ["-enviado_em"]},
        ),
        migrations.AddIndex(
            model_name="logenviomsagem",
            index=models.Index(fields=["mensagem", "enviado_em"], name="log_msg_enviado_idx"),
        ),

    ]
