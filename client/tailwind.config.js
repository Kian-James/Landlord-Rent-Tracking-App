/** @type {import('tailwindcss').Config} */
// Design tokens follow the "Modern SaaS Financial Dashboard" spec: Bento UI,
// Manrope for headings/financial figures, Inter for everything else, and a
// blue-primary / semantic-status color system with light-bg + dark-text
// badges (status is never color-only - always paired with a label).
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral text/background scale - shifted for the neumorphic/soft-UI
        // pass: a light-grey page canvas (not blue-tinted) so white cards
        // actually pop off it, per the reference design.
        ink: '#0F172A', // primary text
        canvas: '#EFEFEF', // page background
        surface: '#FFFFFF', // card surface
        line: '#E9E9E9', // borders (kept very light - shadows carry most of the separation now)
        muted: '#94A3B8', // muted/tertiary text
        secondary: '#475569', // secondary text
        sidebar: '#0F172A',

        // Primary (brand actions - buttons, active nav, chart highlight bar).
        // Reference spec calls for "dark slate/black for active states and
        // major highlight bars" instead of the old bright blue.
        primary: {
          DEFAULT: '#1F2937',
          dark: '#0B1220',
          light: '#EDEDED',
        },
        // Kept as an alias so any legacy `brand` usage (e.g. "connected"
        // indicators) still resolves - mapped onto the new success green.
        brand: {
          DEFAULT: '#16A34A',
          soft: '#DCFCE7',
        },

        avatar: {
          a: '#DCEFE3',
          b: '#E4E9F8',
          c: '#F6E7D8',
          d: '#F1E1EE',
          e: '#DEEAF1',
        },

        success: { DEFAULT: '#16A34A', light: '#DCFCE7', dark: '#15803D' },
        warning: { DEFAULT: '#D97706', light: '#FEF3C7' },
        danger: { DEFAULT: '#DC2626', light: '#FEE2E2' },

        status: {
          // App-specific state names, mapped onto the spec's closest
          // semantic status color:
          //  - "pending"  = rent due this period, unpaid yet  -> Due Soon (amber)
          //  - "upcoming" = a future due date, not due yet    -> Pending  (blue)
          //  - "verify"   = payment slip awaiting confirmation -> Partial (purple)
          paid: '#16A34A',
          paidSoft: '#DCFCE7',
          pending: '#D97706',
          pendingSoft: '#FEF3C7',
          overdue: '#DC2626',
          overdueSoft: '#FEE2E2',
          upcoming: '#2563EB',
          upcomingSoft: '#DBEAFE',
          verify: '#7C3AED',
          verifySoft: '#EDE9FE',
          // Exact spec status names, available for future states not yet
          // modeled in the app (partial payments, inactive tenants/units).
          partial: '#7C3AED',
          partialSoft: '#EDE9FE',
          inactive: '#64748B',
          inactiveSoft: '#F1F5F9',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        heading: ['"Manrope"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        display: ['48px', { lineHeight: '1.1', fontWeight: '800' }],
        'page-heading': ['32px', { lineHeight: '1.2', fontWeight: '700' }],
        'section-heading': ['24px', { lineHeight: '1.25', fontWeight: '700' }],
        'card-heading': ['18px', { lineHeight: '1.3', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        body: ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        label: ['13px', { lineHeight: '1.4', fontWeight: '600' }],
        caption: ['12px', { lineHeight: '1.4', fontWeight: '400' }],
        metric: ['32px', { lineHeight: '1.15', fontWeight: '800' }],
      },
      borderRadius: {
        sm: '8px',
        input: '10px',
        btn: '10px',
        card: '16px',
        bento: '20px',
        modal: '20px',
      },
      boxShadow: {
        // Softer, more diffuse shadow (bigger blur, lower opacity, no hard
        // edge) so cards read as "soft-UI" resting on the grey canvas
        // instead of bordered boxes.
        bento: '0 12px 32px -12px rgba(15, 23, 42, 0.10)',
        card: '0 8px 20px -10px rgba(15, 23, 42, 0.10)',
      },
    },
  },
  plugins: [],
};
