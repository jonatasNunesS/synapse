"use client";
/**
 * Synapse — Busca com debounce para os seletores de vínculo do evento.
 *
 * Existe para haver UMA implementação de debounce, não três. O seletor de
 * cliente já tinha o defeito de um debounce escrito pela metade — o timer era
 * declarado e limpo, mas nada nunca o ATRIBUÍA, então cada tecla ia ao
 * servidor (consertado na Fase B1). Copiar aquele bloco para projeto e venda
 * seria copiar a chance de repetir o mesmo erro em dois lugares novos.
 *
 * Dois estados de propósito: `digitado` é o que aparece no campo (muda a cada
 * tecla) e o termo enviado ao servidor só muda quando a pessoa para de digitar.
 *
 * `fixo` é uma opção que precisa estar na lista mesmo fora da busca: o vínculo
 * que o evento JÁ tem. Sem ela, abrir um evento vinculado a um projeto que não
 * casa com a busca atual mostraria o seletor em branco — e salvar apagaria o
 * vínculo sem ninguém pedir.
 */
import { useEffect, useRef, useState } from "react";

/** Quanto tempo sem digitar antes de perguntar ao servidor. */
export const ESPERA_BUSCA_MS = 300;

export interface OpcaoVinculo {
  id: string;
  rotulo: string;
  /**
   * O cliente que este vínculo já conhece, quando conhece algum.
   *
   * Hoje só a VENDA preenche: é o que permite oferecer "essa venda é da Ana,
   * vincular a ela também?" sem uma segunda ida ao servidor. Projeto não tem
   * campo de cliente no modelo, então vem sempre ausente daqui.
   */
  clienteSugerido?: { id: string; nome: string } | null;
}

interface Params {
  /**
   * Vai ao servidor. Recebe o termo já debounced.
   *
   * Precisa ser uma referência ESTÁVEL (função de módulo, ou memoizada com
   * `useCallback`). Ela entra nas dependências do efeito, então uma arrow
   * inline nova a cada render refaria a busca a cada renderização. As duas que
   * o formulário usa — `buscarProjetos` e `buscarVendas` — são funções de
   * módulo, logo estáveis por construção.
   */
  buscar: (termo: string) => Promise<OpcaoVinculo[]>;
  /** O vínculo atual do evento, garantido na lista. */
  fixo?: OpcaoVinculo | null;
  /** Falso desliga a busca por inteiro (módulo desligado). */
  ativo?: boolean;
}

export function useBuscaVinculo({ buscar, fixo = null, ativo = true }: Params) {
  const [digitado, setDigitado] = useState("");
  const [termo, setTermo] = useState("");
  const [carregadas, setCarregadas] = useState<OpcaoVinculo[]>([]);
  const timer = useRef<NodeJS.Timeout | null>(null);

  const fixoId = fixo?.id ?? null;
  const fixoRotulo = fixo?.rotulo ?? null;

  // Desligado é lista vazia — DERIVADO, não guardado. Zerar o estado dentro do
  // efeito dispararia uma renderização em cascata (o lint do React reclama, com
  // razão: o valor já é conhecido na hora do render).
  const opcoes = ativo ? carregadas : [];

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    (async () => {
      try {
        const lista = await buscar(termo);
        if (!vivo) return;
        const comFixo =
          fixoId && fixoRotulo && !lista.some((o) => o.id === fixoId)
            ? [{ id: fixoId, rotulo: fixoRotulo }, ...lista]
            : lista;
        setCarregadas(comFixo);
      } catch {
        // Silencioso de propósito: o vínculo é opcional, e um toast de erro
        // por não conseguir listar projetos atrapalharia quem só quer marcar
        // um compromisso. A lista fica vazia e o formulário segue utilizável.
        if (vivo) setCarregadas(fixoId && fixoRotulo ? [{ id: fixoId, rotulo: fixoRotulo }] : []);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [buscar, termo, ativo, fixoId, fixoRotulo]);

  /** Chamado a cada tecla. Só o último valor, depois da espera, vai ao servidor. */
  const onDigitar = (valor: string) => {
    setDigitado(valor);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setTermo(valor), ESPERA_BUSCA_MS);
  };

  // Fechar o formulário no meio da digitação não pode deixar um timer vivo
  // chamando setState num componente que já saiu de cena.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { digitado, onDigitar, opcoes };
}
