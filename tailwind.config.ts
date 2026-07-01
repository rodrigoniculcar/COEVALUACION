import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          500: "#3457d5",
          600: "#2a45ab",
          700: "#213687",
        },
      },
    },
  },
  plugins: [],
};
export default config;
