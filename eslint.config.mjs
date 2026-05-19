import nextVitals from 'eslint-config-next/core-web-vitals'

const eslintConfig = [
  ...nextVitals,
  {
    ignores: ['.pnpm-store/**'],
  },
]

export default eslintConfig
