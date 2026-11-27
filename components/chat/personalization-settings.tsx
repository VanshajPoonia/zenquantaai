'use client'

import { useId } from 'react'
import {
  ABOUT_YOU_MAX_CHARS,
  RESPONSE_INSTRUCTIONS_MAX_CHARS,
} from '@/lib/ai/user-instructions'
import { cn } from '@/lib/utils'
import type { AppSettings } from '@/types'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

type PersonalizationValue = Pick<
  AppSettings,
  'aboutYou' | 'responseInstructions' | 'useCustomInstructions'
>

function InstructionField({
  label,
  hint,
  placeholder,
  value,
  max,
  onChange,
}: {
  label: string
  hint: string
  placeholder: string
  value: string
  max: number
  onChange: (value: string) => void
}) {
  const id = useId()
  const counterId = `${id}-count`
  const nearLimit = value.length > max * 0.9

  return (
    <div className="space-y-2 border-b border-border/60 py-4 last:border-b-0">
      <div>
        <Label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </Label>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>
      </div>
      <Textarea
        id={id}
        value={value}
        maxLength={max}
        rows={4}
        placeholder={placeholder}
        aria-describedby={counterId}
        className="max-h-60 min-h-24 rounded-xl text-sm"
        onChange={(event) => onChange(event.target.value)}
      />
      <p
        id={counterId}
        className={cn(
          'text-right text-xs tabular-nums text-muted-foreground',
          nearLimit && 'text-amber-200'
        )}
      >
        {value.length.toLocaleString('en-US')} / {max.toLocaleString('en-US')}
      </p>
    </div>
  )
}

export function PersonalizationSettings({
  value,
  onChange,
}: {
  value: PersonalizationValue
  onChange: (patch: Partial<PersonalizationValue>) => void
}) {
  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-border/60 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <Label htmlFor="use-custom-instructions" className="text-sm font-medium text-foreground">
            Use these instructions
          </Label>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Turn this off to pause them without deleting them.
          </p>
        </div>
        <Switch
          id="use-custom-instructions"
          checked={value.useCustomInstructions}
          onCheckedChange={(useCustomInstructions) => onChange({ useCustomInstructions })}
        />
      </div>
      <div className={cn(!value.useCustomInstructions && 'opacity-60')}>
        <InstructionField
          label="About you"
          hint="Who you are, what you do and anything assistants should keep in mind."
          placeholder="For example: I run a small bakery in Pune. I'm learning Python."
          value={value.aboutYou}
          max={ABOUT_YOU_MAX_CHARS}
          onChange={(aboutYou) => onChange({ aboutYou })}
        />
        <InstructionField
          label="How should Zenquanta answer?"
          hint="Length, tone, format or anything to avoid."
          placeholder="For example: Keep answers short. Use simple words and metric units."
          value={value.responseInstructions}
          max={RESPONSE_INSTRUCTIONS_MAX_CHARS}
          onChange={(responseInstructions) => onChange({ responseInstructions })}
        />
      </div>
      <p className="mt-3 rounded-xl border border-border/70 bg-card/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
        Every assistant reads this. Don&apos;t put passwords here. Prism images and terminal
        sessions do not use it. Each project can add its own instructions on its home page.
      </p>
    </div>
  )
}
