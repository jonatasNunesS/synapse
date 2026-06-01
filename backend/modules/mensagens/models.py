import uuid
from django.db import models


class MensagemAutomatica(models.Model):
    """Template de mensagem automática por email."""

    TIPO_GATILHO_CHOICES = [
        ("aniversario", "Aniversário do Cliente"),
        ("followup_atrasado", "Follow-up Atrasado"),
        ("boas_vindas", "Boas-vindas (novo cliente)"),
        ("inativo_30d", "Cliente Inativo 30 dias"),
        ("inativo_60d", "Cliente Inativo 60 dias"),
        ("vencimento_proximo", "Vencimento Próximo (7 dias)"),
        ("manual", "Disparo Manual"),
    ]

    STATUS_CHOICES = [
        ("ativa", "Ativa"),
        ("pausada", "Pausada"),
        ("rascunho", "Rascunho"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="mensagens_automaticas",
    )
    nome = models.CharField(max_length=150)
    assunto = models.CharField(max_length=255)
    corpo_html = models.TextField()
    gatilho = models.CharField(max_length=30, choices=TIPO_GATILHO_CHOICES)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default="rascunho")
    total_enviados = models.IntegerField(default=0)
    ultimo_disparo = models.DateTimeField(null=True, blank=True)
    criado_por = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mensagens_criadas",
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "synapse_mensagens"
        verbose_name = "Mensagem Automática"
        verbose_name_plural = "Mensagens Automáticas"
        ordering = ["-criado_em"]
        indexes = [
            models.Index(fields=["empresa", "status"], name="msg_emp_status_idx"),
        ]

    def __str__(self):
        return f"{self.nome} ({self.get_gatilho_display()})"


class LogEnvioMensagem(models.Model):
    """Registro de cada envio de email realizado."""

    STATUS_CHOICES = [
        ("enviado", "Enviado"),
        ("falhou", "Falhou"),
        ("simulado", "Simulado (dev)"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mensagem = models.ForeignKey(
        MensagemAutomatica,
        on_delete=models.CASCADE,
        related_name="logs",
    )
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="logs_envio",
    )
    destinatario_email = models.EmailField()
    destinatario_nome = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default="enviado")
    erro = models.TextField(blank=True)
    enviado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "synapse_mensagens"
        verbose_name = "Log de Envio"
        verbose_name_plural = "Logs de Envio"
        ordering = ["-enviado_em"]
        indexes = [
            models.Index(fields=["mensagem", "enviado_em"], name="log_msg_enviado_idx"),
        ]

    def __str__(self):
        return f"{self.mensagem.nome} → {self.destinatario_email}"
