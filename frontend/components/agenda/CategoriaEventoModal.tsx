"use client";
/**
 * Synapse — Agenda: gestão das categorias de evento (só admin).
 *
 * Espelha `CategoriaEstoqueModal`/`CategoriaFinanceiroModal`: a gestão de
 * categorias de um módulo mora num modal aberto da tela DO módulo, não em
 * Configurações. Aqui, o botão está na Agenda.
 *
 * Diferença de propósito: aqui NÃO existe excluir. Uma categoria é o que dá
 * significado à cor dos eventos já registrados; apagá-la apagaria a explicação
 * de um histórico. Desligar tira a categoria do formulário sem mexer em quem
 * já a usa — e pode ser religada.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Pencil, Plus, Tag, X } from "lucide-react";
import { useCategoriasAgenda } from "@/hooks/useCategoriasAgenda";
import { getErrorMessage } from "@/lib/api";
import { CORES_EVENTO, type CategoriaEvento } from "@/types/agenda";

interface CategoriaEventoModalProps {
  onFechar: () => void;
  /** Chamado ao criar/editar/religar: a tela recarrega para repintar. */
  onMudou?: () => void;
}

export function CategoriaEventoModal({ onFechar, onMudou }: CategoriaEventoModalProps) {
  // `true`: a gestão vê também as desligadas, senão não haveria como religar.
  const { categorias, loading, error, carregar, criar, atualizar, definirAtivo } =
    useCategoriasAgenda(true);

  const [editando, setEditando] = useState<CategoriaEvento | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(CORES_EVENTO[0]);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [alternando, setAlternando] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    try {
      await carregar();
    } catch {
      // `error` do hook já conta a história na tela.
    }
  }, [carregar]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const abrirNova = () => {
    setEditando(null);
    setNome("");
    setCor(CORES_EVENTO[0]);
    setErroForm(null);
    setMostrarForm(true);
  };

  const abrirEdicao = (cat: CategoriaEvento) => {
    setEditando(cat);
    setNome(cat.nome);
    setCor(cat.cor);
    setErroForm(null);
    setMostrarForm(true);
  };

  const fecharForm = () => {
    setMostrarForm(false);
    setEditando(null);
    setErroForm(null);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvando) return; // evita duplo clique
    setErroForm(null);
    setSalvando(true);
    try {
      if (editando) {
        await atualizar(editando.id, { nome, cor });
        toast.success("Categoria atualizada.");
      } else {
        await criar({ nome, cor });
        toast.success("Categoria criada.");
      }
      fecharForm();
      await recarregar();
      onMudou?.();
    } catch (err) {
      // Erro NUNCA calado: mostra a mensagem real do backend
      setErroForm(getErrorMessage(err));
    } finally {
      setSalvando(false);
    }
  };

  const handleAlternar = async (cat: CategoriaEvento) => {
    if (alternando) return;
    setAlternando(cat.id);
    try {
      await definirAtivo(cat.id, !cat.ativo);
      toast.success(cat.ativo ? "Categoria desativada." : "Categoria reativada.");
      await recarregar();
      onMudou?.();
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setAlternando(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFechar} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-brand-accent" />
            <h2 className="text-lg font-semibold text-foreground">
              Categorias de Evento
            </h2>
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-superficie-forte transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <p className="text-xs text-muted-foreground">
            A categoria é o que dá nome à cor do evento no calendário.
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-erro">
              {error}
            </div>
          )}

          {loading && categorias.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
            </div>
          ) : categorias.length === 0 && !mostrarForm ? (
            <div className="text-center py-8 text-muted-suave">
              <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma categoria cadastrada.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categorias.map((cat) => (
                <div
                  key={cat.id}
                  data-testid={`categoria-linha-${cat.id}`}
                  className={`flex items-center gap-3 p-3 rounded-lg bg-superficie border border-border transition-colors ${
                    cat.ativo ? "" : "opacity-60"
                  }`}
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.cor }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {cat.nome}
                      {!cat.ativo && (
                        <span className="ml-2 text-xs text-muted-suave font-normal">
                          desativada
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-suave">
                      {cat.eventos_count === 1
                        ? "1 evento"
                        : `${cat.eventos_count} eventos`}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => abrirEdicao(cat)}
                      className="p-1.5 rounded-md text-muted-suave hover:text-brand-accent hover:bg-brand-500/10 transition-colors"
                      title="Editar"
                      aria-label={`Editar ${cat.nome}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleAlternar(cat)}
                      disabled={alternando === cat.id}
                      className="p-1.5 rounded-md text-muted-suave hover:text-foreground hover:bg-superficie-forte disabled:opacity-50 transition-colors"
                      title={cat.ativo ? "Desativar" : "Reativar"}
                      aria-label={
                        cat.ativo ? `Desativar ${cat.nome}` : `Reativar ${cat.nome}`
                      }
                    >
                      {alternando === cat.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : cat.ativo ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {mostrarForm && (
            <div className="border border-brand-500/30 rounded-xl p-4 bg-brand-500/5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">
                {editando ? "Editar categoria" : "Nova categoria"}
              </h3>

              <form onSubmit={handleSalvar} className="space-y-4">
                {erroForm && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-erro">
                    {erroForm}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="categoria-nome"
                    className="block text-xs font-medium text-foreground-suave mb-1.5"
                  >
                    Nome <span className="text-erro">*</span>
                  </label>
                  <input
                    id="categoria-nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    maxLength={60}
                    placeholder="Ex: Cobrança"
                    className="w-full px-3 py-2 bg-superficie border border-border rounded-lg text-foreground placeholder-slate-500 focus:outline-none focus:border-brand-500/50 transition-colors text-sm"
                  />
                </div>

                <div>
                  <span className="block text-xs font-medium text-foreground-suave mb-2">
                    Cor
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {CORES_EVENTO.map((opcao) => (
                      <button
                        key={opcao}
                        type="button"
                        onClick={() => setCor(opcao)}
                        aria-label={`Cor ${opcao}`}
                        aria-pressed={cor === opcao}
                        className={`w-6 h-6 rounded-full transition-all ${
                          cor === opcao
                            ? "ring-2 ring-foreground ring-offset-2 ring-offset-card scale-110"
                            : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: opcao }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={fecharForm}
                    className="flex-1 px-3 py-2 rounded-lg border border-border text-foreground-suave hover:text-foreground hover:bg-superficie transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvando}
                    className="flex-1 px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {editando ? "Salvar" : "Criar"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {!mostrarForm && (
          <div className="p-4 border-t border-border flex-shrink-0">
            <button
              onClick={abrirNova}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-brand-500/50 hover:bg-brand-500/5 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Nova categoria
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
