"""
Synapse — Módulo Agenda (v1): Models
Evento de calendário com multi-tenant obrigatório (empresa_id) e vínculo
opcional com um Cliente do CRM.
"""
import uuid

from django.db import models


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
        ]

    def __str__(self) -> str:
        return f"{self.titulo} ({self.data_inicio:%d/%m/%Y %H:%M})"
