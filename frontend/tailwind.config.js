/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          500: '#7950f2',
          600: '#7048e8',
        },
        grayBg: '#f6f8fa',
      },
    },
  },
  plugins: [],
};
