/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: "#0d0e12",
        darkPanel: "#161821",
        darkBorder: "#2a2d3d",
        darkMuted: "#8b949e",
        neonTeal: "#0df",
        neonIndigo: "#6366f1",
      },
      fontFamily: {
        sans: ["Outfit", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
