"""
Synapse — M7: Módulo Documentos
Models Documento e VersaoDocumento com multi-tenant obrigatório.
"""
import uuid
from django.db import models


class Documento(models.Model):
    TIPO_CHOICES = [
        ("contrato", "Contrato"),
        ("proposta", "Proposta"),
        ("relatorio", "Relatório"),
        ("ata", "Ata de Reunião"),
        ("manual", "Manual"),
        ("politica", "Política"),
        ("outro", "Outro"),
    ]

    STATUS_CHOICES = [
        ("rascunho", "Rascunho"),
        ("em_revisao", "Em Revisão"),
        ("aprovado", "Aprovado"),
        ("arquivado", "Arquivado"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="documentos",
    )
    titulo = models.CharField(max_length=255)
    descricao = models.TextField(blank=True)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default="outro")
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default="rascunho")
    arquivo = models.FileField(upload_to="documentos/%Y/%m/", null=True, blank=True)
    url_externa = models.URLField(blank=True)
    tags = models.JSONField(default=list, blank=True)
    criado_por = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        related_name="documentos_criados",
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "documentos"
        ordering = ["-criado_em"]
        indexes = [
            models.Index(fields=["empresa", "tipo"], name="doc_emp_tipo_idx"),
            models.Index(fields=["empresa", "status"], name="doc_emp_status_idx"),
        ]
        verbose_name = "Documento"
        verbose_name_plural = "Documentos"

    def __str__(self):
        return f"{self.titulo} ({self.get_tipo_display()})"

    @property
    def total_versoes(self):
        return self.versoes.count()

    @property
    def versao_atual(self):
        return self.versoes.order_by("-numero_versao").first()


class VersaoDocumento(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    documento = models.ForeignKey(
        Documento,
        on_delete=models.CASCADE,
        related_name="versoes",
    )
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="versoes_documentos",
    )
    numero_versao = models.PositiveIntegerField(default=1)
    arquivo = models.FileField(upload_to="documentos/versoes/%Y/%m/", null=True, blank=True)
    notas = models.TextField(blank=True)
    criado_por = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        related_name="versoes_criadas",
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "documentos_versoes"
        unique_together = [("documento", "numero_versao")]
        ordering = ["-numero_versao"]
        verbose_name = "Versão do Documento"
        verbose_name_plural = "Versões dos Documentos"

    def __str__(self):
        return f"{self.documento.titulo} v{self.numero_versao}"
