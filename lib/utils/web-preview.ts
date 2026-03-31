type CodeFence = {
  language: string
  code: string
}

function normalizeLanguage(language: string): string {
  const normalized = language.toLowerCase().trim()

  if (['html', 'htm'].includes(normalized)) return 'html'
  if (['css', 'scss'].includes(normalized)) return 'css'
  if (['js', 'javascript'].includes(normalized)) return 'js'

  return normalized
}

function extractCodeFences(content: string): CodeFence[] {
  const fences: CodeFence[] = []
  const expression = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g

  for (const match of content.matchAll(expression)) {
    fences.push({
      language: normalizeLanguage(match[1] ?? ''),
      code: match[2]?.trim() ?? '',
    })
  }

  return fences
}

function buildFallbackHtml(js?: string): string {
  if (!js) {
    return '<main id="app"></main>'
  }

  return `
    <main id="app"></main>
    <script>
      const mount = document.getElementById('app')
      if (mount && !mount.innerHTML.trim()) {
        mount.innerHTML = '<div class="preview-shell">Preview loaded.</div>'
      }
    </script>
  `.trim()
}

function buildDocument(input: { html?: string; css?: string; js?: string }) {
  const html = input.html?.trim() || buildFallbackHtml(input.js)
  const css = input.css?.trim() || ''
  const js = input.js?.trim() || ''

  const containsHtmlTag = /<html[\s>]/i.test(html)
  if (containsHtmlTag) {
    return html
  }

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, system-ui, sans-serif;
      }

      html, body {
        margin: 0;
        min-height: 100%;
        background: #09090b;
        color: #fafafa;
      }

      body {
        padding: 0;
      }

      .preview-shell {
        padding: 24px;
      }

${css}
    </style>
  </head>
  <body>
${html}
    <script>
${js}
    </script>
  </body>
</html>`
}

export function getWebPreviewDocument(content: string): string | null {
  const fences = extractCodeFences(content)
  if (fences.length === 0) return null

  const html = fences.find((fence) => fence.language === 'html')?.code
  const css = fences.find((fence) => fence.language === 'css')?.code
  const js = fences.find((fence) => fence.language === 'js')?.code

  if (!html && !css && !js) return null

  return buildDocument({ html, css, js })
}
