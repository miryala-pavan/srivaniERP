import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream:         '#FAF3E4',
        paper2:        '#F3E8CF',
        ink:           '#2C1B10',
        'ink-soft':    '#6A5340',
        saffron:       '#D98324',
        'saffron-deep':'#AE5E16',
        maroon:        '#7C2D1A',
        leaf:          '#4E7A41',
        gold:          '#E7C88B',
        line:          'rgba(44,27,16,0.14)',
      },
      fontFamily: {
        heading: ['var(--font-fraunces)', 'Fraunces', 'serif'],
        body:    ['var(--font-hanken)', 'Hanken Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
