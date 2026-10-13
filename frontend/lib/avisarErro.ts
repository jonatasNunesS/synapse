/**
 * Synapse — O toast de uma leitura que falhou.
 *
 * Existe por causa da Leva 4. As leituras dos hooks de dados passaram a
 * propagar o erro em vez de engoli-lo, e propagar só serve se alguém escutar:
 * um `useEffect(() => { listar(); })` com a promessa rejeitada não mostra nada
 * a ninguém — só escreve "Uncaught (in promise)" num console que o usuário do
 * sistema nunca abre.
 *
 * Então cada carregamento passa por aqui. É um envelope de uma linha em vez de
 * um try/catch por chamada, e isso é deliberado: são mais de trinta pontos de
 * carregamento no app, e a versão verbosa é a que deixa um de fora sem que
 * ninguém note — exatamente como o padrão que esta leva está consertando
 * voltou duas vezes.
 *
 * Para ESCRITAS (criar, salvar, excluir) não se usa isto: ali o caller precisa
 * saber se deu certo para fechar o modal, limpar o formulário ou atualizar a
 * lista, e por isso continua com try/catch explícito.
 */
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/api";

/**
 * Deixa a promessa seguir, e avisa com a mensagem do backend se ela rejeitar.
 *
 * A promessa devolvida NUNCA rejeita — é o que faz dela segura dentro de um
 * efeito. O valor resolvido vira `undefined` no caminho da falha, de modo que
 * `const dados = await avisarSeFalhar(carregar())` recebe `undefined` quando
 * não deu, e quem precisa distinguir isso pode checar.
 */
export function avisarSeFalhar<T>(promessa: Promise<T>): Promise<T | undefined> {
  return promessa.catch((err) => {
    toast.error(getErrorMessage(err), { duration: 7000 });
    return undefined;
  });
}
