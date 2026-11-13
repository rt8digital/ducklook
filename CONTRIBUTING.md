# Contributing to DuckLook

Thanks for helping build a local-first mail client. This guide covers the development workflow, the parts of the codebase you will touch most, and what we look for in a pull request.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

You do not need to write code to help:

- Report a reproducible bug or a confusing UX moment
- Improve the README, setup notes, or provider-specific guidance
- Test DuckLook against a provider or protocol we do not cover
- Triage issues and reproduce reports
- Suggest a focused feature with a clear use case
- Improve accessibility, keyboard navigation, or error messages

For larger changes, open an issue first so we can agree on scope before you invest time.

## Development setup

### Requirements

- Node.js 20.19+ (Node 22 LTS recommended)
- npm 10+
- Native build toolchain for `better-sqlite3`:
  - Windows: Visual Studio Build Tools with "Desktop development with C++"
  - macOS: Xcode Command Line Tools
  - Linux: `build-essential`, `python3`, and Electron runtime libraries

### Get running

```bash
git clone https://github.com/rt8digital/ducklook.git
cd ducklook
npm install
npm run dev
```

`npm run dev` builds the Electron main/preload bundles, waits for Vite on `http://localhost:5173`, and launches Electron. Renderer changes hot-reload. Main-process changes require restarting `npm run dev`.

Go to **Settings → Accounts** to add a mailbox. Use a test mailbox or provider app password while developing. Never commit real credentials or personal mail.

## Before you open a pull request

Run all three checks from the repository root:

```bash
npm run lint      # TypeScript
npm run test:api  # Electron integration test, no network required
npm run build     # production renderer + Electron bundles
```

If your change affects packaging, also run:

```bash
npm run package:dir
```

The unpacked app is written to `release/win-unpacked/` on Windows.

## Architecture in one minute

```text
React renderer (src/)
  └─ src/utils/api.ts → window.ducklookApi
       └─ electron/preload.ts (contextBridge)
            └─ IPC "api:invoke"
                 └─ electron/main.ts
                      └─ server/api.ts → SQLite / IMAP / POP3 / SMTP
```

- **Renderer code** never imports Node or Electron modules. It calls `window.ducklookApi.invoke(...)` through `src/utils/api.ts`.
- **Preload code** is the only bridge. Keep the exposed surface small and typed.
- **Main-process code** owns the database, credentials, filesystem, and network clients.
- **Service layer** (`server/api.ts`) dispatches API paths and returns plain serializable objects.
- **Protocol clients** live in `server/protocols/`. They should degrade gracefully and return useful sync warnings rather than crashing the app.
- **No localhost HTTP server.** Please do not add one; use IPC.

Shared types belong in `src/types.ts` when the renderer needs them. Server-only types live in `server/types.ts`.

### Adding an API endpoint

1. Add the handler to `server/api.ts`.
2. Register the route in `handleApiCall`.
3. Add a typed wrapper in `src/utils/api.ts`.
4. Cover the happy path and an error path in `scripts/api-test-entry.ts` where practical.
5. Update the README if the endpoint changes setup or user-visible behavior.

### Adding a mail provider preset

Presets live in `src/components/WelcomeView.tsx` and `src/components/SettingsModal.tsx`. Include the protocol, hosts, ports, and security mode. Prefer TLS defaults, and mention any app-password requirement in the PR.

### Database changes

The schema lives in `server/db.ts`. Keep migrations additive and idempotent with `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE` guards, because existing users keep their database across upgrades. Never destroy user data implicitly. Add a test in `scripts/api-test-entry.ts` when the change affects persisted behavior.

### Security-sensitive changes

- Keep `contextIsolation`, `sandbox`, and `nodeIntegration` settings as-is unless the change is specifically about hardening them.
- Do not log passwords, tokens, full message bodies, or attachment contents.
- Continue using `safeStorage` for credentials.
- Sanitize any HTML before rendering.
- External URLs should open in the system browser, not in-app.
- Report vulnerabilities privately per [SECURITY.md](SECURITY.md), not in a public issue.

## Coding style

- TypeScript everywhere; avoid `any` unless there is a documented reason.
- Match the formatting and naming of the surrounding file.
- Prefer small, focused components over broad refactors.
- Keep renderer state in React; keep privileged work in the main process.
- Treat API responses as untrusted at the renderer boundary.
- Use clear user-facing errors. "Sync failed" is less useful than "Could not connect to imap.example.com:993 — check the host and TLS setting."
- Do not add dependencies casually. Explain why an existing dependency cannot do the job.

There is no separate formatter or linter config today; `npm run lint` is the source of truth for type correctness. Keep diffs readable.

## Commit messages

Use short, imperative subjects, optionally with a conventional prefix:

```text
feat: add Fastmail POP3 preset
fix: keep draft attachments after reconnect
docs: clarify Gmail app-password setup
refactor: isolate message search query builder
test: cover rule persistence
```

One logical change per commit is ideal. Do not mix formatting-only churn with behavior changes.

## Pull requests

A good PR:

- Explains **what changed and why**, not just which files moved
- Links the issue it closes (`Closes #123`)
- Includes reproduction steps or a short recording for UI changes
- Adds or updates tests for behavior changes
- Updates docs when setup, configuration, or user-visible behavior changes
- Keeps unrelated refactors out of the diff
- Passes lint, API tests, and build

Draft PRs are welcome for early feedback. Maintainers may ask for changes or suggest splitting a large PR.

## Reporting bugs

Use the bug report template and include:

- DuckLook version or commit
- Operating system and version
- Mail provider/protocol (do not include credentials)
- Steps to reproduce
- Expected vs actual behavior
- Console output or a screenshot if it helps
- Whether the issue happens with `npm run dev`, a packaged build, or both

Please redact email addresses, passwords, app passwords, server hostnames if sensitive, and message contents.

## Feature requests

Describe the problem and the workflow you want. Concrete examples ("I want to triage 200 messages with the keyboard") are more useful than a solution-only request. Check the roadmap and existing issues first.

## Community

Be kind, assume good intent, and keep discussion technical. Harassment and exclusionary behavior are not tolerated. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
