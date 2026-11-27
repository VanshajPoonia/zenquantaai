export const HIDDEN_TEXT = '[hidden]'

interface RedactionRule {
  pattern: RegExp
  // Builds the replacement from the regex groups. Returning null keeps the match.
  replace: (match: string, ...groups: string[]) => string | null
}

const hideAll = () => HIDDEN_TEXT

// Values that point at a secret instead of holding one.
const SECRET_REFERENCE = /^(?:process\.env|os\.environ|import\.meta\.env|env\.|getenv|\$\{|\{\{|<)/i

const SECRET_NAMES =
  'api[_-]?key|access[_-]?key|secret[_-]?key|private[_-]?key|access[_-]?token|auth[_-]?token|refresh[_-]?token|api[_-]?token|bearer[_-]?token|client[_-]?secret|secret|password|passwd'

function keepName(name: string, separator: string, quote: string, value: string, closing = '') {
  if (value.includes(HIDDEN_TEXT) || SECRET_REFERENCE.test(value)) return null
  return `${name}${separator}${quote}${HIDDEN_TEXT}${closing}`
}

// Order matters: whole blocks and known token shapes run before the looser name rules.
const RULES: RedactionRule[] = [
  {
    pattern:
      /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----|$)/g,
    replace: hideAll,
  },
  {
    pattern: /\b([a-z][a-z0-9+.-]*:\/\/)[^\s:@/]+:[^\s@/]+@/gi,
    replace: (_match, scheme) => `${scheme}${HIDDEN_TEXT}@`,
  },
  { pattern: /\beyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, replace: hideAll },
  // OpenAI, OpenRouter (sk-or-) and Anthropic (sk-ant-) keys.
  { pattern: /\bsk-(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{20,}/g, replace: hideAll },
  { pattern: /\bzq_[A-Za-z0-9]{20,}/g, replace: hideAll },
  { pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g, replace: hideAll },
  { pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, replace: hideAll },
  { pattern: /\bxox[a-z]-[A-Za-z0-9-]{10,}/g, replace: hideAll },
  { pattern: /\bAIza[0-9A-Za-z_-]{35}/g, replace: hideAll },
  {
    pattern: /\b(Bearer)(\s+)(?=[A-Za-z0-9._~+/=-]*\d)[A-Za-z0-9._~+/=-]{20,}/gi,
    replace: (_match, word, space) => `${word}${space}${HIDDEN_TEXT}`,
  },
  // Env style: OPENAI_API_KEY=..., DB_PASSWORD: ...
  {
    pattern:
      /\b((?:[A-Z0-9]+_)*(?:SECRET|TOKEN|KEY|PASSWORD|PASSWD|PASS|PWD|APIKEY)(?:_[A-Z0-9]+)*)(\s*[=:]\s*)(["']?)([^\s"'`$<>{}()[\],;]{8,})/g,
    replace: (_match, name, separator, quote, value) => keepName(name, separator, quote, value),
  },
  // Code style with a quoted value: apiKey: "...", "password": "..."
  {
    pattern: new RegExp(
      `(["']?)\\b((?:[A-Za-z0-9]+[_-]?)?(?:${SECRET_NAMES}))\\1(\\s*[:=]\\s*)(["'])([^\\s"'\`]{8,})\\4`,
      'gi'
    ),
    replace: (_match, nameQuote, name, separator, quote, value) =>
      keepName(`${nameQuote}${name}${nameQuote}`, separator, quote, value, quote),
  },
  // Code style without quotes needs a longer value with a digit in it.
  {
    pattern: new RegExp(
      `\\b((?:[A-Za-z0-9]+[_-]?)?(?:${SECRET_NAMES}))(\\s*[:=]\\s*)(?=[^\\s"'\`$<>{}()[\\],;]*\\d)([^\\s"'\`$<>{}()[\\],;]{12,})`,
      'gi'
    ),
    replace: (_match, name, separator, value) => keepName(name, separator, '', value),
  },
]

export interface RedactionResult {
  text: string
  count: number
}

/** Replaces things that look like keys, tokens or passwords with [hidden]. */
export function redactSecrets(text: string): RedactionResult {
  let count = 0
  let output = text

  for (const rule of RULES) {
    output = output.replace(rule.pattern, (match: string, ...rest: unknown[]) => {
      // replace() passes the groups, then the offset and the whole input.
      const groups = rest
        .slice(0, rest.findIndex((value) => typeof value === 'number'))
        .map((value) => (typeof value === 'string' ? value : ''))
      const replacement = rule.replace(match, ...groups)
      if (replacement === null) return match
      count += 1
      return replacement
    })
  }

  return { text: output, count }
}

/** Keeps a running count across many fields of one share. */
export function createRedactor() {
  let count = 0

  return {
    redact(text: string): string {
      const result = redactSecrets(text)
      count += result.count
      return result.text
    },
    get count() {
      return count
    },
  }
}
