import { AIMode, ModeConfig } from '@/types'
import { ASSISTANT_FAMILY_COPY, getAssistantFamilyFromMode } from './assistants'
import { MODEL_ROUTE_CONFIGS } from './models'

const MODE_DISPLAY_CONFIGS: Record<
  AIMode,
  Omit<ModeConfig, keyof typeof MODEL_ROUTE_CONFIGS.general | 'description'>
> = {
  general: {
    id: 'general',
    name: 'Nova',
    placeholder: ASSISTANT_FAMILY_COPY.nova.placeholder,
    helperText: ASSISTANT_FAMILY_COPY.nova.helperText,
    emptyStateTitle: ASSISTANT_FAMILY_COPY.nova.emptyStateTitle,
    emptyStateDescription: ASSISTANT_FAMILY_COPY.nova.emptyStateDescription,
    suggestedPrompts: ASSISTANT_FAMILY_COPY.nova.suggestedPrompts,
    accentColor: ASSISTANT_FAMILY_COPY.nova.accentColor,
    icon: ASSISTANT_FAMILY_COPY.nova.icon,
  },
  creative: {
    id: 'creative',
    name: 'Velora',
    placeholder: ASSISTANT_FAMILY_COPY.velora.placeholder,
    helperText: ASSISTANT_FAMILY_COPY.velora.helperText,
    emptyStateTitle: ASSISTANT_FAMILY_COPY.velora.emptyStateTitle,
    emptyStateDescription: ASSISTANT_FAMILY_COPY.velora.emptyStateDescription,
    suggestedPrompts: ASSISTANT_FAMILY_COPY.velora.suggestedPrompts,
    accentColor: ASSISTANT_FAMILY_COPY.velora.accentColor,
    icon: ASSISTANT_FAMILY_COPY.velora.icon,
  },
  logic: {
    id: 'logic',
    name: 'Axiom',
    placeholder: ASSISTANT_FAMILY_COPY.axiom.placeholder,
    helperText: ASSISTANT_FAMILY_COPY.axiom.helperText,
    emptyStateTitle: ASSISTANT_FAMILY_COPY.axiom.emptyStateTitle,
    emptyStateDescription: ASSISTANT_FAMILY_COPY.axiom.emptyStateDescription,
    suggestedPrompts: ASSISTANT_FAMILY_COPY.axiom.suggestedPrompts,
    accentColor: ASSISTANT_FAMILY_COPY.axiom.accentColor,
    icon: ASSISTANT_FAMILY_COPY.axiom.icon,
  },
  code: {
    id: 'code',
    name: 'Forge',
    placeholder: ASSISTANT_FAMILY_COPY.forge.placeholder,
    helperText: ASSISTANT_FAMILY_COPY.forge.helperText,
    emptyStateTitle: ASSISTANT_FAMILY_COPY.forge.emptyStateTitle,
    emptyStateDescription: ASSISTANT_FAMILY_COPY.forge.emptyStateDescription,
    suggestedPrompts: ASSISTANT_FAMILY_COPY.forge.suggestedPrompts,
    accentColor: ASSISTANT_FAMILY_COPY.forge.accentColor,
    icon: ASSISTANT_FAMILY_COPY.forge.icon,
  },
  live: {
    id: 'live',
    name: 'Pulse',
    placeholder: ASSISTANT_FAMILY_COPY.pulse.placeholder,
    helperText: ASSISTANT_FAMILY_COPY.pulse.helperText,
    emptyStateTitle: ASSISTANT_FAMILY_COPY.pulse.emptyStateTitle,
    emptyStateDescription: ASSISTANT_FAMILY_COPY.pulse.emptyStateDescription,
    suggestedPrompts: ASSISTANT_FAMILY_COPY.pulse.suggestedPrompts,
    accentColor: ASSISTANT_FAMILY_COPY.pulse.accentColor,
    icon: ASSISTANT_FAMILY_COPY.pulse.icon,
  },
  image: {
    id: 'image',
    name: 'Prism',
    placeholder: ASSISTANT_FAMILY_COPY.prism.placeholder,
    helperText: ASSISTANT_FAMILY_COPY.prism.helperText,
    emptyStateTitle: ASSISTANT_FAMILY_COPY.prism.emptyStateTitle,
    emptyStateDescription: ASSISTANT_FAMILY_COPY.prism.emptyStateDescription,
    suggestedPrompts: ASSISTANT_FAMILY_COPY.prism.suggestedPrompts,
    accentColor: ASSISTANT_FAMILY_COPY.prism.accentColor,
    icon: ASSISTANT_FAMILY_COPY.prism.icon,
  },
}

export const MODE_CONFIGS: Record<AIMode, ModeConfig> = {
  general: {
    ...MODEL_ROUTE_CONFIGS.general,
    ...MODE_DISPLAY_CONFIGS.general,
  },
  creative: {
    ...MODEL_ROUTE_CONFIGS.creative,
    ...MODE_DISPLAY_CONFIGS.creative,
  },
  logic: {
    ...MODEL_ROUTE_CONFIGS.logic,
    ...MODE_DISPLAY_CONFIGS.logic,
  },
  code: {
    ...MODEL_ROUTE_CONFIGS.code,
    ...MODE_DISPLAY_CONFIGS.code,
  },
  live: {
    ...MODEL_ROUTE_CONFIGS.live,
    ...MODE_DISPLAY_CONFIGS.live,
  },
  image: {
    ...MODEL_ROUTE_CONFIGS.image,
    ...MODE_DISPLAY_CONFIGS.image,
  },
}

export const MODE_ORDER: AIMode[] = [
  'general',
  'creative',
  'logic',
  'code',
  'live',
  'image',
]

export function getModeBrandName(mode: AIMode): string {
  return ASSISTANT_FAMILY_COPY[getAssistantFamilyFromMode(mode)].shortName
}
