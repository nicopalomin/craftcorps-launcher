/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                slate: {
                    950: 'var(--color-slate-950)',
                    900: 'var(--color-slate-900)',
                    800: 'var(--color-slate-800)',
                    700: 'var(--color-slate-700)',
                    600: 'var(--color-slate-600)',
                    500: 'var(--color-slate-500)',
                    400: 'var(--color-slate-400)',
                    300: 'var(--color-slate-300)',
                    200: 'var(--color-slate-200)',
                    100: 'var(--color-slate-200)', // Map 100 to Main Text as well for lighter hits
                    50: 'var(--color-slate-200)'   // Map 50 to Main Text
                },
                emerald: {
                    800: 'var(--color-emerald-800)',
                    600: 'var(--color-emerald-600)',
                    500: 'var(--color-emerald-500)',
                    400: 'var(--color-emerald-400)'
                }
            }
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}
