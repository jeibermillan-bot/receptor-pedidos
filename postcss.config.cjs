module.exports = {
  plugins: [
    require('@tailwindcss/postcss'), // 👈 La corrección crítica
    require('autoprefixer'),
  ],
};