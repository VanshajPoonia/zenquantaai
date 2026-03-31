import { createSessionSettings } from '@/lib/config'
import { createConversation, createMessage, updateConversationSnapshot } from '@/lib/utils/chat'
import { Conversation } from '@/types'

const hoursAgo = (value: number) =>
  new Date(Date.now() - value * 60 * 60 * 1000).toISOString()

function seedConversation(conversation: Conversation): Conversation {
  return updateConversationSnapshot(conversation, {
    updatedAt: conversation.updatedAt,
  })
}

export const SEEDED_CONVERSATIONS: Conversation[] = [
  seedConversation(
    createConversation({
      mode: 'general',
      title: 'Kyoto trip plan',
      sessionSettings: createSessionSettings('general'),
      createdAt: hoursAgo(18),
      updatedAt: hoursAgo(3),
      isPinned: false,
      messages: [
        createMessage({
          role: 'user',
          content:
            'Plan a relaxed 3-day Kyoto itinerary with great food, neighborhood walks, and a mix of famous and quieter spots.',
          mode: 'general',
          createdAt: hoursAgo(4),
        }),
        createMessage({
          role: 'assistant',
          content: `# 3-Day Kyoto Plan

## Day 1: Ease Into Higashiyama
- Start early at Kiyomizu-dera before the busiest hours.
- Walk down Sannenzaka and Ninenzaka with coffee and light shopping.
- Have lunch around Gion, then spend the afternoon in Maruyama Park and Yasaka Shrine.
- Finish with a calm evening meal in Pontocho.

## Day 2: Arashiyama Without Rushing
- Visit the bamboo grove early, then cross to Tenryu-ji.
- Slow down with a riverside walk and lunch nearby.
- In the afternoon, choose either Okochi Sanso Garden or a scenic train ride for a quieter finish.

## Day 3: Markets, Temples, and Neighborhood Time
- Start at Nishiki Market for casual bites.
- Head to Nanzen-ji and the Philosopher's Path for a slower stretch.
- Keep the evening flexible for a final dinner in your favorite area.

If you want, I can turn this into a map-friendly schedule with train tips and restaurant picks next.`,
          mode: 'general',
          model: 'openai/gpt-4.1-mini',
          provider: 'openrouter',
          createdAt: hoursAgo(3),
        }),
      ],
    })
  ),
  seedConversation(
    createConversation({
      mode: 'creative',
      title: 'Brand campaign for a premium journaling app',
      sessionSettings: createSessionSettings('creative'),
      createdAt: hoursAgo(48),
      updatedAt: hoursAgo(2),
      isPinned: true,
      messages: [
        createMessage({
          role: 'user',
          content:
            'Help me write launch messaging for a premium journaling app for ambitious solo founders. I want it to feel elegant, introspective, and quietly confident.',
          mode: 'creative',
          createdAt: hoursAgo(3),
        }),
        createMessage({
          role: 'assistant',
          content: `# Launch Direction: Zenquanta Journal

## Brand Angle
Position the product as a private thinking environment for people building meaningful things, not as another productivity gadget.

## Messaging Pillars

### 1. Clarity, not noise
The journal becomes the place where scattered thoughts turn into direction.

### 2. Ambition with calm
Speak to founders who want momentum without chaos, discipline without burnout.

### 3. Private craftsmanship
Frame the product like a beautifully built tool for inner work.

## Sample Hero Copy

**Think clearly. Build deliberately.**

Zenquanta Journal is a premium space for founders who want better decisions, sharper reflection, and a calmer relationship with ambition.

## Supporting Copy

Capture the thoughts behind the work. Revisit the patterns behind the decisions. Build a ritual that helps you move with more intention.

## Tone Notes
- Minimal, measured, and emotionally intelligent
- Avoid hype language and hustle clichés
- Favor confidence over urgency

If you want, I can turn this into a landing page hero, email sequence, or App Store copy next.`,
          mode: 'creative',
          model: 'google/gemini-2.5-flash',
          provider: 'openrouter',
          createdAt: hoursAgo(2),
        }),
      ],
    })
  ),
  seedConversation(
    createConversation({
      mode: 'logic',
      title: 'Pricing strategy comparison',
      sessionSettings: createSessionSettings('logic'),
      createdAt: hoursAgo(96),
      updatedAt: hoursAgo(5),
      isPinned: false,
      messages: [
        createMessage({
          role: 'user',
          content:
            'Compare usage-based pricing and seat-based pricing for an AI SaaS product that serves both small teams and agencies.',
          mode: 'logic',
          createdAt: hoursAgo(6),
        }),
        createMessage({
          role: 'assistant',
          content: `# Pricing Strategy Analysis

## Fast Take
For an AI product serving both small teams and agencies, a hybrid model is usually strongest: seat-based pricing for access and collaboration, plus usage-based pricing for expensive AI consumption.

## Why Seat-Based Helps
- Easier to understand during initial evaluation
- Fits team expansion and role-based access
- Supports predictable monthly revenue

## Why Usage-Based Helps
- Protects margins when model costs vary significantly
- Aligns price with value for heavy users
- Makes agency overages easier to monetize

## Risks
- Pure seat-based pricing can undercharge power users
- Pure usage pricing can create buyer anxiety and reduce adoption

## Recommendation
Use seats for platform access, then layer credits or usage thresholds for advanced model activity. That gives you:

1. Predictability for buyers
2. Margin protection for you
3. A clearer upgrade path for agencies

## Decision Rule
If your AI costs are low and stable, lean more seat-based.
If your AI costs spike with real usage, keep usage clearly visible in the pricing model.`,
          mode: 'logic',
          model: 'deepseek/deepseek-chat-v3.1',
          provider: 'openrouter',
          createdAt: hoursAgo(5),
        }),
      ],
    })
  ),
  seedConversation(
    createConversation({
      mode: 'code',
      title: 'Streaming chat API architecture',
      sessionSettings: createSessionSettings('code'),
      createdAt: hoursAgo(24),
      updatedAt: hoursAgo(1),
      isPinned: true,
      messages: [
        createMessage({
          role: 'user',
          content:
            'Sketch a clean architecture for a streaming chat API in Next.js with one OpenRouter gateway and a storage layer.',
          mode: 'code',
          createdAt: hoursAgo(2),
        }),
        createMessage({
          role: 'assistant',
          content: `# Suggested Architecture

\`\`\`ts
app/api/chat/route.ts
lib/ai/openrouter.ts
lib/ai/chat.ts
lib/storage/*.ts
types/index.ts
\`\`\`

## Layering

### 1. Route handler
- validates request
- resolves conversation and settings
- emits NDJSON stream events

### 2. AI router
- maps Zenquanta mode to OpenRouter model config
- injects the correct system prompt

### 3. Gateway client
- sends every model call through one OpenRouter integration
- keeps the route logic consistent even when models differ

### 4. Storage
- conversation store
- settings store
- easy to replace later with a database

## Practical Advice
- Keep UI state separate from persistence concerns
- Persist the user turn immediately before generation starts
- Store the assistant message only after the stream completes
- Use a single event format across modes so the frontend stays simple

If you want, I can turn this into concrete TypeScript interfaces and route contracts next.`,
          mode: 'code',
          model: 'qwen/qwen3-coder',
          provider: 'openrouter',
          createdAt: hoursAgo(1),
        }),
      ],
    })
  ),
]
