/**
 * Synapse — configuração do ESLint (flat config).
 *
 * O projeto ficou sem linter quando o Next 16 removeu o `next lint`, e nada
 * passou a verificar o que o TypeScript não vê: hook chamado
 * condicionalmente, dependência faltando em efeito, <img> no lugar de
 * next/image, acessibilidade. Vários achados da auditoria de qualidade eram
 * exatamente desse tipo.
 *
 * O critério de nível é um só: ERRO é o que quebra ou esconde um defeito;
 * AVISO é o que merece limpeza mas não pode travar o build nem afogar o
 * sinal. Um lint que reprova 80 vezes no primeiro dia é um lint que ninguém
 * lê — e volta a não existir.
 *
 * Nada aqui trata de estilo: formatação não é trabalho de linter neste
 * projeto.
 */
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "coverage/**",
      "public/**",
    ],
  },

  ...nextCoreWebVitals,
  ...nextTypeScript,

  {
    rules: {
      // ── Rebaixadas a aviso ────────────────────────────────────────────
      // As três abaixo vêm do React Compiler e falam de OTIMIZAÇÃO, não de
      // correção: apontam render em cascata e memoização que o compilador
      // não conseguiu preservar. O código funciona. Como erro, sozinhas
      // reprovariam o lint em 38 pontos e enterrariam qualquer achado real.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/use-memo": "warn",

      // `any` é decisão de tipagem, não defeito. Vale registrar para
      // apertar aos poucos, não para barrar merge.
      "@typescript-eslint/no-explicit-any": "warn",

      // Import morto é dívida real, mas não quebra nada em execução — fica
      // como aviso. O prefixo `_` continua sendo a forma de dizer
      // "não usado de propósito" sem ruído.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  {
    // Arquivos de configuração carregam plugins por require() — é o idioma
    // da ferramenta (ver tailwind.config.ts), não um deslize.
    files: ["*.config.{js,mjs,ts}"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },

  {
    // Testes falam com o DOM e com dublês; exigir tipagem estrita aqui
    // atrapalha mais do que protege.
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
];

export default config;
