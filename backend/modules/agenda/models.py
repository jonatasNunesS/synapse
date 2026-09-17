"""
Synapse — Módulo Agenda: Models
Evento de calendário com multi-tenant obrigatório (empresa_id) e vínculo
opcional com um Cliente do CRM.
"""
import uuid

from django.db import models

# Antecedência do lembrete, em MINUTOS antes do início do evento.
# Zero é o default: quem não pediu lembrete não recebe lembrete.
SEM_LEMBRETE = 0
LEMBRETE_CHOICES = [
    (SEM_LEMBRETE, "Sem lembrete"),
    (10, "10 minutos antes"),
    (30, "30 minutos antes"),
    (60, "1 hora antes"),
    (1440, "1 dia antes"),
]

# A maior antecedência oferecida — a task usa para limitar a janela que varre.
MAIOR_ANTECEDENCIA_MIN = max(minutos for minutos, _ in LEMBRETE_CHOICES)


def normalizar_dia_inteiro(data_inicio, data_fim):
    """
    Dia inteiro é 00:00 → 23:59:59, no fuso da empresa.

    Sem isto o campo mente: marcar "dia inteiro" num evento das 14h às 15h
    guardava 14h–15h, o calendário desenhava na faixa de dia inteiro e o
    detalhe imprimia "Dia inteiro" escondendo a hora que estava lá.

    O corte é no fuso LOCAL (America/Sao_Paulo), não em UTC: "o dia todo" é o
    dia de quem marcou, e usar UTC deslocaria as bordas em três horas.
    """
    from django.utils import timezone

    inicio = timezone.localtime(data_inicio).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    fim = timezone.localtime(data_fim).replace(
        hour=23, minute=59, second=59, microsecond=0
    )
    return inicio, fim


class Evento(models.Model):
    """Evento da agenda. Pode existir sem cliente; se tiver, linka ao CRM."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="eventos_agenda",
        db_index=True,
    )
    titulo = models.CharField(max_length=255)
    descricao = models.TextField(blank=True, default="")
    data_inicio = models.DateTimeField()
    data_fim = models.DateTimeField()
    dia_inteiro = models.BooleanField(default=False)
    local = models.CharField(max_length=255, blank=True, default="")
    cor = models.CharField(max_length=7, default="#6D28D9")

    # Vínculo opcional com o CRM — evento pode existir sem cliente
    cliente = models.ForeignKey(
        "synapse_clientes.Cliente",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="eventos_agenda",
    )

    # ── Lembrete ─────────────────────────────────────────────────────────
    # Quanto antes avisar. Sem isto a agenda só guarda; com isto ela procura
    # a pessoa (sino + e-mail), que é o motivo de existir de uma agenda.
    lembrete_antecedencia = models.PositiveIntegerField(
        choices=LEMBRETE_CHOICES,
        default=SEM_LEMBRETE,
        help_text="Minutos antes do início para avisar. 0 = sem lembrete.",
    )
    # Guarda de idempotência: o lembrete deste evento JÁ FOI PROCESSADO — a
    # task não volta nele. Também fica True quando não havia a quem avisar,
    # senão o evento seria varrido de novo a cada rodada até passar a hora.
    # Remarcar o evento ou trocar a antecedência zera a guarda (ver o Service).
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
            models.Index(fields=["empresa", "data_inicio"]),
            models.Index(fields=["empresa", "data_fim"]),
            # A varredura do lembrete roda a cada 5 min e atravessa todas as
            # empresas: o índice é por (pendente, quando começa), não por empresa.
            models.Index(fields=["lembrete_enviado", "data_inicio"]),
        ]

    def save(self, *args, **kwargs):
        """
        A normalização do dia inteiro mora aqui, e não na view, porque o evento
        nasce por mais de um caminho: a API, o follow-up do CRM, o admin e o
        shell. Confiar só no formulário deixaria os outros três mentindo.
        """
        if self.dia_inteiro and self.data_inicio and self.data_fim:
            self.data_inicio, self.data_fim = normalizar_dia_inteiro(
                self.data_inicio, self.data_fim
            )
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.titulo} ({self.data_inicio:%d/%m/%Y %H:%M})"
