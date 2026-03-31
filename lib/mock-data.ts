import { Chat, Message, AIMode } from './types'

const createMessage = (
  role: 'user' | 'assistant',
  content: string,
  mode: AIMode,
  hoursAgo: number
): Message => ({
  id: Math.random().toString(36).substring(7),
  role,
  content,
  timestamp: new Date(Date.now() - hoursAgo * 60 * 60 * 1000),
  mode,
})

export const MOCK_CHATS: Chat[] = [
  // Creative Mode Chats
  {
    id: 'creative-1',
    title: 'Sci-Fi Story: The Last Signal',
    mode: 'creative',
    isPinned: true,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    messages: [
      createMessage(
        'user',
        'Write a short sci-fi story about humanity receiving a signal from deep space',
        'creative',
        2
      ),
      createMessage(
        'assistant',
        `# The Last Signal

The message arrived on a Tuesday, unremarkable except for what it carried across 4.2 billion light-years.

Dr. Elena Vasquez was the first to see it—a pattern so clearly artificial that her coffee went cold in her hands. The signal wasn't just noise. It was mathematics. Prime numbers, then geometry, then something that looked terrifyingly like a warning.

"They're not saying hello," she whispered to her colleague, Marcus, who had rushed in after her frantic call. "They're saying goodbye."

The translation took three weeks. Three weeks of sleepless nights, of governments demanding answers, of the world holding its breath.

*We were like you once. Curious. Reaching. We found what lies between the stars. It found us too. By the time you receive this, we will be gone. Perhaps you will be wiser. Perhaps you will be luckier.*

*Do not answer. Do not reach. Stay hidden in your small blue world.*

*This is not first contact. This is a warning.*

Elena stared at the final line, then slowly reached for the radio telescope controls. The message humanity had been preparing to send back glowed on her screen, cursor blinking.

She deleted it.

Some silences, she realized, were worth keeping.

---

*The stars watched, ancient and cold, as one small world chose wisdom over wonder, survival over curiosity. And somewhere in the vast dark between galaxies, something that had been listening... moved on.*`,
        'creative',
        1
      ),
    ],
  },
  {
    id: 'creative-2',
    title: 'Brand Voice Guidelines',
    mode: 'creative',
    isPinned: false,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    messages: [
      createMessage(
        'user',
        'Help me develop a brand voice for a premium sustainable fashion startup called "Verdant"',
        'creative',
        96
      ),
      createMessage(
        'assistant',
        `# Verdant Brand Voice Guidelines

## Core Voice Attributes

### 1. **Thoughtfully Confident**
Verdant speaks with quiet authority—not loud, not preachy. We know our craft and trust our customers to appreciate quality without being sold to.

*Instead of:* "We're the BEST sustainable brand!"  
*Write:* "Quality that speaks for itself. Impact that matters."

### 2. **Warmly Sophisticated**
Luxury with heart. We're premium without being pretentious, elegant without being cold.

*Tone words:* Refined, inviting, genuine, considered

### 3. **Future-Optimistic**
Sustainability isn't sacrifice—it's evolution. We focus on what we're building, not what we're against.

*Instead of:* "Stop fast fashion destruction"  
*Write:* "Designed for decades, not seasons"

## Voice in Practice

**Headlines:** Short, evocative, memorable
- "Wear Your Values"
- "The Art of Less"
- "Made to Last. Made to Love."

**Product Descriptions:** Sensory, specific, story-rich
- Highlight the craft, the material origin, the maker's intention
- Connect garment to moment: "For the morning meeting and the evening wander"

**Social Media:** Conversational warmth, curated beauty
- Share the process, not just the product
- Celebrate customer stories authentically

## Words We Love
Craft • Intention • Heritage • Evolution • Considered • Enduring • Quiet luxury

## Words We Avoid  
Eco-warrior • Green • Revolutionary • Disrupt • Guilt • Should`,
        'creative',
        95
      ),
    ],
  },

  // Logic Mode Chats
  {
    id: 'logic-1',
    title: 'System Architecture Decision',
    mode: 'logic',
    isPinned: true,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    messages: [
      createMessage(
        'user',
        'I need to choose between PostgreSQL and MongoDB for a new SaaS application. The app will handle user management, subscription billing, and real-time collaboration features. Help me analyze the decision.',
        'logic',
        3
      ),
      createMessage(
        'assistant',
        `# Database Selection Analysis: PostgreSQL vs MongoDB

## Decision Framework

Let me analyze this systematically based on your three core requirements.

### 1. User Management

| Factor | PostgreSQL | MongoDB |
|--------|------------|---------|
| Data Structure | Highly structured (users, roles, permissions) | Flexible but overhead for relations |
| ACID Compliance | ✅ Full support | ⚠️ Limited to document level |
| Query Patterns | Complex joins efficient | Denormalization required |

**Winner: PostgreSQL** — User data is inherently relational (users → roles → permissions → teams).

### 2. Subscription Billing

| Factor | PostgreSQL | MongoDB |
|--------|------------|---------|
| Transaction Safety | ✅ Strong guarantees | ⚠️ Multi-doc transactions newer |
| Financial Data Integrity | Battle-tested | Requires careful design |
| Audit Trail | Excellent with triggers | Manual implementation |

**Winner: PostgreSQL** — Financial data demands ACID guarantees and auditability.

### 3. Real-time Collaboration

| Factor | PostgreSQL | MongoDB |
|--------|------------|---------|
| Schema Flexibility | Requires migrations | ✅ Schema-less documents |
| Document Storage | JSONB support (good) | ✅ Native (excellent) |
| Change Streams | ✅ LISTEN/NOTIFY | ✅ Native Change Streams |

**Tie** — Both can handle this well with proper architecture.

## Recommendation: PostgreSQL

### Reasoning:
1. **2 of 3 requirements favor PostgreSQL** strongly
2. **JSONB columns** give you MongoDB-like flexibility where needed
3. **Ecosystem maturity** for SaaS (Stripe integration, auth libraries)
4. **Operational simplicity** — one database to manage

### Architecture Pattern:
\`\`\`
┌─────────────────────────────────────────┐
│              PostgreSQL                  │
├──────────────┬──────────────┬───────────┤
│ Users/Auth   │ Billing      │ Collab    │
│ (Relational) │ (Relational) │ (JSONB)   │
└──────────────┴──────────────┴───────────┘
\`\`\`

### Risk Mitigation:
- Use **JSONB** for collaboration documents (flexible schema)
- Implement **connection pooling** (PgBouncer) for scale
- Consider **read replicas** for real-time query load

**Confidence Level: 85%** — The 15% uncertainty accounts for extreme scale scenarios where MongoDB's horizontal scaling might become relevant (>10M active users).`,
        'logic',
        2
      ),
    ],
  },
  {
    id: 'logic-2',
    title: 'Startup Funding Analysis',
    mode: 'logic',
    isPinned: false,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    messages: [
      createMessage(
        'user',
        'Should I bootstrap or raise VC funding for my B2B SaaS? We have $50k MRR and growing 15% month over month.',
        'logic',
        150
      ),
      createMessage(
        'assistant',
        `# Funding Path Analysis

## Current State Assessment

| Metric | Value | Implication |
|--------|-------|-------------|
| MRR | $50,000 | Solid traction, VC-backable |
| Growth | 15% MoM | ~5x annual (excellent) |
| Annual Run Rate | $600,000 | Approaching Series A territory |

## Option Analysis

### Path A: Continue Bootstrapping

**Pros:**
- Retain 100% equity
- No board oversight or investor pressure
- Profitable growth = sustainable
- At 15% MoM, you'll hit $200k MRR in 12 months organically

**Cons:**
- Slower market capture
- Vulnerability to funded competitors
- Limited war chest for talent acquisition

**Probability of Success: 70%** (assuming market isn't winner-take-all)

### Path B: Raise Venture Capital

**Pros:**
- Accelerate growth in competitive market
- Hire ahead of revenue
- Strategic value from right investors

**Cons:**
- Dilution (typically 15-25% at Seed/Series A)
- Pressure for 3-5x growth trajectory
- Less optionality (IPO/large exit expected)

**Probability of Success: 50%** (VC success rates for funded companies)

## Decision Matrix

| Factor | Weight | Bootstrap | VC |
|--------|--------|-----------|-----|
| Market Timing Pressure | 3 | ⭐⭐ | ⭐⭐⭐⭐ |
| Personal Wealth Outcome | 4 | ⭐⭐⭐⭐ | ⭐⭐ |
| Company Survival | 5 | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Maximum Scale Potential | 2 | ⭐⭐ | ⭐⭐⭐⭐⭐ |

## Recommendation

**Bootstrap for 6-12 more months, then reassess.**

### Rationale:
1. Your growth rate is already exceptional
2. $50k MRR → $150k MRR bootstrapped = much better negotiating position
3. You can always raise later; you can't un-dilute

### The Exception:
Raise NOW if:
- A well-funded competitor just emerged
- You've identified a talent hire that would be transformational
- Market window is clearly closing`,
        'logic',
        148
      ),
    ],
  },

  // Code Mode Chats
  {
    id: 'code-1',
    title: 'React Authentication Hook',
    mode: 'code',
    isPinned: true,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000),
    messages: [
      createMessage(
        'user',
        'Help me create a custom React hook for handling authentication with JWT tokens, including refresh token logic',
        'code',
        1
      ),
      createMessage(
        'assistant',
        `Here's a comprehensive authentication hook with JWT handling and automatic token refresh:

\`\`\`typescript
// hooks/useAuth.ts
import { useState, useEffect, useCallback, useRef } from 'react'

interface User {
  id: string
  email: string
  name: string
}

interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

interface LoginCredentials {
  email: string
  password: string
}

const TOKEN_STORAGE_KEY = 'auth_tokens'
const REFRESH_THRESHOLD = 5 * 60 * 1000 // 5 minutes before expiry

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  })
  
  const refreshTimeoutRef = useRef<NodeJS.Timeout>()

  // Get tokens from storage
  const getStoredTokens = useCallback((): AuthTokens | null => {
    if (typeof window === 'undefined') return null
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  }, [])

  // Store tokens
  const storeTokens = useCallback((tokens: AuthTokens) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens))
  }, [])

  // Clear tokens
  const clearTokens = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  }, [])

  // Decode JWT payload (without verification - server validates)
  const decodeToken = useCallback((token: string): User | null => {
    try {
      const payload = token.split('.')[1]
      const decoded = JSON.parse(atob(payload))
      return {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
      }
    } catch {
      return null
    }
  }, [])

  // Refresh the access token
  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    const tokens = getStoredTokens()
    if (!tokens?.refreshToken) return false

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      })

      if (!response.ok) throw new Error('Refresh failed')

      const newTokens: AuthTokens = await response.json()
      storeTokens(newTokens)
      
      const user = decodeToken(newTokens.accessToken)
      setState(prev => ({ ...prev, user, isAuthenticated: true }))
      
      scheduleRefresh(newTokens.expiresAt)
      return true
    } catch {
      logout()
      return false
    }
  }, [getStoredTokens, storeTokens, decodeToken])

  // Schedule token refresh
  const scheduleRefresh = useCallback((expiresAt: number) => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
    }

    const timeUntilRefresh = expiresAt - Date.now() - REFRESH_THRESHOLD
    
    if (timeUntilRefresh > 0) {
      refreshTimeoutRef.current = setTimeout(() => {
        refreshAccessToken()
      }, timeUntilRefresh)
    }
  }, [refreshAccessToken])

  // Login
  const login = useCallback(async (credentials: LoginCredentials) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Login failed')
      }

      const tokens: AuthTokens = await response.json()
      storeTokens(tokens)

      const user = decodeToken(tokens.accessToken)
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })

      scheduleRefresh(tokens.expiresAt)
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Login failed',
      }))
    }
  }, [storeTokens, decodeToken, scheduleRefresh])

  // Logout
  const logout = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
    }
    clearTokens()
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })
  }, [clearTokens])

  // Get current access token (for API calls)
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const tokens = getStoredTokens()
    if (!tokens) return null

    // If token is close to expiry, refresh first
    if (tokens.expiresAt - Date.now() < REFRESH_THRESHOLD) {
      const success = await refreshAccessToken()
      if (!success) return null
      return getStoredTokens()?.accessToken ?? null
    }

    return tokens.accessToken
  }, [getStoredTokens, refreshAccessToken])

  // Initialize auth state on mount
  useEffect(() => {
    const tokens = getStoredTokens()
    
    if (tokens && tokens.expiresAt > Date.now()) {
      const user = decodeToken(tokens.accessToken)
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })
      scheduleRefresh(tokens.expiresAt)
    } else {
      clearTokens()
      setState(prev => ({ ...prev, isLoading: false }))
    }

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [getStoredTokens, decodeToken, scheduleRefresh, clearTokens])

  return {
    ...state,
    login,
    logout,
    getAccessToken,
    refreshAccessToken,
  }
}
\`\`\`

## Usage Example

\`\`\`tsx
function LoginForm() {
  const { login, isLoading, error } = useAuth()
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await login({ email, password })
  }
  
  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="text-red-500">{error}</p>}
      {/* form fields */}
      <button disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}
\`\`\`

## Key Features

1. **Automatic token refresh** - Schedules refresh before expiry
2. **Persistent sessions** - Tokens stored in localStorage
3. **Type-safe** - Full TypeScript support
4. **Clean API** - Simple login/logout interface
5. **Error handling** - Graceful error states`,
        'code',
        0.5
      ),
    ],
  },
  {
    id: 'code-2',
    title: 'TypeScript Utility Types',
    mode: 'code',
    isPinned: false,
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    messages: [
      createMessage(
        'user',
        'Explain the difference between Pick, Omit, and Partial in TypeScript with practical examples',
        'code',
        72
      ),
      createMessage(
        'assistant',
        `# TypeScript Utility Types Deep Dive

Let me explain these with a practical example using a User type:

\`\`\`typescript
interface User {
  id: string
  email: string
  name: string
  avatar: string
  role: 'admin' | 'user'
  createdAt: Date
}
\`\`\`

## Pick<Type, Keys>

**Extracts only the specified keys** from a type.

\`\`\`typescript
// Only these fields for public display
type PublicUser = Pick<User, 'id' | 'name' | 'avatar'>

// Result:
// {
//   id: string
//   name: string
//   avatar: string
// }

// Use case: API responses with limited data
function getPublicProfile(userId: string): Promise<PublicUser> {
  // Only returns id, name, avatar
}
\`\`\`

## Omit<Type, Keys>

**Removes the specified keys** from a type.

\`\`\`typescript
// Everything except sensitive/auto-generated fields
type CreateUserInput = Omit<User, 'id' | 'createdAt'>

// Result:
// {
//   email: string
//   name: string
//   avatar: string
//   role: 'admin' | 'user'
// }

// Use case: Form inputs where some fields are auto-generated
function createUser(input: CreateUserInput): Promise<User> {
  // Server generates id and createdAt
}
\`\`\`

## Partial<Type>

**Makes all properties optional.**

\`\`\`typescript
type UpdateUserInput = Partial<User>

// Result:
// {
//   id?: string
//   email?: string
//   name?: string
//   avatar?: string
//   role?: 'admin' | 'user'
//   createdAt?: Date
// }

// Use case: PATCH requests where any field can be updated
function updateUser(id: string, updates: Partial<User>): Promise<User> {
  // Can update any subset of fields
}

// Valid calls:
updateUser('123', { name: 'New Name' })
updateUser('123', { email: 'new@email.com', avatar: 'new.jpg' })
\`\`\`

## Combining Them (Power Move 💪)

\`\`\`typescript
// Partial updates, but only for allowed fields
type UserProfileUpdate = Partial<Pick<User, 'name' | 'avatar'>>

// Result:
// {
//   name?: string
//   avatar?: string
// }

// Omit id, then make rest optional
type FlexibleUserInput = Partial<Omit<User, 'id'>>
\`\`\`

## Quick Reference

| Utility | Effect | When to Use |
|---------|--------|-------------|
| \`Pick\` | Keep only listed keys | Limited API responses |
| \`Omit\` | Remove listed keys | Hide sensitive/auto fields |
| \`Partial\` | Make all optional | Update/patch operations |
| \`Required\` | Make all required | Enforce complete objects |`,
        'code',
        71
      ),
    ],
  },
]

export const getChatsForMode = (mode: AIMode): Chat[] => {
  return MOCK_CHATS.filter(chat => chat.mode === mode)
}

export const getPinnedChats = (): Chat[] => {
  return MOCK_CHATS.filter(chat => chat.isPinned)
}

export const getRecentChats = (): Chat[] => {
  return [...MOCK_CHATS]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 10)
}
