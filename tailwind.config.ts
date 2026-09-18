import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#e60023",
          dark: "#ad081b",
        },
      },
    },
  },
  plugins: [],
};

export default config;
