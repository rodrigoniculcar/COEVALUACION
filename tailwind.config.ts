import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Colores institucionales Duoc UC: naranja como color primario de
        // acción, azul marino ("navy") como color de acento/cabecera.
        brand: {
          50: "#fff4ea",
          100: "#ffe2c2",
          200: "#ffc98c",
          400: "#fa9640",
          500: "#f2790f",
          600: "#d9640a",
          700: "#b34f08",
        },
        navy: {
          50: "#eaedf3",
          100: "#ccd3e3",
          400: "#3b5178",
          500: "#243b60",
          600: "#1b2c49",
          700: "#132035",
          800: "#0f1a2b",
        },
      },
    },
  },
  plugins: [],
};
export default config;
