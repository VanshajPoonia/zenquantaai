import { AIMode, OnboardingUseCase, StarterPackId } from '@/types'

export const ONBOARDING_VERSION = 1

export const ONBOARDING_USE_CASES: Array<{
  id: OnboardingUseCase
  label: string
  description: string
}> = [
  {
    id: 'school_research',
    label: 'School/research',
    description: 'Study planning, research notes, source synthesis, and structured explanations.',
  },
  {
    id: 'coding',
    label: 'Coding',
    description: 'Debugging, implementation planning, architecture, and technical writing.',
  },
  {
    id: 'business',
    label: 'Business',
    description: 'Founder decisions, strategy, positioning, operations, and weekly reviews.',
  },
  {
    id: 'marketing_content',
    label: 'Marketing/content',
    description: 'Campaigns, content calendars, brand voice, and polished copy.',
  },
  {
    id: 'personal_productivity',
    label: 'Personal productivity',
    description: 'Planning, prioritization, routines, task breakdowns, and daily clarity.',
  },
  {
    id: 'image_generation',
    label: 'Image generation',
    description: 'Prism-first visual ideation, image prompts, and creative direction.',
  },
  {
    id: 'all_in_one',
    label: 'All-in-one workspace',
    description: 'A balanced workspace for projects, writing, analysis, code, and visuals.',
  },
]

export const ONBOARDING_RECOMMENDATIONS: Record<
  OnboardingUseCase,
  { defaultMode: AIMode; starterPackId: StarterPackId }
> = {
  school_research: { defaultMode: 'logic', starterPackId: 'student' },
  coding: { defaultMode: 'code', starterPackId: 'developer' },
  business: { defaultMode: 'logic', starterPackId: 'founder' },
  marketing_content: { defaultMode: 'creative', starterPackId: 'content_creator' },
  personal_productivity: { defaultMode: 'general', starterPackId: 'small_business' },
  image_generation: { defaultMode: 'image', starterPackId: 'content_creator' },
  all_in_one: { defaultMode: 'general', starterPackId: 'agency' },
}

export interface StarterPromptTemplate {
  id: string
  title: string
  content: string
  mode: AIMode | 'any'
}

export interface StarterPack {
  id: StarterPackId
  label: string
  description: string
  projectName: string
  projectDescription: string
  projectColor: AIMode
  prompts: StarterPromptTemplate[]
}

export const STARTER_PACKS: Record<StarterPackId, StarterPack> = {
  student: {
    id: 'student',
    label: 'Student Pack',
    description: 'Study, explain, and synthesize academic work with more structure.',
    projectName: 'Student Workspace',
    projectDescription: 'Study plans, research notes, and academic drafts.',
    projectColor: 'logic',
    prompts: [
      {
        id: 'onboarding_student_study_plan',
        title: 'Study Plan Builder',
        mode: 'logic',
        content:
          'Create a study plan for this topic, broken into sessions with goals, review checkpoints, and practice questions: ',
      },
      {
        id: 'onboarding_student_explain_ta',
        title: 'Explain This Like A TA',
        mode: 'logic',
        content:
          'Explain this concept like a teaching assistant. Start with the core idea, give an example, then list common mistakes: ',
      },
      {
        id: 'onboarding_student_research_notes',
        title: 'Research Notes Synthesizer',
        mode: 'live',
        content:
          'Turn these research notes into a structured brief with thesis, key claims, evidence, open questions, and next sources to check: ',
      },
    ],
  },
  founder: {
    id: 'founder',
    label: 'Founder Pack',
    description: 'Clarify startup decisions, positioning, and operating cadence.',
    projectName: 'Founder Workspace',
    projectDescription: 'Strategy, positioning, GTM, and weekly operating reviews.',
    projectColor: 'logic',
    prompts: [
      {
        id: 'onboarding_founder_decision_memo',
        title: 'Startup Decision Memo',
        mode: 'logic',
        content:
          'Write a startup decision memo for this question. Include context, options, tradeoffs, recommendation, and next actions: ',
      },
      {
        id: 'onboarding_founder_icp_positioning',
        title: 'ICP And Positioning Draft',
        mode: 'creative',
        content:
          'Help define the ICP and positioning for this product. Include user profile, pain points, alternatives, core promise, and homepage copy angles: ',
      },
      {
        id: 'onboarding_founder_weekly_review',
        title: 'Weekly Founder Review',
        mode: 'general',
        content:
          'Turn these weekly notes into a founder operating review with wins, blockers, metrics, priorities, and decisions needed: ',
      },
    ],
  },
  developer: {
    id: 'developer',
    label: 'Developer Pack',
    description: 'Debug, design, summarize, and ship technical work faster.',
    projectName: 'Developer Workspace',
    projectDescription: 'Debugging notes, implementation plans, and engineering docs.',
    projectColor: 'code',
    prompts: [
      {
        id: 'onboarding_developer_debugging_checklist',
        title: 'Debugging Checklist',
        mode: 'code',
        content:
          'Build a debugging checklist for this issue. Include hypotheses, files to inspect, logs to capture, likely root causes, and safe fixes: ',
      },
      {
        id: 'onboarding_developer_architecture_tradeoffs',
        title: 'Architecture Tradeoff Review',
        mode: 'code',
        content:
          'Review this technical design. Compare alternatives, risks, complexity, data flow, and the smallest production-safe implementation: ',
      },
      {
        id: 'onboarding_developer_pr_summary',
        title: 'Pull Request Summary',
        mode: 'code',
        content:
          'Write a clear pull request summary from these changes. Include what changed, why, verification, and risks: ',
      },
    ],
  },
  content_creator: {
    id: 'content_creator',
    label: 'Content Creator Pack',
    description: 'Plan content, sharpen voice, and generate better visual prompts.',
    projectName: 'Content Studio',
    projectDescription: 'Campaigns, content drafts, brand voice, and image prompts.',
    projectColor: 'creative',
    prompts: [
      {
        id: 'onboarding_content_calendar_builder',
        title: 'Content Calendar Builder',
        mode: 'creative',
        content:
          'Create a content calendar for this audience and goal. Include themes, post ideas, hooks, formats, and repurposing notes: ',
      },
      {
        id: 'onboarding_content_brand_voice_rewrite',
        title: 'Brand Voice Rewrite',
        mode: 'creative',
        content:
          'Rewrite this in a stronger brand voice. Keep the meaning, improve rhythm, make it specific, and offer three tone variants: ',
      },
      {
        id: 'onboarding_content_prism_prompt_builder',
        title: 'Prism Image Prompt Builder',
        mode: 'image',
        content:
          'Turn this visual idea into a polished Prism image prompt with subject, composition, lighting, style, mood, and details to avoid: ',
      },
    ],
  },
  small_business: {
    id: 'small_business',
    label: 'Small Business Pack',
    description: 'Handle customer communication, offers, and operational clarity.',
    projectName: 'Small Business Workspace',
    projectDescription: 'Customer replies, offers, operations, and planning.',
    projectColor: 'general',
    prompts: [
      {
        id: 'onboarding_small_business_customer_reply',
        title: 'Customer Reply Draft',
        mode: 'general',
        content:
          'Draft a helpful customer reply for this situation. Keep it warm, concise, specific, and include the next step: ',
      },
      {
        id: 'onboarding_small_business_operations_checklist',
        title: 'Operations Checklist',
        mode: 'logic',
        content:
          'Create an operations checklist for this recurring task. Include owner, timing, dependencies, risks, and quality checks: ',
      },
      {
        id: 'onboarding_small_business_local_offer',
        title: 'Local Offer Brainstorm',
        mode: 'creative',
        content:
          'Brainstorm practical offers for this local business. Include target customer, offer structure, copy angle, and launch steps: ',
      },
    ],
  },
  research: {
    id: 'research',
    label: 'Research Pack',
    description: 'Build briefs, compare sources, and surface open questions.',
    projectName: 'Research Workspace',
    projectDescription: 'Research briefs, source matrices, and investigation notes.',
    projectColor: 'live',
    prompts: [
      {
        id: 'onboarding_research_source_brief',
        title: 'Source-Grounded Brief',
        mode: 'live',
        content:
          'Create a source-grounded research brief on this question. Separate known facts, evidence, uncertainty, and follow-up searches: ',
      },
      {
        id: 'onboarding_research_literature_matrix',
        title: 'Literature Review Matrix',
        mode: 'logic',
        content:
          'Turn these papers or sources into a literature review matrix with methods, findings, limitations, and relevance: ',
      },
      {
        id: 'onboarding_research_open_questions',
        title: 'Open Questions Tracker',
        mode: 'logic',
        content:
          'Extract open questions from this research area and rank them by importance, uncertainty, and next investigation step: ',
      },
    ],
  },
  agency: {
    id: 'agency',
    label: 'Agency Pack',
    description: 'Move between discovery, concepts, client communication, and delivery.',
    projectName: 'Agency Workspace',
    projectDescription: 'Client briefs, campaign concepts, status updates, and delivery notes.',
    projectColor: 'general',
    prompts: [
      {
        id: 'onboarding_agency_client_discovery',
        title: 'Client Discovery Brief',
        mode: 'logic',
        content:
          'Turn these discovery notes into a client brief with goals, audience, constraints, risks, and recommended next steps: ',
      },
      {
        id: 'onboarding_agency_campaign_concept',
        title: 'Campaign Concept Sprint',
        mode: 'creative',
        content:
          'Generate campaign concepts for this client goal. Include angle, audience insight, sample copy, visual direction, and execution notes: ',
      },
      {
        id: 'onboarding_agency_status_update',
        title: 'Client Status Update',
        mode: 'general',
        content:
          'Draft a client status update from these notes. Include completed work, decisions, blockers, next steps, and a polished tone: ',
      },
    ],
  },
}

export const ONBOARDING_ASSISTANT_MODES: AIMode[] = [
  'general',
  'creative',
  'logic',
  'code',
  'live',
  'image',
]

export function getOnboardingRecommendation(useCase: OnboardingUseCase) {
  return ONBOARDING_RECOMMENDATIONS[useCase]
}

export function getStarterProjectId(packId: StarterPackId) {
  return `onboarding_${packId}_project`
}
