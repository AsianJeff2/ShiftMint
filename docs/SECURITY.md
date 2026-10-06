# Security and operating boundaries

Run one process per SQLite workspace. The hosted service requires independent JWT_SECRET, a 64-hex-character ENCRYPTION_KEY, BOOTSTRAP_TOKEN and an explicit persistent data directory. Store secrets in the hosting secret store. Never place them in VITE_* variables or source control.

The API enforces authentication, business scope and role permissions. Password changes revoke prior sessions; logout revokes the current session. Sensitive bank fields and business EIN are encrypted on writes and redacted from normal responses. Backups retain ciphertext and require the original encryption key for recovery. SQLite disk encryption is the host's responsibility; nonsensitive fields are not field-encrypted.

Browser tokens are kept in local storage by the current app. Restrictive content policy reduces the attack surface, but this is not an HttpOnly cookie session design. Treat third-party scripts and privileged desktop IPC as security boundaries. Desktop IPC checks the owning window, main frame, origin and payload.

The packaged desktop forces a production API on loopback port 3001. Every protected API request also needs a random per-launch capability supplied through trusted renderer IPC; it is not persisted in browser storage. Public health responses reveal only service availability. A normal browser cannot sign into or modify the desktop workspace through the loopback API.

Staff accounts cannot list employees or shifts because this release has no verified account-to-employee ownership mapping. Managers can manage these records and view payroll estimates; staff self-service requires a separate ownership design. UI route and navigation permissions mirror the API restrictions.

POS credentials remain server-side and encrypted. Current adapters are read-only. There are no public webhook endpoints, automatic payroll imports or Square OAuth onboarding in this release.

Do not publish databases, backup files, .env files, runtime-secrets.json or machine-specific permissions. Historical archive files are evidence, not security or production-readiness claims. See the [audit](AUDIT.md) for remaining unverified areas and dependency advisories.
