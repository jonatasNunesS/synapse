import uuid
from django.db import models


class Evento(models.Model):
    TIPO_CHOICES = [
        ("reuniao", "Reunião"),
        ("tarefa", "Tarefa"),
        ("lembrete", "Lembrete"),
        ("compromisso", "Compromisso"),
        ("outro", "Outro"),
    ]

    COR_CHOICES = [
        ("#6D28D9", "Roxo"),
        ("#2563EB", "Azul"),
        ("#059669", "Verde"),
        ("#D97706", "Âmbar"),
        ("#DC2626", "Vermelho"),
        ("#7C3AED", "Violeta"),
        ("#0891B2", "Ciano"),
        ("#84CC16", "Lima"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="eventos",
    )
    titulo = models.CharField(max_length=200)
    descricao = models.TextField(blank=True)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default="reuniao")
    cor = models.CharField(max_length=7, default="#6D28D9")
    data_inicio = models.DateTimeField()
    data_fim = models.DateTimeField(null=True, blank=True)
    dia_inteiro = models.BooleanField(default=False)
    local = models.CharField(max_length=255, blank=True)
    concluido = models.BooleanField(default=False)
    lembrete_minutos = models.IntegerField(null=True, blank=True)
    lembrete_enviado = models.BooleanField(default=False)
    criado_por = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="eventos_criados",
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "synapse_agenda"
        verbose_name = "Evento"
        verbose_name_plural = "Eventos"
        ordering = ["data_inicio"]
        indexes = [
            models.Index(fields=["empresa", "data_inicio"], name="evento_emp_inicio_idx"),
            models.Index(fields=["empresa", "concluido"], name="evento_emp_concluido_idx"),
        ]

    def __str__(self):
        return f"{self.titulo} ({self.data_inicio.strftime('%d/%m/%Y')})"
