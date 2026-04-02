'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { PLAN_CONFIGS } from '@/lib/config'
import { SubscriptionTier } from '@/types'

type FieldName =
  | 'coreTokensIncluded'
  | 'tierTokensIncluded'
  | 'imageCreditsIncluded'
  | 'dailyMessageLimit'
  | 'maxImagesPerDay'
  | 'maxInputTokensPerRequest'
  | 'maxOutputTokensPerRequest'

type FieldValues = Record<FieldName, string>

const PLAN_TIERS: SubscriptionTier[] = ['free', 'basic', 'pro', 'ultra', 'prime']

function getPlanFieldValues(tier: SubscriptionTier): FieldValues {
  const plan = PLAN_CONFIGS[tier]

  return {
    coreTokensIncluded: String(plan.coreTokens),
    tierTokensIncluded: String(plan.tierTokens),
    imageCreditsIncluded: String(plan.imageCredits),
    dailyMessageLimit: String(plan.dailyMessageLimit),
    maxImagesPerDay: String(plan.maxImagesPerDay),
    maxInputTokensPerRequest: String(plan.maxInputTokensPerRequest),
    maxOutputTokensPerRequest: String(plan.maxOutputTokensPerRequest),
  }
}

function createInitialValues(input: {
  coreTokensIncluded: number
  tierTokensIncluded: number
  imageCreditsIncluded: number
  dailyMessageLimit: number
  maxImagesPerDay: number
  maxInputTokensPerRequest?: number
  maxOutputTokensPerRequest?: number
}): FieldValues {
  return {
    coreTokensIncluded: String(input.coreTokensIncluded),
    tierTokensIncluded: String(input.tierTokensIncluded),
    imageCreditsIncluded: String(input.imageCreditsIncluded),
    dailyMessageLimit: String(input.dailyMessageLimit),
    maxImagesPerDay: String(input.maxImagesPerDay),
    maxInputTokensPerRequest: String(input.maxInputTokensPerRequest ?? ''),
    maxOutputTokensPerRequest: String(input.maxOutputTokensPerRequest ?? ''),
  }
}

function TierSelect({
  value,
  onChange,
  className,
}: {
  value: SubscriptionTier
  onChange: (value: SubscriptionTier) => void
  className: string
}) {
  return (
    <select
      name="tier"
      value={value}
      onChange={(event) => onChange(event.target.value as SubscriptionTier)}
      className={className}
    >
      {PLAN_TIERS.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}

function LimitInput({
  name,
  value,
  onChange,
  className,
}: {
  name: FieldName
  value: string
  onChange: (name: FieldName, value: string) => void
  className: string
}) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      name={name}
      value={value}
      onChange={(event) => onChange(name, event.target.value)}
      className={className}
    />
  )
}

export function CompactPlanLimitFields({
  initialTier,
  initialStatus,
  initialRole,
  initialValues,
}: {
  initialTier: SubscriptionTier
  initialStatus: 'active' | 'paused' | 'cancelled'
  initialRole: 'user' | 'admin'
  initialValues: {
    coreTokensIncluded: number
    tierTokensIncluded: number
    imageCreditsIncluded: number
    dailyMessageLimit: number
    maxImagesPerDay: number
  }
}) {
  const [tier, setTier] = useState<SubscriptionTier>(initialTier)
  const [values, setValues] = useState<FieldValues>(() =>
    createInitialValues(initialValues)
  )

  const handleTierChange = (nextTier: SubscriptionTier) => {
    setTier(nextTier)
    setValues((current) => ({
      ...current,
      ...getPlanFieldValues(nextTier),
    }))
  }

  const handleFieldChange = (name: FieldName, value: string) => {
    setValues((current) => ({ ...current, [name]: value }))
  }

  const inputClassName =
    'h-10 rounded-xl border-border/60 bg-background/50 text-sm'
  const selectClassName =
    'flex h-10 w-full rounded-xl border border-border/60 bg-background/50 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/40 focus:ring-2 focus:ring-primary/20'

  return (
    <>
      <TierSelect value={tier} onChange={handleTierChange} className={selectClassName} />
      <select name="status" defaultValue={initialStatus} className={selectClassName}>
        <option value="active">active</option>
        <option value="paused">paused</option>
        <option value="cancelled">cancelled</option>
      </select>
      <select name="role" defaultValue={initialRole} className={selectClassName}>
        <option value="user">user</option>
        <option value="admin">admin</option>
      </select>
      <LimitInput
        name="coreTokensIncluded"
        value={values.coreTokensIncluded}
        onChange={handleFieldChange}
        className={inputClassName}
      />
      <LimitInput
        name="tierTokensIncluded"
        value={values.tierTokensIncluded}
        onChange={handleFieldChange}
        className={inputClassName}
      />
      <LimitInput
        name="imageCreditsIncluded"
        value={values.imageCreditsIncluded}
        onChange={handleFieldChange}
        className={inputClassName}
      />
      <LimitInput
        name="dailyMessageLimit"
        value={values.dailyMessageLimit}
        onChange={handleFieldChange}
        className={inputClassName}
      />
      <LimitInput
        name="maxImagesPerDay"
        value={values.maxImagesPerDay}
        onChange={handleFieldChange}
        className={inputClassName}
      />
    </>
  )
}

export function DetailedPlanLimitFields({
  initialTier,
  initialValues,
}: {
  initialTier: SubscriptionTier
  initialValues: {
    coreTokensIncluded: number
    tierTokensIncluded: number
    imageCreditsIncluded: number
    dailyMessageLimit: number
    maxImagesPerDay: number
    maxInputTokensPerRequest: number
    maxOutputTokensPerRequest: number
  }
}) {
  const [tier, setTier] = useState<SubscriptionTier>(initialTier)
  const [values, setValues] = useState<FieldValues>(() =>
    createInitialValues(initialValues)
  )

  const handleTierChange = (nextTier: SubscriptionTier) => {
    setTier(nextTier)
    setValues(getPlanFieldValues(nextTier))
  }

  const handleFieldChange = (name: FieldName, value: string) => {
    setValues((current) => ({ ...current, [name]: value }))
  }

  const inputClassName = 'h-10 rounded-xl'
  const selectClassName =
    'flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/40 focus:ring-2 focus:ring-primary/20'

  return (
    <>
      <TierSelect value={tier} onChange={handleTierChange} className={selectClassName} />
      <LimitInput
        name="coreTokensIncluded"
        value={values.coreTokensIncluded}
        onChange={handleFieldChange}
        className={inputClassName}
      />
      <LimitInput
        name="tierTokensIncluded"
        value={values.tierTokensIncluded}
        onChange={handleFieldChange}
        className={inputClassName}
      />
      <LimitInput
        name="imageCreditsIncluded"
        value={values.imageCreditsIncluded}
        onChange={handleFieldChange}
        className={inputClassName}
      />
      <LimitInput
        name="dailyMessageLimit"
        value={values.dailyMessageLimit}
        onChange={handleFieldChange}
        className={inputClassName}
      />
      <LimitInput
        name="maxImagesPerDay"
        value={values.maxImagesPerDay}
        onChange={handleFieldChange}
        className={inputClassName}
      />
      <LimitInput
        name="maxInputTokensPerRequest"
        value={values.maxInputTokensPerRequest}
        onChange={handleFieldChange}
        className={inputClassName}
      />
      <LimitInput
        name="maxOutputTokensPerRequest"
        value={values.maxOutputTokensPerRequest}
        onChange={handleFieldChange}
        className={inputClassName}
      />
    </>
  )
}
