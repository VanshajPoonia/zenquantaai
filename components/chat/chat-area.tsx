'use client'

import { useRef, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { MODE_CONFIGS } from '@/lib/types'
import { getModeAccentClass } from '@/lib/mode-utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatMessage } from './message'
import { EmptyState } from './empty-state'
import { Composer } from './composer'
import { ModeSwitcherCompact } from './mode-switcher'

// Simulated response for demo purposes
const MOCK_RESPONSES: Record<string, string[]> = {
  creative: [
    `That's a wonderful prompt! Let me craft something special for you...

Here's what I've created:

*The words flow like water through an ancient riverbed, carrying with them the sediment of a thousand untold stories...*

This piece explores themes of:
- **Transformation** - How change shapes our narratives
- **Memory** - The way stories live on beyond their telling
- **Connection** - The threads that bind us across time

Would you like me to expand on any particular aspect, or shall I take this in a different direction?`,
    `What a creative challenge! I love it.

Let me paint you a picture with words:

---

*In the space between heartbeats, she found entire universes waiting to be discovered. Each pulse a new beginning, each silence an ending written in starlight.*

---

The imagery here draws from:
1. **Cosmic metaphors** - Life as vast as the universe
2. **Intimate scale** - But focused on the personal
3. **Temporal fluidity** - Time bending to emotion

Shall I continue this thread or explore something new?`,
  ],
  logic: [
    `Let me break this down systematically:

## Analysis Framework

| Factor | Weight | Assessment |
|--------|--------|------------|
| Feasibility | High | Technically achievable |
| Impact | Medium | Moderate positive effect |
| Risk | Low | Minimal downsides |

### Key Considerations

1. **First Principle**: Start with the fundamental truth
2. **Second Principle**: Build incrementally from there
3. **Third Principle**: Validate at each step

### Recommendation

Based on the analysis above, I recommend **Option A** with the following confidence levels:
- Technical viability: 85%
- Business impact: 72%
- Implementation risk: 15%

Would you like me to dive deeper into any specific aspect?`,
    `Excellent question. Let me apply structured reasoning:

### Problem Decomposition

The core issue can be broken into three sub-problems:

**Sub-problem 1: Definition**
- What exactly are we trying to solve?
- What are the constraints?

**Sub-problem 2: Analysis**
- What data do we have?
- What patterns emerge?

**Sub-problem 3: Solution**
- What options exist?
- How do we evaluate them?

### Logical Flow

\`\`\`
Premise A + Premise B → Conclusion C
\`\`\`

Given the above framework, the most logical approach would be to prioritize based on impact-to-effort ratio.

Shall I elaborate on the methodology?`,
  ],
  code: [
    `Here's a clean implementation:

\`\`\`typescript
import { useState, useCallback } from 'react'

interface UseCounterOptions {
  initialValue?: number
  min?: number
  max?: number
  step?: number
}

export function useCounter(options: UseCounterOptions = {}) {
  const { 
    initialValue = 0, 
    min = -Infinity, 
    max = Infinity,
    step = 1 
  } = options
  
  const [count, setCount] = useState(initialValue)
  
  const increment = useCallback(() => {
    setCount(prev => Math.min(prev + step, max))
  }, [step, max])
  
  const decrement = useCallback(() => {
    setCount(prev => Math.max(prev - step, min))
  }, [step, min])
  
  const reset = useCallback(() => {
    setCount(initialValue)
  }, [initialValue])
  
  return { count, increment, decrement, reset }
}
\`\`\`

## Usage

\`\`\`tsx
const { count, increment, decrement, reset } = useCounter({
  initialValue: 0,
  min: 0,
  max: 100,
  step: 5
})
\`\`\`

This implementation includes:
- ✅ Type safety with TypeScript
- ✅ Configurable options
- ✅ Boundary constraints
- ✅ Memoized callbacks

Want me to add any additional features?`,
    `Great question! Here's an optimized solution:

\`\`\`python
from typing import List, Optional
from functools import lru_cache

class Solution:
    def solve(self, data: List[int]) -> int:
        """
        Time Complexity: O(n log n)
        Space Complexity: O(n)
        """
        if not data:
            return 0
        
        # Sort for optimal processing
        sorted_data = sorted(data)
        
        @lru_cache(maxsize=None)
        def dp(index: int, state: int) -> int:
            if index >= len(sorted_data):
                return 0
            
            # Skip current element
            skip = dp(index + 1, state)
            
            # Take current element
            take = sorted_data[index] + dp(index + 1, state | 1)
            
            return max(skip, take)
        
        return dp(0, 0)
\`\`\`

### Complexity Analysis

| Operation | Time | Space |
|-----------|------|-------|
| Sorting | O(n log n) | O(n) |
| DP | O(n * 2^k) | O(n * 2^k) |

Need me to explain any part in detail?`,
  ],
}

export function ChatArea() {
  const {
    currentMode,
    currentChat,
    addMessage,
    isStreaming,
    setIsStreaming,
  } = useChatContext()
  const [selectedPrompt, setSelectedPrompt] = useState('')
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentChat?.messages])

  const handleSendMessage = async (content: string) => {
    // Add user message
    addMessage(content, 'user')
    setSelectedPrompt('')

    // Simulate AI response
    setIsStreaming(true)

    // Random delay between 500ms and 1500ms
    await new Promise((resolve) =>
      setTimeout(resolve, 500 + Math.random() * 1000)
    )

    // Get random response for current mode
    const responses = MOCK_RESPONSES[currentMode]
    const randomResponse = responses[Math.floor(Math.random() * responses.length)]

    addMessage(randomResponse, 'assistant')
    setIsStreaming(false)
  }

  const handlePromptSelect = (prompt: string) => {
    setSelectedPrompt(prompt)
  }

  const handleRegenerate = () => {
    // In a real app, this would regenerate the last response
    console.log('Regenerate last response')
  }

  const showEmptyState = !currentChat || currentChat.messages.length === 0

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      {showEmptyState ? (
        <div className="flex-1 overflow-y-auto">
          <EmptyState onPromptSelect={handlePromptSelect} />
        </div>
      ) : (
        <ScrollArea ref={scrollAreaRef} className="flex-1">
          <div className="max-w-4xl mx-auto px-4 py-6">
            {/* Mode indicator at top */}
            <div className="flex justify-center mb-6">
              <ModeSwitcherCompact />
            </div>

            {/* Messages */}
            {currentChat?.messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                message={message}
                isLastAssistant={
                  message.role === 'assistant' &&
                  index === currentChat.messages.length - 1
                }
                onRegenerate={handleRegenerate}
              />
            ))}

            {/* Streaming indicator */}
            {isStreaming && (
              <div className={cn(
                "flex items-center gap-3 mb-6 pl-11",
                getModeAccentClass(currentMode, 'text')
              )}>
                <div className="flex gap-1">
                  <span
                    className="size-2 rounded-full bg-current animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="size-2 rounded-full bg-current animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="size-2 rounded-full bg-current animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
                <span className="text-sm font-medium">
                  {MODE_CONFIGS[currentMode].model} is thinking...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      )}

      {/* Composer */}
      <Composer
        onSend={handleSendMessage}
        disabled={isStreaming}
        initialValue={selectedPrompt}
      />
    </div>
  )
}
