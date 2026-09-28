"use client";
/**
 * Synapse — Agenda v1: Formulário de criação/edição de Evento (modal).
 * Tema dark via tokens do sistema. Datas via datetime-local (mantêm a hora
 * ao trocar a data — evita o bug do Lote 4 de zerar o horário).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buscarClientes, buscarProjetos, buscarVendas } from "@/hooks/useAgenda";
import { getErrorMessage } from "@/lib/api";
import { useCategoriasAgenda } from "@/hooks/useCategoriasAgenda";
import { useBuscaVinculo } from "@/hooks/useBuscaVinculo";
import { useModulos } from "@/hooks/useModulos";
import {
  CORES_EVENTO,
  LEMBRETES,
  SEM_LEMBRETE,
  type Evento,
  type EventoPayload,
} from "@/types/agenda";

interface ClienteOption {
  id: string;
  nome: string;
}

/** Quanto tempo sem digitar antes de perguntar ao servidor. */
export const ESPERA_BUSCA_MS = 300;

interface EventoFormProps {
  evento?: Evento | null;
  // Data inicial ao criar clicando num slot do calendário
  slotInicial?: { inicio: Date; fim: Date } | null;
  onSalvar: (dados: EventoPayload) => Promise<void>;
  onFechar: () => void;
}

// ── Helpers de timezone (ISO ↔ input datetime-local) ──────────────────────
function isoParaLocalInput(iso: string): string {
  const d = new Date(iso);
  // Ajusta para o fuso local e formata YYYY-MM-DDTHH:mm sem perder a hora
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}
function localInputParaIso(local: string): string {
  // new Date("YYYY-MM-DDTHH:mm") interpreta como horário local → ISO em UTC
  return new Date(local).toISOString();
}
function dateParaLocalInput(d: Date): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

// ── Dia inteiro: a hora some da tela, mas o estado continua sendo
// "YYYY-MM-DDTHH:mm". Quem normaliza para 00:00 → 23:59 é o backend, no save
// do modelo, porque o evento nasce por mais caminhos que este formulário.
/** "2026-10-05T14:30" → "2026-10-05" (o que o input `date` mostra). */
export function soData(local: string): string {
  return local.slice(0, 10);
}
/** "2026-10-05" + o estado anterior → mantém a hora que já estava guardada. */
export function juntarComHora(data: string, anterior: string): string {
  const hora = anterior.slice(11) || "00:00";
  return `${data}T${hora}`;
}

export function EventoForm({ evento, slotInicial, onSalvar, onFechar }: EventoFormProps) {
  const editando = !!evento;

  const inicioPadrao = useMemo(() => {
    if (evento) return isoParaLocalInput(evento.data_inicio);
    if (slotInicial) return dateParaLocalInput(slotInicial.inicio);
    return dateParaLocalInput(new Date());
  }, [evento, slotInicial]);

  const fimPadrao = useMemo(() => {
    if (evento) return isoParaLocalInput(evento.data_fim);
    if (slotInicial) return dateParaLocalInput(slotInicial.fim);
    const d = new Date();
    d.setHours(d.getHours() + 1);
    return dateParaLocalInput(d);
  }, [evento, slotInicial]);

  const [titulo, setTitulo] = useState(evento?.titulo ?? "");
  const [descricao, setDescricao] = useState(evento?.descricao ?? "");
  const [dataInicio, setDataInicio] = useState(inicioPadrao);
  const [dataFim, setDataFim] = useState(fimPadrao);
  const [diaInteiro, setDiaInteiro] = useState(evento?.dia_inteiro ?? false);
  const [local, setLocal] = useState(evento?.local ?? "");
  // A cor não é mais escolhida aqui: ela vem da CATEGORIA. O campo `cor` do
  // evento continua existindo como fallback dos eventos criados antes das
  // categorias, e o formulário não o toca.
  const [categoriaId, setCategoriaId] = useState<string>(evento?.categoria ?? "");
  const {
    categorias,
    carregar: carregarCategorias,
    error: erroCategorias,
  } = useCategoriasAgenda();
  const [lembrete, setLembrete] = useState<number>(
    evento?.lembrete_antecedencia ?? SEM_LEMBRETE
  );
  const [clienteId, setClienteId] = useState<string | "">(evento?.cliente ?? "");

  // ── Vínculos com projeto e venda ────────────────────────────────────────
  // Só aparecem quando a empresa usa o módulo. Projetos tem módulo próprio;
  // Vendas segue o mesmo critério que a Sidebar usa para o item Vendas, que é
  // o módulo Estoque.
  const { moduloAtivo } = useModulos();
  const mostrarProjeto = moduloAtivo("projetos");
  const mostrarVenda = moduloAtivo("estoque");

  const [projetoId, setProjetoId] = useState<string>(evento?.projeto ?? "");
  const [vendaId, setVendaId] = useState<string>(evento?.venda ?? "");

  const buscaProjeto = useBuscaVinculo({
    buscar: buscarProjetos,
    fixo:
      evento?.projeto && evento.projeto_nome
        ? { id: evento.projeto, rotulo: evento.projeto_nome }
        : null,
    ativo: mostrarProjeto,
  });
  const buscaVenda = useBuscaVinculo({
    buscar: buscarVendas,
    fixo:
      evento?.venda && evento.venda_rotulo
        ? { id: evento.venda, rotulo: evento.venda_rotulo }
        : null,
    ativo: mostrarVenda,
  });

  /**
   * A venda escolhida tem cliente, e o evento ainda não tem? Oferece herdar.
   *
   * Sugestão, não regra: quem quiser um compromisso da venda sem marcar o
   * cliente pode ter motivo, e o sistema não decide por ela. O botão apenas
   * poupa o passo de ir buscar o mesmo nome à mão.
   *
   * Só a VENDA oferece isso porque só ela tem cliente. `Projeto` não tem
   * nenhum campo de cliente no modelo — não existe o que herdar de um projeto.
   */
  const [clienteDaVenda, setClienteDaVenda] = useState<{
    id: string;
    nome: string;
  } | null>(null);
  const sugerirClienteDaVenda = !!clienteDaVenda && !clienteId;

  const escolherVenda = (id: string) => {
    setVendaId(id);
    const escolhida = buscaVenda.opcoes.find((o) => o.id === id);
    setClienteDaVenda(escolhida?.clienteSugerido ?? null);
  };

  /** Aceita a sugestão: o cliente da venda passa a ser o cliente do evento. */
  const herdarClienteDaVenda = () => {
    if (!clienteDaVenda) return;
    setClienteId(clienteDaVenda.id);
    // O nome precisa existir na lista do seletor, senão o `select` ficaria com
    // um valor que nenhuma opção representa e mostraria em branco.
    setClientes((atual) =>
      atual.some((c) => c.id === clienteDaVenda.id)
        ? atual
        : [{ id: clienteDaVenda.id, nome: clienteDaVenda.nome }, ...atual]
    );
  };

  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  // Dois estados de propósito: `buscaDigitada` é o que aparece no campo (muda
  // a cada tecla) e `buscaCliente` é o que vai ao servidor (muda quando a
  // pessoa para de digitar). Com um só, ou a digitação trava ou a busca dispara
  // a cada letra — que era o defeito.
  const [buscaDigitada, setBuscaDigitada] = useState("");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const buscaTimer = useRef<NodeJS.Timeout | null>(null);

  /**
   * A cor da categoria escolhida, para a prévia ao lado do seletor.
   *
   * Sem categoria: a cor que o evento já tinha (o fallback), ou o padrão num
   * evento novo. É a mesma regra do `cor_efetiva` do backend, e só serve para
   * a prévia — quem pinta o calendário é o `cor_efetiva` que vem de lá.
   */
  const corDaCategoria =
    categorias.find((c) => c.id === categoriaId)?.cor ??
    evento?.cor_efetiva ??
    CORES_EVENTO[0];

  // As categorias alimentam o seletor. Erro não vira toast: o formulário
  // continua usável sem categoria, e a mensagem abaixo do campo explica.
  useEffect(() => {
    carregarCategorias().catch(() => {});
  }, [carregarCategorias]);

  // Carrega clientes (com o vinculado atual garantido na lista)
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const lista = await buscarClientes(buscaCliente);
        if (!ativo) return;
        // Garante que o cliente já vinculado apareça mesmo fora da busca
        if (evento?.cliente && evento.cliente_nome && !lista.some((c) => c.id === evento.cliente)) {
          lista.unshift({ id: evento.cliente, nome: evento.cliente_nome });
        }
        setClientes(lista);
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    })();
    return () => {
      ativo = false;
    };
  }, [buscaCliente, evento]);

  // Espera a pessoa parar de digitar antes de ir ao servidor. O timer era
  // declarado e limpo, mas nada nunca o ATRIBUÍA: o debounce estava escrito
  // pela metade e cada tecla virava uma chamada a /clientes/.
  const onBuscaChange = (v: string) => {
    setBuscaDigitada(v);
    if (buscaTimer.current) clearTimeout(buscaTimer.current);
    buscaTimer.current = setTimeout(() => setBuscaCliente(v), ESPERA_BUSCA_MS);
  };

  // Sair do formulário no meio da digitação não pode deixar um timer vivo
  // chamando setState num componente que já saiu de cena.
  useEffect(() => {
    return () => {
      if (buscaTimer.current) clearTimeout(buscaTimer.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      setErro("O título é obrigatório.");
      return;
    }
    const inicioIso = localInputParaIso(dataInicio);
    const fimIso = localInputParaIso(dataFim);
    // Com dia inteiro a hora está escondida e não quer dizer nada — comparar
    // por data. Senão, quem abrisse o formulário às 23h e marcasse o mesmo dia
    // nas duas pontas levaria "término antes do início" por causa de horas que
    // a tela nem mostra, e sem ter como corrigir.
    const foraDeOrdem = diaInteiro
      ? soData(dataFim) < soData(dataInicio)
      : new Date(fimIso) < new Date(inicioIso);
    if (foraDeOrdem) {
      setErro("A data de término não pode ser anterior à de início.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({
        titulo: titulo.trim(),
        descricao,
        data_inicio: inicioIso,
        data_fim: fimIso,
        dia_inteiro: diaInteiro,
        local,
        categoria: categoriaId || null,
        lembrete_antecedencia: lembrete,
        cliente: clienteId || null,
        // String vazia é "nenhum" na tela; o backend espera null. Mandar ""
        // num campo de FK seria erro de validação.
        projeto: projetoId || null,
        venda: vendaId || null,
      });
      onFechar();
    } catch (err) {
      setErro(getErrorMessage(err));
    } finally {
      setSalvando(false);
    }
  };

  const inputClass =
    "w-full bg-background text-foreground border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-card text-card-foreground rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {editando ? "Editar Evento" : "Novo Evento"}
          </h2>
          <button onClick={onFechar} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {erro && (
            <div className="bg-destructive/10 text-destructive text-sm px-4 py-2 rounded-lg border border-destructive/30">
              {erro}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Título <span className="text-erro">*</span>
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Casamento Ana & João"
              className={inputClass}
              maxLength={255}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              placeholder="Detalhes do evento..."
              className={`${inputClass} resize-none`}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={diaInteiro}
              onChange={(e) => setDiaInteiro(e.target.checked)}
              className="accent-[hsl(var(--primary))]"
            />
            Dia inteiro
          </label>

          {/* Marcou "dia inteiro"? A hora some. Enquanto ela ficava visível e
              editável, o campo mentia: dava para gravar "dia inteiro das 14h
              às 15h" e a tela escondia a hora depois. */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="evento-inicio"
                className="block text-sm font-medium text-foreground mb-1"
              >
                {diaInteiro ? "Data de início" : "Início"}
              </label>
              <input
                id="evento-inicio"
                type={diaInteiro ? "date" : "datetime-local"}
                value={diaInteiro ? soData(dataInicio) : dataInicio}
                onChange={(e) =>
                  setDataInicio(
                    diaInteiro ? juntarComHora(e.target.value, dataInicio) : e.target.value
                  )
                }
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="evento-fim"
                className="block text-sm font-medium text-foreground mb-1"
              >
                {diaInteiro ? "Data de término" : "Término"}
              </label>
              <input
                id="evento-fim"
                type={diaInteiro ? "date" : "datetime-local"}
                value={diaInteiro ? soData(dataFim) : dataFim}
                onChange={(e) =>
                  setDataFim(
                    diaInteiro ? juntarComHora(e.target.value, dataFim) : e.target.value
                  )
                }
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Local</label>
            <input
              type="text"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Ex: Espaço Villa Garden"
              className={inputClass}
            />
          </div>

          {/* Lembrete — o que faz a agenda avisar, em vez de só guardar */}
          <div>
            <label htmlFor="evento-lembrete" className="block text-sm font-medium text-foreground mb-1">
              Lembrete
            </label>
            <select
              id="evento-lembrete"
              value={lembrete}
              onChange={(e) => setLembrete(Number(e.target.value))}
              className={inputClass}
            >
              {LEMBRETES.map((l) => (
                <option key={l.valor} value={l.valor}>
                  {l.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Avisamos por notificação e e-mail.
            </p>
          </div>

          {/* Cliente do CRM (opcional) */}
          <div>
            {/* `htmlFor`/`id`: o rótulo não estava associado a campo nenhum, então
                leitor de tela (e teste) não tinha como ligar um ao outro. */}
            <label
              htmlFor="evento-cliente"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Cliente (opcional)
            </label>
            <input
              type="text"
              value={buscaDigitada}
              onChange={(e) => onBuscaChange(e.target.value)}
              placeholder="Buscar cliente do CRM..."
              aria-label="Buscar cliente"
              className={`${inputClass} mb-2`}
            />
            <select
              id="evento-cliente"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className={inputClass}
            >
              <option value="">— Sem cliente —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Projeto (opcional) — só quando a empresa usa Projetos */}
          {mostrarProjeto && (
            <div>
              <label
                htmlFor="evento-projeto"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Projeto (opcional)
              </label>
              <input
                type="text"
                value={buscaProjeto.digitado}
                onChange={(e) => buscaProjeto.onDigitar(e.target.value)}
                placeholder="Buscar projeto..."
                aria-label="Buscar projeto"
                className={`${inputClass} mb-2`}
              />
              <select
                id="evento-projeto"
                value={projetoId}
                onChange={(e) => setProjetoId(e.target.value)}
                className={inputClass}
              >
                <option value="">— Sem projeto —</option>
                {buscaProjeto.opcoes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.rotulo}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Venda (opcional) — mesmo critério de visibilidade que a Sidebar */}
          {mostrarVenda && (
            <div>
              <label
                htmlFor="evento-venda"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Venda (opcional)
              </label>
              <input
                type="text"
                value={buscaVenda.digitado}
                onChange={(e) => buscaVenda.onDigitar(e.target.value)}
                placeholder="Buscar venda por cliente..."
                aria-label="Buscar venda"
                className={`${inputClass} mb-2`}
              />
              <select
                id="evento-venda"
                value={vendaId}
                onChange={(e) => escolherVenda(e.target.value)}
                className={inputClass}
              >
                <option value="">— Sem venda —</option>
                {buscaVenda.opcoes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.rotulo}
                  </option>
                ))}
              </select>

              {/* Sugestão de coerência, não regra: o evento pode ficar sem
                  cliente se for isso que a pessoa quer. */}
              {sugerirClienteDaVenda && (
                <div
                  data-testid="sugestao-cliente-da-venda"
                  className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2"
                >
                  <p className="text-xs text-muted-foreground">
                    Essa venda é de{" "}
                    <span className="font-medium text-foreground">
                      {clienteDaVenda?.nome}
                    </span>
                    . Vincular o evento a ela também?
                  </p>
                  <button
                    type="button"
                    onClick={herdarClienteDaVenda}
                    className="flex-shrink-0 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Vincular
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Categoria — no lugar das 10 cores mudas. A cor vem dela. */}
          <div>
            <label
              htmlFor="evento-categoria"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Categoria
            </label>
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                data-testid="previa-cor-categoria"
                className="h-5 w-5 flex-shrink-0 rounded-full border border-border"
                style={{ backgroundColor: corDaCategoria }}
              />
              <select
                id="evento-categoria"
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className={inputClass}
              >
                <option value="">— Sem categoria —</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            {categorias.length === 0 && !erroCategorias && (
              <p className="mt-1 text-xs text-muted-foreground">
                Nenhuma categoria ainda. Um administrador cria em
                &ldquo;Categorias&rdquo;, na tela da Agenda.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onFechar}
              className="px-4 py-2 text-sm font-medium text-secondary-foreground bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              {editando ? "Salvar" : "Criar Evento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
