// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
        // ...
        spacing: {
            'ratio-h-3-4': '75%', // 288px de altura fija
        },
        // -----------------
    },
  },
  plugins: [],
};
