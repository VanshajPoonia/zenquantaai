'use client'

import { useState } from 'react'
import { useChatContext } from '@/lib/chat-context'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SparklesIcon, BrainIcon, CodeIcon, CheckIcon } from '@/components/icons'

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { apiSettings, updateApiSettings } = useChatContext()
  const [localSettings, setLocalSettings] = useState(apiSettings)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    updateApiSettings(localSettings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Settings</DialogTitle>
          <DialogDescription>
            Configure your API keys and preferences for Zenquanta AI.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="api" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="api">API Keys</TabsTrigger>
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          {/* API Keys Tab */}
          <TabsContent value="api" className="space-y-6 mt-6">
            <div className="space-y-4">
              {/* Qwen API Key */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-creative/10">
                    <SparklesIcon className="size-4 text-creative" />
                  </div>
                  <Label htmlFor="qwenApiKey" className="font-medium">
                    Qwen API Key
                  </Label>
                  <Badge variant="secondary" className="text-xs">
                    Creative Writer
                  </Badge>
                </div>
                <Input
                  id="qwenApiKey"
                  type="password"
                  placeholder="sk-..."
                  value={localSettings.qwenApiKey}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      qwenApiKey: e.target.value,
                    }))
                  }
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a
                    href="https://dashscope.console.aliyun.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-creative hover:underline"
                  >
                    DashScope Console
                  </a>
                </p>
              </div>

              <Separator />

              {/* DeepSeek API Key */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-logic/10">
                    <BrainIcon className="size-4 text-logic" />
                  </div>
                  <Label htmlFor="deepseekApiKey" className="font-medium">
                    DeepSeek API Key
                  </Label>
                  <Badge variant="secondary" className="text-xs">
                    Logic Focused
                  </Badge>
                </div>
                <Input
                  id="deepseekApiKey"
                  type="password"
                  placeholder="sk-..."
                  value={localSettings.deepseekApiKey}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      deepseekApiKey: e.target.value,
                    }))
                  }
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a
                    href="https://platform.deepseek.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-logic hover:underline"
                  >
                    DeepSeek Platform
                  </a>
                </p>
              </div>

              <Separator />

              {/* Qwen Coder API Key */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-code/10">
                    <CodeIcon className="size-4 text-code" />
                  </div>
                  <Label htmlFor="qwenCoderApiKey" className="font-medium">
                    Qwen Coder API Key
                  </Label>
                  <Badge variant="secondary" className="text-xs">
                    Code Assistant
                  </Badge>
                </div>
                <Input
                  id="qwenCoderApiKey"
                  type="password"
                  placeholder="sk-..."
                  value={localSettings.qwenCoderApiKey}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      qwenCoderApiKey: e.target.value,
                    }))
                  }
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a
                    href="https://dashscope.console.aliyun.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-code hover:underline"
                  >
                    DashScope Console
                  </a>
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} className="gap-2">
                {saved ? (
                  <>
                    <CheckIcon className="size-4" />
                    Saved
                  </>
                ) : (
                  'Save API Keys'
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Models Tab */}
          <TabsContent value="models" className="space-y-4 mt-6">
            <div className="grid gap-4">
              {/* Creative Writer */}
              <div className="p-4 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-creative/10">
                    <SparklesIcon className="size-5 text-creative" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Creative Writer</h3>
                    <p className="text-sm text-muted-foreground">
                      Qwen-Max / Qwen-Plus
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Optimized for creative writing, storytelling, brainstorming,
                  and artistic content generation. Excels at narrative flow and
                  emotional expression.
                </p>
              </div>

              {/* Logic Focused */}
              <div className="p-4 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-logic/10">
                    <BrainIcon className="size-5 text-logic" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Logic Focused</h3>
                    <p className="text-sm text-muted-foreground">
                      DeepSeek-V3 / DeepSeek-R1
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Designed for analytical thinking, mathematical reasoning,
                  problem solving, and structured analysis. Shows step-by-step
                  reasoning.
                </p>
              </div>

              {/* Code Assistant */}
              <div className="p-4 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-code/10">
                    <CodeIcon className="size-5 text-code" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Code Assistant</h3>
                    <p className="text-sm text-muted-foreground">
                      Qwen-Coder-Plus / Qwen-Coder-Turbo
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Specialized for code generation, debugging, code review, and
                  technical documentation. Supports 100+ programming languages.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about" className="space-y-4 mt-6">
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-2 mb-4">
                <div className="size-12 rounded-xl bg-gradient-to-br from-creative via-logic to-code flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">Z</span>
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Zenquanta AI</h2>
              <p className="text-muted-foreground mb-4">Version 1.0.0</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                A premium 3-model AI chat system combining the best of creative
                writing, logical reasoning, and code assistance in one unified
                interface.
              </p>
            </div>
            <Separator />
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <p className="text-2xl font-bold text-foreground">3</p>
                <p className="text-muted-foreground">AI Models</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">∞</p>
                <p className="text-muted-foreground">Possibilities</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">0</p>
                <p className="text-muted-foreground">Limits</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
