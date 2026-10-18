import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        warm: {
          50: "#FAF7F2",
          100: "#F5F0EB",
          200: "#EAE3D9",
          300: "#D5C8B8",
          400: "#BEA993",
          500: "#A88D73",
          600: "#8F7259",
          700: "#705844",
          800: "#524032",
          900: "#362B22",
          950: "#241B15",
        },
        terracotta: {
          50: "#FDF6F0",
          100: "#FBEAE0",
          200: "#F6D2C2",
          300: "#EEB29A",
          400: "#E4896D",
          500: "#C86D51",
          600: "#B2543A",
          700: "#94402A",
          800: "#7A3626",
          900: "#653023",
        },
        amberGold: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#FBBF24",
          500: "#D97706",
          600: "#B45309",
          700: "#92400E",
          800: "#78350F",
          900: "#451A03",
        },
        rosegold: {
          50: "#FFF5F5",
          100: "#FFE4E6",
          200: "#FECDD3",
          300: "#FDA4AF",
          400: "#FB7185",
          500: "#E07A5F",
          600: "#C0563E",
          700: "#9E3C27",
        }
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        warm: "0 4px 20px -2px rgba(180, 120, 90, 0.08)",
        "warm-md": "0 8px 30px -4px rgba(180, 120, 90, 0.12)",
        "warm-lg": "0 12px 40px -6px rgba(180, 120, 90, 0.16)",
      }
    },
  },
  plugins: [],
};

export default config;
