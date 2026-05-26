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
      variables: [
        { name: 'idea', label: 'Startup idea' },
        { name: 'audience', label: 'Target customer' },
      ],
      steps: [
        {
          assistantFamily: 'axiom',
          template:
            'Evaluate this startup idea for {{audience}}: {{idea}}. Identify the core problem, strongest assumptions, and biggest validation risks.',
        },
        {
          assistantFamily: 'velora',
          template:
            'Turn the validated positioning for {{idea}} into a concise value proposition and landing-page hero draft.',
        },
        {
          assistantFamily: 'nova',
          template:
            'Create a 7-day validation plan for {{idea}}, including interviews, landing page metrics, and a go/no-go decision rule.',
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
      variables: [
        { name: 'offer', label: 'Offer' },
        { name: 'audience', label: 'Audience' },
      ],
      steps: [
        {
          assistantFamily: 'axiom',
          template:
            'Analyze the pains, desired outcomes, and objections for {{audience}} considering this offer: {{offer}}.',
        },
        {
          assistantFamily: 'velora',
          template:
            'Write landing page copy for {{offer}} aimed at {{audience}}. Include hero, benefits, proof points, FAQ, and CTA.',
        },
        {
          assistantFamily: 'nova',
          template:
            'Review the landing page for clarity and conversion friction. Return a prioritized improvement checklist.',
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
      variables: [
        { name: 'topic', label: 'Topic' },
        { name: 'decision', label: 'Decision' },
      ],
      steps: [
        {
          assistantFamily: 'pulse',
          template:
            'Research the topic "{{topic}}" for this decision: {{decision}}. Summarize current context and useful source directions.',
        },
        {
          assistantFamily: 'axiom',
          template:
            'Create a source-grounded research brief outline for {{topic}}, including key claims, unknowns, and evidence needed.',
        },
        {
          assistantFamily: 'nova',
          template:
            'Convert the research outline into a decision-ready brief with next questions and recommended follow-up tasks.',
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
        },
        {
          assistantFamily: 'velora',
          template:
            'Draft the blog post from the outline about {{topic}}. Use a clear, useful, non-generic voice for {{audience}}.',
        },
        {
          assistantFamily: 'nova',
          template:
            'Edit the blog draft for clarity, structure, and actionability. Return the improved final version.',
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
        },
        {
          assistantFamily: 'velora',
          template:
            'Write a professional client proposal for {{client}} covering {{project}}, scope, timeline, deliverables, and next steps.',
        },
        {
          assistantFamily: 'nova',
          template:
            'Create a negotiation and follow-up checklist for the proposal to {{client}}.',
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
      variables: [
        { name: 'bug', label: 'Bug' },
        { name: 'context', label: 'Context' },
      ],
      steps: [
        {
          assistantFamily: 'forge',
          template:
            'Given this bug: {{bug}}\n\nContext:\n{{context}}\n\nCreate a reproduction checklist and likely fault boundaries.',
        },
        {
          assistantFamily: 'forge',
          template:
            'Propose a focused debugging plan for {{bug}}, including instrumentation, hypotheses, and smallest safe fix.',
        },
        {
          assistantFamily: 'axiom',
          template:
            'Review the debugging plan for hidden assumptions, regression risks, and missing tests.',
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
        },
        {
          assistantFamily: 'velora',
          template:
            'Create a practical brand voice guide for {{brand}} with tone pillars, words to use/avoid, and before/after examples.',
        },
        {
          assistantFamily: 'nova',
          template:
            'Turn the brand voice guide into a checklist that writers can apply before publishing.',
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
        },
        {
          assistantFamily: 'prism',
          template:
            'Generate a polished campaign image for {{brand}}. Campaign: {{campaign}}. Visual direction: {{style}}. Use the strongest concept from the previous step if available.',
        },
        {
          assistantFamily: 'nova',
          template:
            'Write a short campaign review checklist for the generated image: brand fit, clarity, audience relevance, and next variations.',
        },
      ],
    },
  },
]
