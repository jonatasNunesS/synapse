import uuid
from datetime import date
from django.db import models
from django.utils import timezone
from modules.auth.models import Empresa, CustomUser


class Cliente(models.Model):
    """Modelo de cliente para o CRM."""

    STATUS_FUNIL = [
        ("lead", "Lead"),
        ("contato", "Contato"),
        ("proposta", "Proposta"),
        ("negociacao", "Negociação"),
        ("fechado", "Fechado"),
        ("perdido", "Perdido"),
    ]

    ORIGEM_CHOICES = [
        ("indicacao", "Indicação"),
        ("instagram", "Instagram"),
        ("google", "Google"),
        ("whatsapp", "WhatsApp"),
        ("site", "Site"),
        ("outro", "Outro"),
    ]

    TIPO_CHOICES = [
        ("pessoa_fisica", "Pessoa Física"),
        ("pessoa_juridica", "Pessoa Jurídica"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name="clientes",
    )
    nome = models.CharField(max_length=255)
    tipo = models.CharField(
        max_length=20,
        choices=TIPO_CHOICES,
        default="pessoa_fisica",
    )
    email = models.EmailField(blank=True)
    telefone = models.CharField(max_length=20, blank=True)
    whatsapp = models.CharField(max_length=20, blank=True)
    documento = models.CharField(max_length=20, blank=True)
    nome_empresa = models.CharField(max_length=255, blank=True)
    endereco_cidade = models.CharField(max_length=100, blank=True)
    endereco_estado = models.CharField(max_length=2, blank=True)
    segmento = models.CharField(max_length=100, blank=True)
    status_funil = models.CharField(
        max_length=20,
        choices=STATUS_FUNIL,
        default="lead",
    )
    origem = models.CharField(max_length=20, choices=ORIGEM_CHOICES, blank=True)
    valor_total_compras = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )
    quantidade_compras = models.IntegerField(default=0)
    ultima_compra = models.DateField(null=True, blank=True)
    proximo_followup = models.DateField(null=True, blank=True)
    tags = models.CharField(max_length=500, blank=True)
    notas = models.TextField(blank=True)
    ativo = models.BooleanField(default=True)
    criado_por = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="clientes_criados",
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "synapse_clientes"
        verbose_name = "Cliente"
        verbose_name_plural = "Clientes"
        ordering = ["-criado_em"]
        indexes = [
            models.Index(fields=["empresa", "status_funil"]),
            models.Index(fields=["empresa", "ativo"]),
            models.Index(fields=["empresa", "criado_em"]),
            models.Index(fields=["empresa", "proximo_followup"]),
            models.Index(fields=["empresa", "ultima_compra"]),
        ]

    def __str__(self):
        return f"{self.nome} ({self.get_status_funil_display()})"

    @property
    def ticket_medio(self):
        if self.quantidade_compras and self.quantidade_compras > 0:
            return self.valor_total_compras / self.quantidade_compras
        return 0

    @property
    def dias_sem_compra(self):
        if self.ultima_compra:
            return (date.today() - self.ultima_compra).days
        return None

    @property
    def followup_atrasado(self):
        if self.proximo_followup:
            return self.proximo_followup < date.today()
        return False

    @property
    def link_whatsapp(self):
        if self.whatsapp:
            # Remove todos os caracteres não numéricos
            numero_limpo = "".join(filter(str.isdigit, self.whatsapp))
            return f"https://wa.me/55{numero_limpo}"
        return ""

    @property
    def lista_tags(self):
        if self.tags:
            return [t.strip() for t in self.tags.split(",") if t.strip()]
        return []


class InteracaoCliente(models.Model):
    """Registro de interações com clientes no CRM."""

    TIPO_CHOICES = [
        ("ligacao", "Ligação"),
        ("reuniao", "Reunião"),
        ("email", "E-mail"),
        ("whatsapp", "WhatsApp"),
        ("visita", "Visita"),
        ("venda", "Venda"),
        ("proposta", "Proposta"),
        ("outro", "Outro"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.CASCADE,
        related_name="interacoes",
    )
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name="interacoes_clientes",
    )
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    titulo = models.CharField(max_length=255)
    descricao = models.TextField(blank=True)
    valor = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    data_interacao = models.DateTimeField(default=timezone.now)
    proximo_followup = models.DateField(null=True, blank=True)
    criado_por = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="interacoes_criadas",
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "synapse_clientes"
        verbose_name = "Interação com Cliente"
        verbose_name_plural = "Interações com Clientes"
        ordering = ["-data_interacao"]
        indexes = [
            models.Index(fields=["cliente", "criado_em"]),
            models.Index(fields=["empresa", "tipo"]),
            models.Index(fields=["empresa", "proximo_followup"]),
        ]

    def __str__(self):
        return f"{self.get_tipo_display()} — {self.cliente.nome} ({self.data_interacao.date()})"
