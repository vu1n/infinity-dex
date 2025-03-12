/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4F46E5', // Indigo
          dark: '#4338CA',
          light: '#818CF8',
        },
        secondary: {
          DEFAULT: '#10B981', // Emerald
          dark: '#059669',
          light: '#34D399',
        },
        background: {
          DEFAULT: '#111827', // Dark blue-gray
          light: '#1F2937',
          lighter: '#374151',
        },
        accent: {
          DEFAULT: '#F59E0B', // Amber
          dark: '#D97706',
          light: '#FBBF24',
        },
        surface: {
          DEFAULT: '#1F2937', // Darker gray for cards
          dark: '#111827',
          light: '#374151',
        },
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 4px 20px 0 rgba(0, 0, 0, 0.1)',
        'input': '0 2px 4px 0 rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
  darkMode: 'class',
} 