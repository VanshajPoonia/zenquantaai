import type { Metadata } from 'next'
import { StaticPage } from '@/components/static/static-page'
import { SUPPORT_EMAIL } from '@/lib/config/contact'

export const metadata: Metadata = { title: 'Terms | Zenquanta AI' }

export default function TermsPage() {
  return (
    <StaticPage title="Terms of Service" updated="28 November 2026">
      <p>
        These terms cover your use of Zenquanta AI, its web app and the zq terminal app. By creating
        an account or using zq, you agree to them.
      </p>

      <h2>Your account</h2>
      <p>
        You need a Zenquanta ID and password to use the app. Keep your password and your zq sign-ins
        safe. You are responsible for what happens under your account.
      </p>
      <p>
        You must be at least 13 years old, or older if the law where you live sets a higher minimum
        age. If you are under 18 you need a parent or guardian&apos;s permission to use Zenquanta. The
        same applies wherever local law requires it. You confirm this when you create an account.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not use Zenquanta for anything illegal, or to harm, harass or deceive people.</li>
        <li>Do not try to break, overload or get around the service, its limits or its security.</li>
        <li>Do not use it to make malware, attack systems you do not own, or collect other people&apos;s data without permission.</li>
        <li>Do not share your account or resell access to it.</li>
      </ul>
      <p>We can suspend accounts that break these rules.</p>

      <h2>AI answers</h2>
      <p>
        Answers come from AI models and can be wrong. Check anything important, especially code,
        legal, medical and money matters, before you rely on it.
      </p>

      <h2>AI models and their providers</h2>
      <p>
        Zenquanta answers with AI models from third-party providers, reached through OpenRouter. By
        using Zenquanta you also agree to follow the terms of the model providers that serve your
        requests. OpenRouter lists them at{' '}
        <a href="https://openrouter.ai/docs/features/provider-routing#terms-of-service">
          openrouter.ai
        </a>
        .
      </p>

      <h2>zq on your computer</h2>
      <p>
        zq can read, change and run files and commands on your computer. By default it asks before it
        edits files or runs commands. You decide what to approve, and you are responsible for the
        actions you approve or allow with options like <code>--yolo</code>. Use version control and
        review changes before you rely on them.
      </p>
      <p>
        zq runs on your own OpenRouter key. OpenRouter bills you for those requests, and its terms and
        the model providers&apos; terms apply to them. Zenquanta handles your zq sign-in and keeps the
        sessions you sync.
      </p>

      <h2>Plans and usage</h2>
      <p>
        Each plan has limits on messages, tokens, images and agent steps, shown on the Plans page.
        Paid plans are switched on by an admin after you request one. There is no automatic billing.
        We agree with you how you pay before an admin switches your plan on. If the plan is not right
        for you, ask for a refund within 7 days of paying. We may change plans and limits, and we will
        show the current ones on the Plans page.
      </p>

      <h2>Your content</h2>
      <p>
        You keep the rights to what you upload and create. You let us store and process it only to run
        the service for you. You can delete your data or your account at any time in Settings.
      </p>

      <h2>Changes and ending</h2>
      <p>
        We may update these terms. If a change matters, we will tell you in the app. You can stop using
        Zenquanta at any time. We may end the service with notice.
      </p>

      <h2>No warranty</h2>
      <p>
        Zenquanta is provided as is, without warranties of any kind. To the extent the law allows, we
        are not liable for indirect or consequential losses, or for losses caused by AI output or by
        actions you approved in zq.
      </p>

      <h2>Who runs Zenquanta</h2>
      <p>Zenquanta AI is run from India. Indian law applies to these terms.</p>

      <h2>Contact</h2>
      <p>
        Questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </StaticPage>
  )
}
