/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0F1712',
        canvas: '#F5F6F3',
        surface: '#FFFFFF',
        line: '#E7E9E4',
        brand: {
          DEFAULT: '#14532D',
          soft: '#E7F0EA',
        },
        avatar: {
          a: '#DCEFE3',
          b: '#E4E9F8',
          c: '#F6E7D8',
          d: '#F1E1EE',
          e: '#DEEAF1',
        },
        status: {
          paid: '#1E8E5A',
          paidSoft: '#E4F5EC',
          pending: '#B8860B',
          pendingSoft: '#FBF1DD',
          overdue: '#C23B3B',
          overdueSoft: '#FBE9E9',
          upcoming: '#2563A8',
          upcomingSoft: '#E7F0FA',
          verify: '#6B4FA0',
          verifySoft: '#EFEAF7',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        bento: '18px',
      },
      boxShadow: {
        bento: '0 1px 2px rgba(17, 24, 19, 0.04)',
      },
    },
  },
  plugins: [],
};
