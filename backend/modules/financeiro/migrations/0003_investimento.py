from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("synapse_financeiro", "0002_caixinha_movimentocaixinha"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Investimento",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("nome", models.CharField(max_length=150)),
                ("descricao", models.TextField(blank=True)),
                ("tipo", models.CharField(
                    choices=[
                        ("renda_fixa", "Renda Fixa"),
                        ("renda_variavel", "Renda Variável"),
                        ("fundos", "Fundos"),
                        ("criptomoeda", "Criptomoeda"),
                        ("imovel", "Imóvel"),
                        ("outro", "Outro"),
                    ],
                    default="renda_fixa",
                    max_length=30,
                )),
                ("valor_inicial", models.DecimalField(decimal_places=2, max_digits=14)),
                ("valor_atual", models.DecimalField(decimal_places=2, max_digits=14)),
                ("taxa_juros_anual", models.DecimalField(blank=True, decimal_places=4, max_digits=8, null=True)),
                ("data_inicio", models.DateField()),
                ("data_vencimento", models.DateField(blank=True, null=True)),
                ("ativo", models.BooleanField(default=True)),
                ("cor", models.CharField(default="#059669", max_length=7)),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                ("atualizado_em", models.DateTimeField(auto_now=True)),
                ("empresa", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="investimentos", to="synapse_auth.empresa")),
                ("criado_por", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="investimentos_criados", to=settings.AUTH_USER_MODEL)),
            ],
            options={"verbose_name": "Investimento", "verbose_name_plural": "Investimentos", "db_table": "synapse_investimentos", "ordering": ["-criado_em"]},
        ),
        migrations.AddIndex(
            model_name="investimento",
            index=models.Index(fields=["empresa", "ativo"], name="inv_emp_ativo_idx"),
        ),
    ]
