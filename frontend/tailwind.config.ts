import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Cor da MARCA: segue a paleta escolhida pela empresa (globals.css).
        // Formato em canais para o Tailwind poder aplicar opacidade
        // (bg-brand-500/10 continua funcionando).
        brand: {
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "rgb(var(--brand-200) / <alpha-value>)",
          300: "rgb(var(--brand-300) / <alpha-value>)",
          400: "rgb(var(--brand-400) / <alpha-value>)",
          500: "rgb(var(--brand-500) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)",
          700: "rgb(var(--brand-700) / <alpha-value>)",
          800: "rgb(var(--brand-800) / <alpha-value>)",
          900: "rgb(var(--brand-900) / <alpha-value>)",
          // Texto de destaque na cor da marca. É um PAPEL, não um degrau: no
          // escuro aponta para o 400, no claro para o 700.
          accent: "rgb(var(--brand-accent) / <alpha-value>)",
        },
        // Cores semânticas. Mudam de tom entre os modos, nunca de
        // significado — sucesso é verde nos dois.
        sucesso: "hsl(var(--sucesso) / <alpha-value>)",
        erro: "hsl(var(--erro) / <alpha-value>)",
        alerta: "hsl(var(--alerta) / <alpha-value>)",
        info: "hsl(var(--info) / <alpha-value>)",
        // Superfície elevada sobre o card (o antigo bg-white/5).
        superficie: {
          DEFAULT: "hsl(var(--superficie) / <alpha-value>)",
          forte: "hsl(var(--superficie-forte) / <alpha-value>)",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: {
          DEFAULT: "hsl(var(--foreground))",
          // Os dois níveis intermediários de texto (ver globals.css).
          suave: "hsl(var(--foreground-suave))",
        },
        "muted-suave": "hsl(var(--muted-suave))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          border: "hsl(var(--sidebar-border))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // Sombras por modo: no escuro quase não aparecem (a hierarquia vem do
      // contraste entre card e fundo); no claro são o que separa um do outro.
      boxShadow: {
        elevacao: "var(--shadow-sm)",
        "elevacao-md": "var(--shadow-md)",
        "elevacao-lg": "var(--shadow-lg)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        // Fonte dos títulos quando a empresa escolhe uma identidade própria.
        titulo: ["var(--font-titulo, var(--font-inter))", "system-ui", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
