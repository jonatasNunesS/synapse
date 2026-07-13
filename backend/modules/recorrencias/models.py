"""
Synapse — Recorrências Inteligentes: Models.

Princípio: "esperado" ≠ "aconteceu". Uma Recorrencia é um MODELO (template) que
gera PERGUNTAS (OcorrenciaRecorrencia) periodicamente. A pergunta só vira
Lançamento quando o usuário CONFIRMA. Nada é criado sem consentimento.
"""
import uuid

from django.db import models

TIPO_CHOICES = [
    ("receita", "Receita"),
    ("despesa", "Despesa"),
]

FREQUENCIA_CHOICES = [
    ("mensal", "Mensal"),
    ("semanal", "Semanal"),
    ("diario", "Diário"),
]

STATUS_OCORRENCIA_CHOICES = [
    ("pendente", "Pendente"),
    ("confirmada", "Confirmada"),
    ("adiada", "Adiada"),
    ("cancelada", "Cancelada"),
    ("encerrada", "Encerrada"),
]


class Recorrencia(models.Model):
    """Template de uma recorrência financeira (ex.: 'Salário Patrícia')."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="recorrencias",
    )
    criado_por = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recorrencias_criadas",
    )
    titulo = models.CharField(max_length=255)
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    valor_padrao = models.DecimalField(max_digits=12, decimal_places=2)
    categoria = models.ForeignKey(
        "synapse_financeiro.Categoria",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recorrencias",
    )
    descricao = models.TextField(blank=True, default="")
    ativa = models.BooleanField(default=True)

    # Frequência
    frequencia_tipo = models.CharField(max_length=10, choices=FREQUENCIA_CHOICES, default="mensal")
    dia_referencia = models.IntegerField(
        default=1,
        help_text="Mensal: dia do mês (1-31). Semanal: dia da semana (0=seg..6=dom). Diário: ignorado.",
    )
    usa_dia_util = models.BooleanField(
        default=False,
        help_text="Se cair em fim de semana/feriado nacional, empurra pro próximo dia útil.",
    )

    # Notificação
    avisar_com_antecedencia = models.IntegerField(
        default=0,
        help_text="Dias: 0 = no dia, 1 = 1 dia antes, -1 = 1 dia depois.",
    )

    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "synapse_recorrencias"
        ordering = ["-criado_em"]
        indexes = [
            models.Index(fields=["empresa", "ativa"]),
        ]
        verbose_name = "Recorrência"
        verbose_name_plural = "Recorrências"

    def __str__(self) -> str:
        return f"{self.titulo} ({self.tipo}, {self.frequencia_tipo})"


class OcorrenciaRecorrencia(models.Model):
    """
    Uma "pergunta pendente" gerada por uma Recorrencia: chegou o dia, você
    recebeu/pagou? Só vira Lançamento quando confirmada.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recorrencia = models.ForeignKey(
        Recorrencia,
        on_delete=models.CASCADE,
        related_name="ocorrencias",
    )
    data_esperada = models.DateField()
    status = models.CharField(
        max_length=12, choices=STATUS_OCORRENCIA_CHOICES, default="pendente"
    )
    valor_confirmado = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    data_confirmacao = models.DateField(null=True, blank=True)
    lancamento_gerado = models.ForeignKey(
        "synapse_financeiro.Lancamento",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ocorrencia_origem",
    )
    data_adiada_para = models.DateField(null=True, blank=True)
    criada_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "synapse_ocorrencias_recorrencia"
        ordering = ["-data_esperada", "-criada_em"]
        indexes = [
            models.Index(fields=["recorrencia", "status"]),
            models.Index(fields=["status", "data_esperada"]),
        ]
        verbose_name = "Ocorrência de Recorrência"
        verbose_name_plural = "Ocorrências de Recorrência"

    def __str__(self) -> str:
        return f"{self.recorrencia.titulo} — {self.data_esperada} [{self.status}]"

    @property
    def empresa_id(self):
        return self.recorrencia.empresa_id
