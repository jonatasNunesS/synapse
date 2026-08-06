/**
 * Landing — quadradinho roxo com o raio (marca do Synapse).
 * Aparece no header, na sidebar simulada e no rodapé, em dois tamanhos.
 */
import { s } from "./css";

interface Props {
  /** 25px no header/rodapé, 22px na sidebar simulada. */
  tamanho?: 25 | 22;
}

export function MarcaSynapse({ tamanho = 25 }: Props) {
  const caixa = tamanho === 25 ? 25 : 22;
  const raio = tamanho === 25 ? 7 : 6;
  const icone = tamanho === 25 ? 11 : 10;
  return (
    <span
      aria-hidden="true"
      style={s(
        `width:${caixa}px;height:${caixa}px;border-radius:${raio}px;background:#6D28D9;display:flex;align-items:center;justify-content:center;flex:none`
      )}
    >
      <svg
        width={icone}
        height={icone}
        viewBox="0 0 24 24"
        fill="#FFFFFF"
        aria-hidden="true"
      >
        <path d="M13.5 2 5 13.2h5.2L9.4 22 19 10.5h-5.4L13.5 2z"></path>
      </svg>
    </span>
  );
}
