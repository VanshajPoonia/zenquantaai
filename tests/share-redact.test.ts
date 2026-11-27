import { describe, expect, it } from 'vitest'
import { createRedactor, HIDDEN_TEXT, redactSecrets } from '@/lib/share/redact'

// Fake values are built at run time so the repo never holds a real-looking secret.
const random = (length: number, alphabet = 'aB3dE5gH7jK9mN1pQ2rS4tU6vW8xY0z') =>
  Array.from({ length }, (_, index) => alphabet[(index * 7 + 3) % alphabet.length]).join('')
const upper = (length: number) => random(length, 'ABCDEFGHJKLMNPQRSTUVWXYZ234567')

function expectHidden(text: string, secret: string, count = 1) {
  const result = redactSecrets(text)
  expect(result.text).not.toContain(secret)
  expect(result.text).toContain(HIDDEN_TEXT)
  expect(result.count).toBe(count)
  return result.text
}

function expectUntouched(text: string) {
  const result = redactSecrets(text)
  expect(result.text).toBe(text)
  expect(result.count).toBe(0)
}

describe('redactSecrets: provider keys and tokens', () => {
  it('hides OpenAI, OpenRouter and Anthropic keys', () => {
    const openai = `sk-proj-${random(40)}`
    const openrouter = `sk-or-v1-${random(48)}`
    const anthropic = `sk-ant-api03-${random(60)}`

    expect(expectHidden(`My key is ${openai} ok`, openai)).toBe(`My key is ${HIDDEN_TEXT} ok`)
    expectHidden(`OPENROUTER=${openrouter}`, openrouter)
    expectHidden(`"${anthropic}"`, anthropic)
  })

  it('hides zq tokens', () => {
    const token = `zq_${random(40)}`
    expect(expectHidden(`zq login --token ${token}`, token)).toBe(
      `zq login --token ${HIDDEN_TEXT}`
    )
  })

  it('hides GitHub tokens of each kind', () => {
    for (const prefix of ['ghp_', 'gho_', 'ghs_', 'ghu_', 'ghr_']) {
      const token = `${prefix}${random(36)}`
      expectHidden(`git clone https://${token}@github.com/a/b`, token)
    }
    const pat = `github_pat_${random(22)}_${random(59)}`
    expectHidden(`token: ${pat}`, pat)
  })

  it('hides AWS access key ids', () => {
    const key = `AKIA${upper(16)}`
    expect(expectHidden(`aws key ${key}.`, key)).toBe(`aws key ${HIDDEN_TEXT}.`)
    const temporary = `ASIA${upper(16)}`
    expectHidden(temporary, temporary)
  })

  it('hides Slack tokens', () => {
    const token = `xoxb-${random(12, '0123456789')}-${random(24)}`
    expectHidden(`slack: ${token}`, token)
  })

  it('hides Google API keys', () => {
    const key = `AIza${random(35)}`
    expectHidden(`?key=${key}&q=1`, key)
  })

  it('hides JWTs', () => {
    const jwt = `eyJ${random(20)}.eyJ${random(40)}.${random(43)}`
    expect(expectHidden(`cookie=${jwt}; Path=/`, jwt)).toBe(`cookie=${HIDDEN_TEXT}; Path=/`)
  })

  it('hides PEM private key blocks, even when cut off', () => {
    const body = random(64)
    const block = `-----BEGIN RSA PRIVATE KEY-----\n${body}\n${body}\n-----END RSA PRIVATE KEY-----`
    expect(expectHidden(`before\n${block}\nafter`, body)).toBe(`before\n${HIDDEN_TEXT}\nafter`)

    const cut = `-----BEGIN OPENSSH PRIVATE KEY-----\n${body}`
    expect(expectHidden(`key:\n${cut}`, body)).toBe(`key:\n${HIDDEN_TEXT}`)

    expectHidden(`-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`, body)
  })

  it('hides bearer tokens but keeps the word Bearer', () => {
    const token = random(32)
    expect(expectHidden(`Authorization: Bearer ${token}`, token)).toBe(
      `Authorization: Bearer ${HIDDEN_TEXT}`
    )
  })

  it('hides credentials inside URLs', () => {
    expect(
      expectHidden('postgres://admin:hunter2pass@db.example.com:5432/app', 'hunter2pass')
    ).toBe(`postgres://${HIDDEN_TEXT}@db.example.com:5432/app`)
    expectHidden('see https://bob:s3cret@example.com/x', 's3cret')
  })
})

describe('redactSecrets: secret looking assignments', () => {
  it('hides env style values whose name says secret, token, key or password', () => {
    for (const name of [
      'OPENAI_API_KEY',
      'GITHUB_TOKEN',
      'AWS_SECRET_ACCESS_KEY',
      'DB_PASSWORD',
      'SMTP_PASS',
      'CLIENT_SECRET',
    ]) {
      const value = random(24)
      expect(expectHidden(`export ${name}=${value}`, value)).toBe(
        `export ${name}=${HIDDEN_TEXT}`
      )
    }
  })

  it('handles quotes, colons and spaces around env values', () => {
    const value = random(30)
    expect(expectHidden(`API_KEY = "${value}"`, value)).toBe(`API_KEY = "${HIDDEN_TEXT}"`)
    expectHidden(`DATABASE_PASSWORD: '${value}'`, value)
  })

  it('hides quoted values in code and JSON', () => {
    const value = random(20)
    expect(expectHidden(`const apiKey = "${value}"`, value)).toBe(
      `const apiKey = "${HIDDEN_TEXT}"`
    )
    expect(expectHidden(`{"password": "${value}"}`, value)).toBe(
      `{"password": "${HIDDEN_TEXT}"}`
    )
    expectHidden(`client_secret: '${value}'`, value)
    expectHidden(`accessToken='${value}'`, value)
  })

  it('hides long unquoted values with digits in YAML style', () => {
    expectHidden('password: Winter2026Pass!', 'Winter2026Pass!')
  })

  it('counts every hidden value across one text', () => {
    const one = `sk-${random(40)}`
    const two = `ghp_${random(36)}`
    const result = redactSecrets(`first ${one}\nsecond ${two}\nthird ${one}`)
    expect(result.count).toBe(3)
    expect(result.text).toBe(`first ${HIDDEN_TEXT}\nsecond ${HIDDEN_TEXT}\nthird ${HIDDEN_TEXT}`)
  })

  it('counts a key inside an env line once', () => {
    const key = `sk-or-v1-${random(48)}`
    const result = redactSecrets(`OPENROUTER_API_KEY=${key}`)
    expect(result).toEqual({ text: `OPENROUTER_API_KEY=${HIDDEN_TEXT}`, count: 1 })
  })
})

describe('redactSecrets: leaves normal text alone', () => {
  it('keeps everyday prose', () => {
    expectUntouched(
      'The secret to good bread is time. Keep the key under the mat. Tokens are counted per message, and the password reset link expires in an hour.'
    )
    expectUntouched('Bearer tokens are sent in the Authorization header.')
    expectUntouched('My password: make it long. The secret: 42 is the answer.')
  })

  it('keeps short words that share a prefix with a key', () => {
    expectUntouched('Try sk-learn, ghp_ is a prefix, AKIA123 is short, xoxb- alone, AIza only.')
    expectUntouched('sk-the-quick-brown-fox-jumps-over')
    expectUntouched('risk-assessment-framework-for-teams-2026 and task-1234567890123456789012')
  })

  it('keeps code that reads secrets without holding them', () => {
    expectUntouched(
      [
        'const apiKey = process.env.OPENAI_API_KEY',
        'const token = env.GITHUB_TOKEN2',
        'API_KEY=${API_KEY}',
        'password = form.password.value',
        '"password": "{{PASSWORD}}"',
        'MAX_TOKENS=4096',
        'KEYBOARD_LAYOUT=us-international',
        '<li key="message-row-12345">',
        'function getToken() { return cache.token }',
        'const passwordHint = "use a long phrase"',
      ].join('\n')
    )
  })

  it('keeps plain links, ids and hashes', () => {
    expectUntouched(
      [
        'https://example.com/path?x=1',
        'http://localhost:3000/c/conv-123',
        'commit a94a8fe5ccb19ba61c4c0873d391e987982fbbd3',
        'id 3f2b8c1e-5d4a-4f6b-9c2d-1a2b3c4d5e6f',
        'email me at someone@example.com',
      ].join('\n')
    )
  })
})

describe('redactSecrets: long input', () => {
  it('stays fast on long and repetitive text', () => {
    const text = [
      'A_'.repeat(20_000),
      'password'.repeat(5_000),
      'sk-'.repeat(10_000),
      'eyJ'.repeat(10_000),
      `${'word '.repeat(50_000)}`,
    ].join('\n')
    const started = Date.now()
    redactSecrets(text)
    expect(Date.now() - started).toBeLessThan(2_000)
  })
})

describe('createRedactor', () => {
  it('adds up hidden values across calls', () => {
    const redactor = createRedactor()
    expect(redactor.redact('nothing here')).toBe('nothing here')
    expect(redactor.redact(`zq_${random(40)}`)).toBe(HIDDEN_TEXT)
    redactor.redact(`AKIA${upper(16)} and AKIA${upper(16)}`)
    expect(redactor.count).toBe(3)
  })
})
