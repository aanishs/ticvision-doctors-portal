// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        background: "#f8f9fa", // Your custom background color
        primary: "#3b82f6",
        "primary-dark": "#2563eb",
        secondary: "#f87171",
        "secondary-dark": "#dc2626",
        "text-primary": "#374151",
        "text-secondary": "#6b7280",
      },
      fontFamily: {
        body: ["Inter", "sans-serif"],
        display: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
