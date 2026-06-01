from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("synapse_financeiro", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Caixinha",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("nome", models.CharField(max_length=100)),
                ("descricao", models.TextField(blank=True)),
                ("cor", models.CharField(default="#6D28D9", max_length=7)),
                ("icone", models.CharField(default="piggy-bank", max_length=50)),
                ("meta", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("saldo_atual", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("data_meta", models.DateField(blank=True, null=True)),
                ("ativa", models.BooleanField(default=True)),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                ("atualizado_em", models.DateTimeField(auto_now=True)),
                ("empresa", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="caixinhas", to="synapse_auth.empresa")),
                ("criado_por", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="caixinhas_criadas", to=settings.AUTH_USER_MODEL)),
            ],
            options={"verbose_name": "Caixinha", "verbose_name_plural": "Caixinhas", "db_table": "synapse_caixinhas", "ordering": ["-criado_em"]},
        ),
        migrations.AddIndex(
            model_name="caixinha",
            index=models.Index(fields=["empresa", "ativa"], name="caixinha_emp_ativa_idx"),
        ),
        migrations.CreateModel(
            name="MovimentoCaixinha",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("tipo", models.CharField(choices=[("deposito", "Depósito"), ("retirada", "Retirada")], max_length=10)),
                ("valor", models.DecimalField(decimal_places=2, max_digits=12)),
                ("descricao", models.CharField(blank=True, max_length=255)),
                ("saldo_anterior", models.DecimalField(decimal_places=2, max_digits=12)),
                ("saldo_posterior", models.DecimalField(decimal_places=2, max_digits=12)),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                ("caixinha", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="movimentos", to="synapse_financeiro.caixinha")),
                ("empresa", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="movimentos_caixinha", to="synapse_auth.empresa")),
                ("criado_por", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="movimentos_caixinha_criados", to=settings.AUTH_USER_MODEL)),
            ],
            options={"verbose_name": "Movimento de Caixinha", "verbose_name_plural": "Movimentos de Caixinha", "db_table": "synapse_movimentos_caixinha", "ordering": ["-criado_em"]},
        ),
        migrations.AddIndex(
            model_name="movimentocaixinha",
            index=models.Index(fields=["caixinha", "criado_em"], name="mov_caixinha_criado_idx"),
        ),
    ]
