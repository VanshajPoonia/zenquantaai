import type { Metadata } from 'next'
import { StaticPage } from '@/components/static/static-page'

export const metadata: Metadata = {
  title: 'zq: Forge in your terminal | Zenquanta AI',
  description: 'Install zq, sign in, and let Forge read, edit and run code in your project.',
}

export default function CliDocsPage() {
  return (
    <StaticPage title="zq: Forge in your terminal">
      <p>
        zq is Zenquanta&apos;s coding agent for your terminal. It reads, edits and runs code in your
        project with your Zenquanta account and plan, and your sessions show up in the web app.
      </p>

      <h2>Install</h2>
      <p>zq needs Node.js 22.19 or newer.</p>
      <pre>{`npm install -g zenquanta
zq login`}</pre>
      <p>
        <code>zq login</code> opens your browser. Check that the code matches the one in your terminal
        and approve it.
      </p>

      <h2>Models</h2>
      <p>
        zq uses Zenquanta&apos;s hosted Forge models on your plan when they are open for your account.
        Until then, it runs on your own <a href="https://openrouter.ai/keys">OpenRouter key</a>:
      </p>
      <pre>{`zq key sk-or-...   # saved on your computer, never sent to Zenquanta
zq key --clear     # remove it`}</pre>
      <p>
        With your own key, model calls go straight from your computer to OpenRouter and bill your
        OpenRouter account. Sign-in and session sync still use your Zenquanta account.
      </p>

      <h2>Use it</h2>
      <pre>{`cd your-project
zq                       # start a session
zq -c                    # continue the last session here
zq -r                    # pick a session to resume
zq -p "fix the failing test" --allow-edits`}</pre>
      <table>
        <thead>
          <tr><th>In a session</th><th>What it does</th></tr>
        </thead>
        <tbody>
          <tr><td><code>/usage</code></td><td>Your plan, tokens left and agent steps left today</td></tr>
          <tr><td><code>/model</code></td><td>Pick forge, forge-fast, forge-lite, or forge-best on Pro and up</td></tr>
          <tr><td><code>/sync on</code>, <code>/sync off</code></td><td>Turn web sync on or off for this project</td></tr>
          <tr><td><code>/permissions</code></td><td>Show the permission mode and always-allowed commands</td></tr>
        </tbody>
      </table>

      <h2>Permissions</h2>
      <p>
        By default zq asks before it edits a file or runs a shell command. Reads inside your project run
        without asking. You can allow a command for good with &quot;Yes, always allow&quot;.
      </p>
      <table>
        <thead>
          <tr><th>Mode</th><th>Edits</th><th>Shell commands</th></tr>
        </thead>
        <tbody>
          <tr><td>ask (default)</td><td>ask</td><td>ask, unless always allowed</td></tr>
          <tr><td>edits, <code>--allow-edits</code></td><td>allowed</td><td>ask, unless always allowed</td></tr>
          <tr><td>yolo, <code>--yolo</code></td><td>allowed</td><td>allowed</td></tr>
        </tbody>
      </table>
      <p>
        zq always asks before it touches <code>.env</code> files, keys, <code>.git</code> or files
        outside your project, and before risky commands like <code>sudo</code>, <code>rm -rf</code> or{' '}
        <code>git push --force</code>, unless you use <code>--yolo</code>. In print mode
        (<code>-p</code>), anything that needs approval is blocked.
      </p>

      <h2>Sync and privacy</h2>
      <p>
        Sessions appear in your web history under Forge with a terminal badge. Tool output is cut to
        4 KB and output from protected files is never sent. Turn sync off for a project with{' '}
        <code>/sync off</code>.
      </p>

      <h2>Sign out</h2>
      <pre>zq logout</pre>
      <p>You can also revoke any signed-in terminal in Settings, under Terminal.</p>

      <h2>Credits</h2>
      <p>
        zq is built on <a href="https://pi.dev">pi</a>, the MIT-licensed agent harness by Mario
        Zechner, developed at Earendil.
      </p>
    </StaticPage>
  )
}
