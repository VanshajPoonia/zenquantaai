# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Everyday individuals who want one AI app for writing, planning, research, coding and images instead of juggling several AI subscriptions. They arrive signed out at the site root and decide whether to create an account.

## Product Purpose

Zenquanta AI is a personal AI workspace. It gathers six specialist assistants in one place so a person picks the right helper for the job without leaving their chats, files and memory behind. Success is a visitor creating an account and starting a first chat.

## Positioning

Six specialists, one place. Each assistant is tuned for a different kind of work, and all six share the same workspace: projects, chats, uploaded files, memory and playbooks.

- Nova: everyday practical work, planning, summaries.
- Velora: creative writing, voice, storytelling, naming.
- Axiom: structured reasoning, comparisons, decisions.
- Forge: coding, debugging, architecture.
- Pulse: live web research with sources (when search is configured).
- Prism: image generation.

## Operating Context

- Sign-up is a Zenquanta ID (3 to 32 characters: letters, numbers, dots, underscores, dashes) plus a password of at least 8 characters. No email is required.
- Signed-in visitors at `/` go straight into the workspace; signed-out visitors see the landing page.
- Plan upgrades are manual: users request a plan, an admin activates it. There is no checkout.

## Capabilities and Constraints

- Plans come from `lib/config/pricing.ts` (`PLAN_CONFIGS`): Free $0, Basic $4, Pro $15, Ultra $59, Prime $200 per month. Higher tiers unlock stronger models per assistant.
- Free plan: 50 messages a day, 50 image credits, 2 images a day.
- Workspace features: projects, private file upload with file-aware answers, conversation memory, saved prompts and playbooks, model comparison, private custom assistants.
- All AI models go through OpenRouter.
- Do not claim payment automation, team features, or capabilities not in the code.

## Brand Commitments

- Name: Zenquanta AI. Logo component: `ZenquantaLogo` in `components/icons`.
- The six assistant names and their accent colors (`--general`, `--creative`, `--logic`, `--code`, `--live`, `--image` in `app/globals.css`) identify the assistants across the product.
- The app is dark-themed.
- No em dashes in copy.

## Evidence on Hand

- Real: assistant descriptions and suggested prompts in `lib/config/assistants.ts`, plan numbers in `lib/config/pricing.ts`.
- None: no testimonials, customer logos, user counts, benchmarks or press. Do not fabricate them.

## Product Principles

1. The right specialist for each job, without losing context between them.
2. Honest about limits and pricing; nothing hidden behind a sales call.
3. Starting is free and takes under a minute.
