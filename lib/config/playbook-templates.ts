import { PlaybookTemplate } from '@/types'

export const PLAYBOOK_TEMPLATES: PlaybookTemplate[] = [
  {
    id: 'startup-idea-validator',
    title: 'Startup Idea Validator',
    description: 'Pressure-test a business idea, audience, risks, and next experiments.',
    tags: ['Founder', 'Strategy'],
    input: {
      title: 'Startup Idea Validator',
      description: 'Validate a startup idea through customer, market, and execution lenses.',
      metadata: {
        category: 'business',
        expectedOutputType: 'proposal',
        suggestedAssistant: 'axiom',
        visibility: 'private',
      },
      variables: [
        { name: 'idea', label: 'Startup idea' },
        { name: 'audience', label: 'Target customer' },
      ],
      steps: [
        {
          assistantFamily: 'axiom',
          template:
            'Evaluate this startup idea for {{audience}}: {{idea}}. Identify the core problem, strongest assumptions, and biggest validation risks.',
          metadata: { stepType: 'analysis', outputLabel: 'Validation risks' },
        },
        {
          assistantFamily: 'velora',
          template:
            'Turn the validated positioning for {{idea}} into a concise value proposition and landing-page hero draft.',
          metadata: {
            stepType: 'text',
            outputLabel: 'Value proposition',
            includePreviousOutput: true,
          },
        },
        {
          assistantFamily: 'nova',
          template:
            'Create a 7-day validation plan for {{idea}}, including interviews, landing page metrics, and a go/no-go decision rule.',
          metadata: {
            stepType: 'text',
            outputLabel: 'Validation plan',
            includePreviousOutput: true,
          },
        },
      ],
    },
  },
  {
    id: 'landing-page-copy-generator',
    title: 'Landing Page Copy Generator',
    description: 'Draft a conversion-oriented landing page from offer and audience details.',
    tags: ['Marketing', 'Copy'],
    input: {
      title: 'Landing Page Copy Generator',
      description: 'Generate structured landing page copy for a product or offer.',
      metadata: {
        category: 'marketing',
        expectedOutputType: 'campaign',
        suggestedAssistant: 'velora',
        visibility: 'private',
      },
      variables: [
        { name: 'offer', label: 'Offer' },
        { name: 'audience', label: 'Audience' },
      ],
      steps: [
        {
          assistantFamily: 'axiom',
          template:
            'Analyze the pains, desired outcomes, and objections for {{audience}} considering this offer: {{offer}}.',
          metadata: { stepType: 'analysis', outputLabel: 'Audience analysis' },
        },
        {
          assistantFamily: 'velora',
          template:
            'Write landing page copy for {{offer}} aimed at {{audience}}. Include hero, benefits, proof points, FAQ, and CTA.',
          metadata: {
            stepType: 'text',
            outputLabel: 'Landing page copy',
            includePreviousOutput: true,
          },
        },
        {
          assistantFamily: 'nova',
          template:
            'Review the landing page for clarity and conversion friction. Return a prioritized improvement checklist.',
          metadata: {
            stepType: 'analysis',
            outputLabel: 'Conversion checklist',
            includePreviousOutput: true,
          },
        },
      ],
    },
  },
  {
    id: 'research-brief-builder',
    title: 'Research Brief Builder',
    description: 'Turn a topic into a structured research brief with questions and gaps.',
    tags: ['Research', 'Axiom'],
    input: {
      title: 'Research Brief Builder',
      description: 'Build a research brief from a topic and intended decision.',
      metadata: {
        category: 'research',
        expectedOutputType: 'research_brief',
        suggestedAssistant: 'pulse',
        visibility: 'private',
      },
      variables: [
        { name: 'topic', label: 'Topic' },
        { name: 'decision', label: 'Decision' },
      ],
      steps: [
        {
          assistantFamily: 'pulse',
          template:
            'Research the topic "{{topic}}" for this decision: {{decision}}. Summarize current context and useful source directions.',
          metadata: { stepType: 'research', outputLabel: 'Source context' },
        },
        {
          assistantFamily: 'axiom',
          template:
            'Create a source-grounded research brief outline for {{topic}}, including key claims, unknowns, and evidence needed.',
          metadata: {
            stepType: 'analysis',
            outputLabel: 'Brief outline',
            includePreviousOutput: true,
          },
        },
        {
          assistantFamily: 'nova',
          template:
            'Convert the research outline into a decision-ready brief with next questions and recommended follow-up tasks.',
          metadata: {
            stepType: 'text',
            outputLabel: 'Decision brief',
            includePreviousOutput: true,
          },
        },
      ],
    },
  },
  {
    id: 'blog-post-builder',
    title: 'Blog Post Builder',
    description: 'Plan, draft, and tighten a practical blog article.',
    tags: ['Content', 'Writing'],
    input: {
      title: 'Blog Post Builder',
      description: 'Create a polished blog draft from topic, audience, and angle.',
      metadata: {
        category: 'content',
        expectedOutputType: 'document',
        suggestedAssistant: 'velora',
        visibility: 'private',
      },
      variables: [
        { name: 'topic', label: 'Topic' },
        { name: 'audience', label: 'Audience' },
        { name: 'angle', label: 'Angle' },
      ],
      steps: [
        {
          assistantFamily: 'axiom',
          template:
            'Create a tight blog outline for {{audience}} about {{topic}} using this angle: {{angle}}.',
          metadata: { stepType: 'analysis', outputLabel: 'Article outline' },
        },
        {
          assistantFamily: 'velora',
          template:
            'Draft the blog post from the outline about {{topic}}. Use a clear, useful, non-generic voice for {{audience}}.',
          metadata: {
            stepType: 'text',
            outputLabel: 'Draft article',
            includePreviousOutput: true,
          },
        },
        {
          assistantFamily: 'nova',
          template:
            'Edit the blog draft for clarity, structure, and actionability. Return the improved final version.',
          metadata: {
            stepType: 'text',
            outputLabel: 'Final article',
            includePreviousOutput: true,
          },
        },
      ],
    },
  },
  {
    id: 'client-proposal-builder',
    title: 'Client Proposal Builder',
    description: 'Create a client proposal with scope, timeline, risks, and next step.',
    tags: ['Agency', 'Business'],
    input: {
      title: 'Client Proposal Builder',
      description: 'Draft a practical service proposal for a client engagement.',
      metadata: {
        category: 'agency',
        expectedOutputType: 'proposal',
        suggestedAssistant: 'velora',
        visibility: 'private',
      },
      variables: [
        { name: 'client', label: 'Client' },
        { name: 'project', label: 'Project' },
        { name: 'outcome', label: 'Outcome' },
      ],
      steps: [
        {
          assistantFamily: 'axiom',
          template:
            'Clarify the scope, risks, assumptions, and success metrics for {{client}} on {{project}}, targeting {{outcome}}.',
          metadata: { stepType: 'analysis', outputLabel: 'Scope analysis' },
        },
        {
          assistantFamily: 'velora',
          template:
            'Write a professional client proposal for {{client}} covering {{project}}, scope, timeline, deliverables, and next steps.',
          metadata: {
            stepType: 'text',
            outputLabel: 'Proposal draft',
            includePreviousOutput: true,
          },
        },
        {
          assistantFamily: 'nova',
          template:
            'Create a negotiation and follow-up checklist for the proposal to {{client}}.',
          metadata: {
            stepType: 'text',
            outputLabel: 'Follow-up checklist',
            includePreviousOutput: true,
          },
        },
      ],
    },
  },
  {
    id: 'bug-debugging-playbook',
    title: 'Bug Debugging Playbook',
    description: 'Reproduce, isolate, explain, and fix a software bug.',
    tags: ['Developer', 'Forge'],
    input: {
      title: 'Bug Debugging Playbook',
      description: 'Guide a debugging pass from symptoms to patch plan.',
      metadata: {
        category: 'developer',
        expectedOutputType: 'checklist',
        suggestedAssistant: 'forge',
        visibility: 'private',
      },
      variables: [
        { name: 'bug', label: 'Bug' },
        { name: 'context', label: 'Context' },
      ],
      steps: [
        {
          assistantFamily: 'forge',
          template:
            'Given this bug: {{bug}}\n\nContext:\n{{context}}\n\nCreate a reproduction checklist and likely fault boundaries.',
          metadata: { stepType: 'code', outputLabel: 'Reproduction checklist' },
        },
        {
          assistantFamily: 'forge',
          template:
            'Propose a focused debugging plan for {{bug}}, including instrumentation, hypotheses, and smallest safe fix.',
          metadata: {
            stepType: 'code',
            outputLabel: 'Debugging plan',
            includePreviousOutput: true,
          },
        },
        {
          assistantFamily: 'axiom',
          template:
            'Review the debugging plan for hidden assumptions, regression risks, and missing tests.',
          metadata: {
            stepType: 'analysis',
            outputLabel: 'Risk review',
            includePreviousOutput: true,
          },
        },
      ],
    },
  },
  {
    id: 'brand-voice-builder',
    title: 'Brand Voice Builder',
    description: 'Define a usable brand voice and rewrite examples in that style.',
    tags: ['Brand', 'Content'],
    input: {
      title: 'Brand Voice Builder',
      description: 'Create a brand voice guide with examples and editing rules.',
      metadata: {
        category: 'marketing',
        expectedOutputType: 'document',
        suggestedAssistant: 'velora',
        visibility: 'private',
      },
      variables: [
        { name: 'brand', label: 'Brand' },
        { name: 'audience', label: 'Audience' },
        { name: 'examples', label: 'Examples' },
      ],
      steps: [
        {
          assistantFamily: 'velora',
          template:
            'Analyze the intended voice for {{brand}} speaking to {{audience}}. Use these examples as reference:\n{{examples}}',
          metadata: { stepType: 'text', outputLabel: 'Voice analysis' },
        },
        {
          assistantFamily: 'velora',
          template:
            'Create a practical brand voice guide for {{brand}} with tone pillars, words to use/avoid, and before/after examples.',
          metadata: {
            stepType: 'text',
            outputLabel: 'Voice guide',
            includePreviousOutput: true,
          },
        },
        {
          assistantFamily: 'nova',
          template:
            'Turn the brand voice guide into a checklist that writers can apply before publishing.',
          metadata: {
            stepType: 'text',
            outputLabel: 'Publishing checklist',
            includePreviousOutput: true,
          },
        },
      ],
    },
  },
  {
    id: 'image-campaign-builder',
    title: 'Image Campaign Builder',
    description: 'Plan campaign concepts and generate a Prism-ready image prompt.',
    tags: ['Prism', 'Marketing'],
    input: {
      title: 'Image Campaign Builder',
      description: 'Develop a visual campaign concept and production-ready image prompt.',
      metadata: {
        category: 'image',
        expectedOutputType: 'campaign',
        suggestedAssistant: 'prism',
        visibility: 'private',
      },
      variables: [
        { name: 'campaign', label: 'Campaign' },
        { name: 'brand', label: 'Brand' },
        { name: 'style', label: 'Visual style' },
      ],
      steps: [
        {
          assistantFamily: 'velora',
          template:
            'Create three visual campaign concepts for {{brand}} around {{campaign}} in this style direction: {{style}}.',
          metadata: { stepType: 'text', outputLabel: 'Visual concepts' },
        },
        {
          assistantFamily: 'prism',
          template:
            'Generate a polished campaign image for {{brand}}. Campaign: {{campaign}}. Visual direction: {{style}}. Use the strongest concept from the previous step if available.',
          metadata: {
            stepType: 'image',
            outputLabel: 'Campaign image',
            includePreviousOutput: true,
          },
        },
        {
          assistantFamily: 'nova',
          template:
            'Write a short campaign review checklist for the generated image: brand fit, clarity, audience relevance, and next variations.',
          metadata: {
            stepType: 'text',
            outputLabel: 'Review checklist',
            includePreviousOutput: true,
          },
        },
      ],
    },
  },
]
