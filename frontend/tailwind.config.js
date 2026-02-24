/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        diner: {
          red: "#c4454d",
          cream: "#f5efe6",
          charcoal: "#151b26",
          teal: "#0f8a85",
          amber: "#efc66a",
          ink: "#111827",
          slate: "#253246"
        }
      },
      boxShadow: {
        panel: "0 24px 60px rgba(11, 19, 36, 0.24)",
        soft: "0 12px 28px rgba(11, 19, 36, 0.16)"
      }
    }
  },
  plugins: []
};
