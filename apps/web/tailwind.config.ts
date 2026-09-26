import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["IBM Plex Sans", "ui-sans-serif", "system-ui"],
        mono: ["IBM Plex Mono", "ui-monospace"],
      },
      colors: {
        ink: "#0c1118",
        panel: "#141b25",
        line: "#243044",
        gold: "#e4b15a",
        mint: "#7ddec4",
      },
    },
  },
  plugins: [],
} satisfies Config;
