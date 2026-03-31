export type AIMode = 'creative' | 'logic' | 'code'

export interface ModeConfig {
  id: AIMode
  name: string
  model: string
  description: string
  placeholder: string
  helperText: string
  emptyStateTitle: string
  emptyStateDescription: string
  suggestedPrompts: string[]
  accentColor: string
  icon: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  mode: AIMode
  isStreaming?: boolean
}

export interface Chat {
  id: string
  title: string
  mode: AIMode
  messages: Message[]
  createdAt: Date
  updatedAt: Date
  isPinned: boolean
}

export interface SessionSettings {
  temperature: number
  maxTokens: number
  webSearch: boolean
  memory: boolean
  fileContext: boolean
}

export interface APISettings {
  qwenApiKey: string
  deepseekApiKey: string
  qwenCoderApiKey: string
}

export const MODE_CONFIGS: Record<AIMode, ModeConfig> = {
  creative: {
    id: 'creative',
    name: 'Creative Writer',
    model: 'Qwen',
    description: 'Imaginative storytelling and creative content',
    placeholder: 'Tell me a story about...',
    helperText: 'Best for creative writing, storytelling, brainstorming, and artistic content',
    emptyStateTitle: 'Unleash Your Creativity',
    emptyStateDescription: 'Write stories, poems, scripts, and creative content with an AI that understands narrative flow and artistic expression.',
    suggestedPrompts: [
      'Write a short story about a time traveler who can only go forward',
      'Create a poem about the beauty of impermanence',
      'Help me brainstorm unique names for a fantasy world',
      'Write a compelling product description for a minimalist watch',
    ],
    accentColor: 'creative',
    icon: 'sparkles',
  },
  logic: {
    id: 'logic',
    name: 'Logic Focused',
    model: 'DeepSeek',
    description: 'Analytical thinking and problem solving',
    placeholder: 'Help me analyze...',
    helperText: 'Best for reasoning, analysis, math, research, and structured thinking',
    emptyStateTitle: 'Think Deeper',
    emptyStateDescription: 'Analyze complex problems, solve mathematical equations, and get well-reasoned answers backed by logical thinking.',
    suggestedPrompts: [
      'Explain the pros and cons of microservices vs monolithic architecture',
      'Help me create a decision matrix for choosing a tech stack',
      'Walk me through solving this differential equation',
      'Analyze the logical fallacies in this argument',
    ],
    accentColor: 'logic',
    icon: 'brain',
  },
  code: {
    id: 'code',
    name: 'Code Assistant',
    model: 'Qwen Coder',
    description: 'Expert programming and debugging help',
    placeholder: 'Help me code...',
    helperText: 'Best for writing code, debugging, code review, and technical documentation',
    emptyStateTitle: 'Code Smarter',
    emptyStateDescription: 'Get help writing clean code, debugging issues, understanding complex codebases, and learning new programming concepts.',
    suggestedPrompts: [
      'Help me write a React hook for infinite scrolling',
      'Debug this TypeScript error and explain the issue',
      'Convert this Python function to Rust with proper error handling',
      'Review this code for security vulnerabilities',
    ],
    accentColor: 'code',
    icon: 'code',
  },
}
