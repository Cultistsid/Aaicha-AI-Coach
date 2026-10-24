export const content = ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"]

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Geist"', "system-ui", "sans-serif"],
        serif: ['"Fraunces"', '"Iowan Old Style"', "Georgia", "serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"]
      },
      colors: {
        paper: {
          DEFAULT: "#faf9f5",
          warm: "#f5f3ee",
          deep: "#efece3"
        },
        ink: {
          DEFAULT: "#2a1a14",
          soft: "#4a3a30",
          muted: "#6b5a4a",
          subtle: "#9a8c7a",
          faint: "#cfc6b8"
        },
        coral: {
          DEFAULT: "#cc785c",
          deep: "#b8694e",
          soft: "#e6a98e",
          wash: "#f4d9cc",
          tint: "#fbeee5"
        },
        line: {
          DEFAULT: "#e8e4d9",
          strong: "#d6d0c0"
        }
      },
      animation: {
        "fade-up": "fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in": "fadeIn 0.3s ease-out",
        "pulse-soft": "pulseSoft 1.6s ease-in-out infinite",
        "wave-1": "wave 1.1s ease-in-out infinite",
        "wave-2": "wave 1.3s ease-in-out infinite -0.15s",
        "wave-3": "wave 0.9s ease-in-out infinite -0.3s",
        "wave-4": "wave 1.2s ease-in-out infinite -0.45s",
        "wave-5": "wave 1s ease-in-out infinite -0.6s"
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" }
        },
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 }
        },
        pulseSoft: {
          "0%, 100%": { opacity: 0.5 },
          "50%": { opacity: 1 }
        },
        wave: {
          "0%, 100%": { transform: "scaleY(0.4)" },
          "50%": { transform: "scaleY(1)" }
        }
      }
    }
  },
  plugins: []
}
