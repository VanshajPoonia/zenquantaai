import type { Metadata } from 'next'
import { StaticPage } from '@/components/static/static-page'
import { SUPPORT_EMAIL } from '@/lib/config/contact'

export const metadata: Metadata = { title: 'Privacy | Zenquanta AI' }

export default function PrivacyPage() {
  return (
    <StaticPage title="Privacy Policy" updated="28 November 2026">
      <p>This page explains what Zenquanta AI stores, why, who helps us run it, and how to delete it.</p>

      <h2>What we store</h2>
      <ul>
        <li>Your account: Zenquanta ID, a salted hash of your password, and an email if you add one.</li>
        <li>Your work: chats, uploaded files, memory, projects, prompts, playbooks, artifacts and generated images.</li>
        <li>zq sessions, when sync is on: your prompts, the answers and short tool outputs, cut to 4 KB. Output from protected files like <code>.env</code> is never sent. Turn sync off with <code>/sync off</code>. zq sends your prompts and code straight to OpenRouter with your own key, so we only receive what sync uploads.</li>
        <li>Usage: tokens, steps and costs for each request, so plans and limits work.</li>
        <li>Security records: a hashed form of IP addresses and tokens, used for rate limits and to stop abuse.</li>
      </ul>

      <h2>How we use it</h2>
      <p>
        Only to run Zenquanta for you: answering, remembering context you turned on, enforcing plan
        limits, keeping the service secure, and fixing problems. We do not sell your data or use it
        for ads.
      </p>

      <h2>Who helps us run it</h2>
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>What it does</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>OpenRouter and the model providers it routes to</td><td>Generates answers, images, web search results and embeddings for file search</td></tr>
          <tr><td>Tavily</td><td>Web search and page reading, when configured</td></tr>
          <tr><td>Neon</td><td>Database</td></tr>
          <tr><td>Vercel</td><td>Hosting and basic analytics</td></tr>
          <tr><td>Cloudflare R2</td><td>Private storage for uploads and generated images</td></tr>
        </tbody>
      </table>
      <p>These services process data only to provide their part of Zenquanta.</p>
      <p>
        Model providers handle your prompts under their own data policies, and some keep logs of
        them for a time. OpenRouter lists each provider&apos;s policy.
      </p>

      <h2>Where it is stored</h2>
      <p>
        The database and the app run in the US, in the US East region. Uploaded files and generated
        images are stored in the Asia Pacific region. Model providers may process prompts in other
        countries.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Your account and your work stay until you delete them, or until you delete your account.</li>
        <li>Usage records stay while your account exists and are deleted with it.</li>
        <li>A sign-in lasts 30 days. zq sign-ins expire after 90 days.</li>
        <li>Database backups can hold deleted data for up to 7 days. After that it is gone.</li>
      </ul>

      <h2>Cookies</h2>
      <p>We use one sign-in cookie to keep you signed in, plus privacy-friendly analytics from Vercel.</p>

      <h2>Deleting your data</h2>
      <p>
        In Settings, under Account &amp; data, you can delete your workspace data or your whole account.
        Under Terminal, you can revoke zq sign-ins. Deleting your account removes your sign-in details,
        tokens and content.
      </p>

      <h2>Security</h2>
      <p>
        Passwords are salted and hashed. zq tokens are stored only as hashes and expire after 90 days.
        Files are private and only readable through your signed-in session.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or requests: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </StaticPage>
  )
}
