"""
Synapse — M6: Models do módulo Projetos e Tarefas.
Multi-tenant obrigatório: todos os models de negócio têm empresa_id.
"""
import uuid
from datetime import date

from django.db import models


class Projeto(models.Model):
    """Projeto gerenciado pela empresa."""

    STATUS_CHOICES = [
        ("planejamento", "Planejamento"),
        ("em_andamento", "Em Andamento"),
        ("pausado", "Pausado"),
        ("concluido", "Concluído"),
        ("cancelado", "Cancelado"),
    ]

    PRIORIDADE_CHOICES = [
        ("baixa", "Baixa"),
        ("media", "Média"),
        ("alta", "Alta"),
        ("urgente", "Urgente"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="projetos",
    )
    nome = models.CharField(max_length=255)
    descricao = models.TextField(blank=True)
    status = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="planejamento"
    )
    prioridade = models.CharField(
        max_length=10, choices=PRIORIDADE_CHOICES, default="media"
    )
    responsavel = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="projetos_responsavel",
    )
    data_inicio = models.DateField(null=True, blank=True)
    data_prazo = models.DateField(null=True, blank=True)
    data_conclusao = models.DateField(null=True, blank=True)
    cor = models.CharField(max_length=7, default="#6D28D9")
    ativo = models.BooleanField(default=True)
    criado_por = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="projetos_criados",
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "synapse_projetos"
        verbose_name = "Projeto"
        verbose_name_plural = "Projetos"
        ordering = ["-criado_em"]
        indexes = [
            models.Index(fields=["empresa", "status"], name="proj_emp_status_idx"),
            models.Index(fields=["empresa", "prioridade"], name="proj_emp_prio_idx"),
            models.Index(fields=["empresa", "responsavel"], name="proj_emp_resp_idx"),
            models.Index(fields=["empresa", "criado_em"], name="proj_emp_criado_idx"),
        ]

    def __str__(self):
        return f"{self.nome} ({self.status})"

    @property
    def total_tarefas(self) -> int:
        """Conta tarefas ativas do projeto."""
        return self.tarefas.filter(status__in=["a_fazer", "em_andamento", "revisao", "concluido"]).count()

    @property
    def tarefas_concluidas(self) -> int:
        """Conta tarefas concluídas do projeto."""
        return self.tarefas.filter(status="concluido").count()

    @property
    def progresso(self) -> int:
        """Percentual de conclusão (0-100)."""
        total = self.total_tarefas
        if total == 0:
            return 0
        return int(self.tarefas_concluidas / total * 100)

    @property
    def esta_atrasado(self) -> bool:
        """True se o prazo passou e o projeto não está concluído/cancelado."""
        if not self.data_prazo:
            return False
        return self.data_prazo < date.today() and self.status not in ("concluido", "cancelado")

    @property
    def dias_restantes(self):
        """Dias até o prazo (pode ser negativo se atrasado)."""
        if not self.data_prazo:
            return None
        return (self.data_prazo - date.today()).days


class Tarefa(models.Model):
    """Tarefa pertencente a um Projeto."""

    STATUS_CHOICES = [
        ("a_fazer", "A Fazer"),
        ("em_andamento", "Em Andamento"),
        ("revisao", "Revisão"),
        ("concluido", "Concluído"),
    ]

    PRIORIDADE_CHOICES = [
        ("baixa", "Baixa"),
        ("media", "Média"),
        ("alta", "Alta"),
        ("urgente", "Urgente"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    projeto = models.ForeignKey(
        Projeto,
        on_delete=models.CASCADE,
        related_name="tarefas",
    )
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="tarefas_projetos",
    )
    titulo = models.CharField(max_length=255)
    descricao = models.TextField(blank=True)
    status = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="a_fazer"
    )
    prioridade = models.CharField(
        max_length=10, choices=PRIORIDADE_CHOICES, default="media"
    )
    responsavel = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tarefas_responsavel",
    )
    data_prazo = models.DateField(null=True, blank=True)
    data_conclusao = models.DateField(null=True, blank=True)
    ordem = models.IntegerField(default=0)
    estimativa_horas = models.DecimalField(
        max_digits=5, decimal_places=1, null=True, blank=True
    )
    horas_gastas = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    criado_por = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tarefas_criadas",
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "synapse_projetos"
        verbose_name = "Tarefa"
        verbose_name_plural = "Tarefas"
        ordering = ["ordem", "criado_em"]
        indexes = [
            models.Index(fields=["projeto", "status"], name="tar_proj_status_idx"),
            models.Index(fields=["projeto", "ordem"], name="tar_proj_ordem_idx"),
            models.Index(fields=["empresa", "responsavel"], name="tar_emp_resp_idx"),
            models.Index(fields=["empresa", "data_prazo"], name="tar_emp_prazo_idx"),
            models.Index(fields=["empresa", "status"], name="tar_emp_status_idx"),
        ]

    def __str__(self):
        return f"{self.titulo} [{self.status}]"

    @property
    def esta_atrasada(self) -> bool:
        """True se o prazo passou e a tarefa não está concluída."""
        if not self.data_prazo:
            return False
        return self.data_prazo < date.today() and self.status != "concluido"

    @property
    def dias_restantes(self):
        """Dias até o prazo (pode ser negativo se atrasada)."""
        if not self.data_prazo:
            return None
        return (self.data_prazo - date.today()).days


class Comentario(models.Model):
    """Comentário em uma Tarefa."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tarefa = models.ForeignKey(
        Tarefa,
        on_delete=models.CASCADE,
        related_name="comentarios",
    )
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="comentarios_projetos",
    )
    autor = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.CASCADE,
        related_name="comentarios_tarefas",
    )
    texto = models.TextField()
    editado = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "synapse_projetos"
        verbose_name = "Comentário"
        verbose_name_plural = "Comentários"
        ordering = ["criado_em"]
        indexes = [
            models.Index(fields=["tarefa", "criado_em"], name="com_tar_criado_idx"),
        ]

    def __str__(self):
        return f"Comentário de {self.autor} em {self.tarefa}"


class ChecklistItem(models.Model):
    """Item de checklist de uma Tarefa."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tarefa = models.ForeignKey(
        Tarefa,
        on_delete=models.CASCADE,
        related_name="checklist",
    )
    texto = models.CharField(max_length=255)
    concluido = models.BooleanField(default=False)
    ordem = models.IntegerField(default=0)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "synapse_projetos"
        verbose_name = "Item de Checklist"
        verbose_name_plural = "Itens de Checklist"
        ordering = ["ordem", "criado_em"]

    def __str__(self):
        status = "✓" if self.concluido else "○"
        return f"{status} {self.texto}"
