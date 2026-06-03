const MOCK_WOFF2 = `${__dirname}/mock-font.woff2`

module.exports = {
  'https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap': `
@font-face {
  font-family: 'Geist';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(${MOCK_WOFF2}) format('woff2');
}
`,
  'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap': `
@font-face {
  font-family: 'Geist Mono';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(${MOCK_WOFF2}) format('woff2');
}
`,
}
