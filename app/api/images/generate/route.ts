import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser, appendAuthCookies } from '@/lib/auth/session'
import { createSessionSettings, resolveModelConfig } from '@/lib/config'
import { generateImageFromPrompt } from '@/lib/ai/chat'
import { calculateImageUsageEstimate } from '@/lib/billing/costs'
import { enforceImageUsage } from '@/lib/billing/enforce'
import { logImageUsage } from '@/lib/billing/log-usage'
import {
  subscriptionsStore,
  usageLimitOverridesStore,
} from '@/lib/storage'

export const runtime = 'nodejs'

type GenerateImageBody = {
  prompt?: string
  negativePrompt?: string
  size?: string
  aspectRatio?: string
  imageCount?: number
  conversationId?: string
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => null)) as GenerateImageBody | null
  const prompt = body?.prompt?.trim()

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 })
  }

  const subscription = await subscriptionsStore.ensureForUser(auth.user)
  const override = await usageLimitOverridesStore.getByUserId(auth.user.id)
  const imageCount = Math.max(1, Math.min(body?.imageCount ?? 1, 4))
  const routeConfig = resolveModelConfig('image', 'auto', subscription.tier)
  const usage = calculateImageUsageEstimate({
    tier: subscription.tier,
    modelConfig: {
      family: 'prism',
      tier: subscription.tier,
      displayName: routeConfig.label,
      model: routeConfig.model,
      rawCostPerImageUsd: routeConfig.imageCostPerUnit ?? 0.035,
      defaultImageCreditsPerImage: 10,
    },
    imageCount,
  })

  enforceImageUsage({
    subscription,
    override,
    imageCount,
    imageCreditsRequired: usage.creditsConsumed ?? 0,
  })

  const generated = await Promise.all(
    Array.from({ length: imageCount }, async () =>
      generateImageFromPrompt({
        prompt,
        mode: 'image',
        settings: createSessionSettings('image'),
        model: routeConfig.model,
      })
    )
  )

  await logImageUsage({
    subscription,
    event: {
      userId: auth.user.id,
      conversationId: body?.conversationId ?? null,
      messageId: null,
      assistantFamily: 'prism',
      model: routeConfig.model,
      prompt,
      negativePrompt: body?.negativePrompt ?? null,
      size: body?.size ?? null,
      aspectRatio: body?.aspectRatio ?? null,
      imageCount,
      imageCreditsConsumed: usage.creditsConsumed ?? 0,
      rawCostUsd: usage.rawCostUsd,
      displayedCostUsd: usage.displayedCostUsd,
      displayMultiplier: usage.displayMultiplier,
      marginUsd: usage.marginUsd,
      outputUrls: generated
        .map((item) => item.imageUrl)
        .filter((value): value is string => Boolean(value)),
    },
  })

  const headers = new Headers()
  if (auth.session.refreshed) {
    appendAuthCookies(headers, auth.session)
  }

  return NextResponse.json(
    {
      images: generated.map((item) => ({
        previewUrl: item.attachment.previewUrl,
        name: item.attachment.name,
      })),
      usage: {
        displayedCostUsd: usage.displayedCostUsd,
        estimatedCostUsd: usage.estimatedCostUsd,
        creditsConsumed: usage.creditsConsumed ?? 0,
        imageCount,
      },
    },
    { headers }
  )
}
