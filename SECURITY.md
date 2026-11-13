# Security Policy

DuckLook handles email credentials and private message content. We take security reports seriously and appreciate responsible disclosure.

## Supported versions

DuckLook is pre-1.0. Security fixes land on the default branch and in the next release. There are no long-term support branches yet.

| Version | Supported |
| --- | --- |
| Latest release / `main` | Yes |
| Older builds | Best effort |

## Reporting a vulnerability

**Please do not open a public GitHub issue for a security vulnerability.**

If the repository has GitHub private vulnerability reporting enabled, use **Security → Report a vulnerability**. Otherwise, contact the maintainers privately through the address listed on the repository profile or open a minimal public issue asking for a private channel — without technical details or reproduction steps.

Please include:

- A description of the issue and its impact
- Affected commit, release, or platform
- Reproduction steps or a proof of concept
- Any suggested fix or mitigation

We will acknowledge receipt as soon as possible, investigate, and coordinate a fix and disclosure timeline with you. Please give us reasonable time before publishing details.

## Scope

Examples of in-scope issues:

- Credential leakage or insecure credential storage
- Renderer sandbox / IPC escape or privilege escalation
- HTML email injection leading to script execution
- Path traversal in attachment saving
- Remote code execution or arbitrary file write
- TLS / certificate validation bypass in mail protocols
- Sensitive data included in logs or crash output

Out of scope:

- Missing code signing or SmartScreen warnings on unsigned builds
- Vulnerabilities in dependencies without a practical impact on DuckLook (report those upstream too)
- Social engineering or physical access attacks
- Denial of service from extremely large local mailboxes
- Issues that require an already-compromised machine or OS account

## Security design notes

- Renderer: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Narrow preload bridge (`window.ducklookApi`)
- Credentials encrypted with Electron `safeStorage` when the OS keychain is available
- HTML sanitized with DOMPurify before rendering
- External navigation handed to the system browser
- No telemetry or DuckLook-operated servers

## Dependency updates

Dependabot or maintainers may open dependency update PRs. Security-relevant updates are prioritized. If you believe a dependency advisory affects DuckLook, include the advisory ID and the code path that reaches it.
