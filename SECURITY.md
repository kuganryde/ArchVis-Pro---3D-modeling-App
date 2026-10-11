# Security Policy

## Reporting a vulnerability

Email **rydetechwizsolutions@proton.me** with a description and reproduction
steps. Please do not open a public issue for security problems. We aim to
acknowledge reports within 3 business days.

## Controls in this repository

| Area | Control | Where |
|------|---------|-------|
| Transport / browser | CSP (enforced in production), HSTS, nosniff, frame-ancestors none, `x-powered-by` removed | `serverSecurity.ts` |
| Abuse | Per-IP rate limits on `/api` and a tighter limit on the paid AI routes | `serverApp.ts` |
| Input | 100 kB JSON cap (16 MB only on blueprint upload), MIME allowlist, base64 and prompt-length validation | `src/shared/validation.ts` |
| Auth | Hosted AI/billing require a verified Supabase JWT + workspace membership; the platform Gemini key is never used anonymously | `aiMetering.ts`, `serverSupabase.ts` |
| Payments | Stripe webhook is signature-verified on the raw body | `billing.ts` |
| Exports | CSV cells are escaped and spreadsheet formulas neutralised | `src/utils/csv.ts` |
| Supply chain | Lockfile-pinned `npm ci --ignore-scripts`, `npm audit` gate, CycloneDX SBOM, dependency review, Dependabot | `.github/` |
| SAST | CodeQL (`security-extended`) on every PR and weekly | `.github/workflows/codeql.yml` |

## Deployment requirements

- Set `TRUST_PROXY` to the number of reverse-proxy hops in front of the server
  (default `1` in production). A wrong value either throttles all users as one
  client (too low) or lets callers spoof their IP (too high). Never use `true`.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_*` and `GEMINI_API_KEY` server-side only.
- Roll CSP changes out with `CSP_REPORT_ONLY=true` first.

## Known gaps (tracked)

- No automated tests for Supabase Row-Level Security policies yet.
- The user's Gemini BYOK key lives in `sessionStorage` and is called directly from
  the browser; the CSP limits exfiltration but an XSS bug would still expose it.
- GitHub Actions are pinned to major tags, not commit SHAs.
- Dependency review and CodeQL result upload on a private repository require GitHub
  Advanced Security. Dependency review is skipped there unless the repository variable
  `ENABLE_DEPENDENCY_REVIEW=true` is set.
