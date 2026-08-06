/**
 * Imagem de compartilhamento (og:image) da landing — gerada pelo próprio Next,
 * sem asset binário no repositório. Usa a marca e a headline da página.
 */
import { ImageResponse } from "next/og";

export const alt = "Synapse — Sistema de gestão para pequenos negócios";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#FAFAF9",
          color: "#18181B",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#6D28D9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF">
              <path d="M13.5 2 5 13.2h5.2L9.4 22 19 10.5h-5.4L13.5 2z" />
            </svg>
          </div>
          <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1 }}>
            Synapse
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 68,
            lineHeight: 1.1,
            letterSpacing: -2,
            maxWidth: 900,
          }}
        >
          Um sistema onde a venda, o estoque e o caixa andam juntos
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "#52525B" }}>
          Sistema de gestão para pequenos negócios
        </div>
      </div>
    ),
    size
  );
}
