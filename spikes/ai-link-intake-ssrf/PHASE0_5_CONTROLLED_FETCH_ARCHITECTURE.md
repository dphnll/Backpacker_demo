# AI Link Intake Phase 0.5 — Controlled Fetch Architecture

Date: 2026-07-12  
Scope: architecture decision only. No UI, AI extraction, ItemDraft implementation, production Edge Function, crawler, headless browser, commit, push, or deploy.

## Decision summary

Recommended MVP path:

```text
Backpacker client
→ Supabase Edge Function link-intake
→ controlledFetch interface
→ managed controlled fetch / extraction provider
→ extraction
→ AI normalization
→ ItemDraft
→ user confirmation
→ ordinary TripItem
```

Recommended provider to pilot first: **Firecrawl scrape API**, used narrowly for a single URL with `formats: ["markdown", "html"]`, short timeout, no crawl, no batch, no screenshots, no actions, no PDF parsing in MVP, no cache if configurable.

Why: it is the fastest route to validate the product hypothesis with acceptable MVP security. It moves the risky arbitrary-URL network fetch out of Supabase Edge, gives clean markdown/html/metadata, has explicit scrape formats and timeouts, and has a free tier large enough for early smoke. Backpacker still keeps its own URL policy, rate limits, privacy filtering, HTML cleanup, and schema-bound AI layer.

Important caveat: a third-party provider reduces Backpacker-side SSRF exposure, but it does not eliminate the need to confirm the provider's own private-network protections contractually or through security docs before scale. For MVP, this is still preferable to direct Edge fetch with known DNS rebinding residual risk.

## Candidate sources checked

- Firecrawl docs/pricing:
  - `https://docs.firecrawl.dev/features/scrape`
  - `https://docs.firecrawl.dev/api-reference/endpoint/scrape`
  - `https://www.firecrawl.dev/pricing`
- Microlink docs/pricing:
  - `https://microlink.io/docs/api/getting-started/overview`
  - `https://microlink.io/pricing`
- Jina Reader docs/pricing:
  - `https://jina.ai/reader/`

## Option 1. Managed controlled fetch / extraction provider

### Provider candidates

| Provider | Fit for Backpacker MVP | Useful capabilities | Cost signal | Main concern |
|---|---|---|---|---|
| Firecrawl | Best initial fit | Single URL scrape; markdown; cleaned HTML; raw HTML; metadata; structured JSON option; timeout; no-code quick test | Free 1,000 credits/month; scrape 1 credit/page; Hobby $16/month yearly for 5,000 pages | URL/page content goes to vendor; ZDR is Enterprise; security posture must be accepted |
| Microlink | Good for metadata-first fallback | URL to structured metadata; markdown; screenshots/PDF/browser automation available but should be disabled for MVP | Free 25 req/day; Pro $49/month for 46k req/month | Product is browser/API oriented; more surface than MVP needs; custom headers/proxies must be avoided |
| Jina Reader | Good cheapest reader fallback | `r.jina.ai` turns URL into LLM-friendly text; browser rendering; high free/API-key rate limits | Basic usage free; Reader 20 RPM without key, 500 RPM with free key | Less control over raw HTML/JSON-LD; SSRF guarantees not visible in docs; output is already transformed |

### Evaluation

- SSRF protection: best practical MVP option because arbitrary URL fetch is delegated outside Backpacker infrastructure; still requires vendor assurance and Backpacker-side pre-validation.
- DNS rebinding / TOCTOU: removed from Supabase Edge runtime as Backpacker's direct network risk; transferred to provider.
- Redirect handling: provider handles redirects; Backpacker should still reject unsupported original URLs and treat provider final URL as non-persistent.
- Timeout: provider timeout plus Edge endpoint timeout.
- Response size limits: provider output should be capped by request options when available; Edge must cap provider response bytes too.
- Content extraction: strongest with Firecrawl, adequate with Microlink/Jina for metadata/markdown.
- JSON-LD / Open Graph / raw HTML: Firecrawl supports metadata and HTML/rawHtml formats; Microlink returns structured metadata; Jina returns transformed reader text, less suitable for JSON-LD extraction.
- Privacy: URL and fetched page content leave Backpacker and go to provider. Do not send user ID, trip data, participants, preferences, aiSourceText, or existing cards.
- Cost: low for MVP. Firecrawl free tier likely enough for early smoke; Microlink free tier is small but Pro is predictable; Jina is cheapest/lightest but less controlled.
- Rate limits: provider limit plus Backpacker per-user limits. Keep Backpacker MVP at 3/minute, 20/day per user.
- Integration complexity: low; one server call inside Edge Function.
- Vendor lock-in: medium. Mitigate with `controlledFetch` interface and provider-normalized response.
- DevOps burden: low.
- Site limitations: public pages only; no login; no paywall/captcha bypass; no batch; no background refresh; no headless/browser actions in MVP.

## Option 2. Own egress proxy

Own egress proxy means a small dedicated backend/service, not Supabase Edge, responsible only for controlled fetch. It can be deployed where we control DNS, socket connection, IP pinning, network firewall, and logging.

### Evaluation

- SSRF protection: strongest if implemented with connection-time private range blocking, DNS A/AAAA validation, IP pinning, and egress firewall deny rules.
- DNS rebinding / TOCTOU: can be handled properly by resolving once, connecting to the validated IP, preserving original hostname for TLS SNI/certificate validation, and blocking private networks at firewall level.
- Redirect handling: fully controlled.
- Timeout: fully controlled.
- Response size limits: fully controlled with streaming cancellation.
- Content extraction: custom; starts with raw HTML only unless we add parsing.
- JSON-LD / Open Graph / raw HTML: raw HTML available; JSON-LD/OG extraction can be deterministic.
- Privacy: no third-party extraction provider sees URL/content, but URL/content reaches our infrastructure and must be protected from logs/storage.
- Cost: higher than managed provider at MVP scale. Infra plus maintenance likely costs more than provider experimentation.
- Rate limits: fully controlled.
- Integration complexity: medium/high. Need deploy, monitoring, secrets, CI, abuse controls, dependency patching.
- Vendor lock-in: low.
- DevOps burden: high for Backpacker right now.
- Site limitations: without headless browser, still initial HTML only. Anti-bot/captcha/paywall not supported.

### When to choose

Choose this after product validation if:

- link intake becomes core/high-volume;
- privacy expectations rise;
- provider terms/costs become uncomfortable;
- we need stronger formal SSRF guarantees than a provider can document;
- we need custom extraction behavior provider cannot support.

## Option 3. Direct Supabase Edge fetch with accepted residual risk

This is the Phase 0 spike implementation path: validate URL/DNS, then fetch directly from Supabase Edge.

### Evaluation

- SSRF protection: decent policy layer, not a complete boundary.
- DNS rebinding / TOCTOU: known residual risk. `Deno.resolveDns` can validate records, but `fetch(url)` performs its own connection and cannot pin the checked IP.
- Redirect handling: feasible manually.
- Timeout: feasible.
- Response size limits: feasible with stream counting.
- Content extraction: raw HTML available.
- JSON-LD / Open Graph / raw HTML: fully available.
- Privacy: no extraction provider sees URL/content; Supabase Edge runtime and logs must be controlled.
- Cost: lowest direct vendor cost.
- Rate limits: fully controlled in app.
- Integration complexity: low/medium.
- Vendor lock-in: low.
- DevOps burden: low.
- Site limitations: initial HTML only; no JS-rendered content unless adding headless/browser, which is out of scope.

### Decision

Not recommended by default. Accept only if Backpacker explicitly decides that MVP speed/cost outweighs DNS rebinding residual risk.

## Recommended target architecture

```text
Backpacker client
→ link-intake Edge Function
→ authenticate Supabase anonymous user
→ per-user rate limit
→ validate original URL with local SSRF policy
→ controlledFetch(request)
→ normalize fetched document
→ deterministic extraction: JSON-LD / Open Graph / meta / limited text
→ schema-bound AI normalization
→ ItemDraft response
→ user edits and confirms
→ ordinary TripItem
```

Provider-specific code must stop at `controlledFetch`. Extraction must consume only Backpacker's normalized `FetchedDocument`.

## `controlledFetch` interface

```ts
type ControlledFetchRequest = {
  url: string;
  accept: "html";
  timeoutMs: number;
  maxBytes: number;
  maxRedirects: number;
  cache: "none";
};

type ControlledFetchDocument = {
  originalUrl: string;
  finalUrl: string | null;
  status: number;
  contentType: string;
  bytesRead: number;
  bodyText: string;
  metadata?: {
    title?: string | null;
    description?: string | null;
    ogTitle?: string | null;
    ogDescription?: string | null;
    ogSiteName?: string | null;
    canonicalUrl?: string | null;
  };
  provider: "firecrawl" | "microlink" | "jina-reader" | "own-proxy" | "direct-edge";
  warnings: string[];
};

type ControlledFetchErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_PROTOCOL"
  | "BLOCKED_ADDRESS"
  | "DNS_RESOLUTION_FAILED"
  | "REDIRECT_BLOCKED"
  | "TOO_MANY_REDIRECTS"
  | "REDIRECT_LOOP"
  | "FETCH_TIMEOUT"
  | "PAGE_UNAVAILABLE"
  | "UNSUPPORTED_CONTENT"
  | "CONTENT_TOO_LARGE"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_ERROR";
```

Rules:

- `controlledFetch` never creates ItemDraft.
- `controlledFetch` never calls AI.
- `controlledFetch` never stores raw HTML.
- `controlledFetch` never logs URL/domain/content.
- `originalUrl` is the only URL that can later become `TripItem.link`, and only after user confirmation.
- `finalUrl` is request-local diagnostic data; do not persist by default.
- Provider output must be re-capped and normalized before extraction.

## What to keep from Phase 0 SSRF spike

Keep:

- `spikes/ai-link-intake-ssrf/PHASE0_REPORT.md`
- `spikes/ai-link-intake-ssrf/ssrf-policy.js`
- `spikes/ai-link-intake-ssrf/ssrf-policy.test.js`
- the test matrix as a reusable acceptance suite for any direct or own-proxy implementation

Use the policy even with a provider:

- original URL pre-validation;
- protocol restrictions;
- hostname restrictions;
- analytics/logging guardrails;
- error taxonomy.

## What to delete

Delete before production work:

- `supabase/functions/link-intake-ssrf-spike/index.ts`

It was a temporary runtime probe. It has already been deleted from Supabase and should not become production code.

## Go / No-go for Phase 1 extraction layer

Go for Phase 1 with this boundary:

- implement extraction behind `controlledFetch`;
- use Firecrawl as the first managed provider candidate for a very small MVP spike;
- keep Microlink and Jina Reader as fallback candidates, not parallel integrations;
- do not implement UI yet;
- do not call AI yet unless Phase 1 scope is explicitly expanded;
- do not create ItemDraft/TripItem yet;
- keep provider key server-side only;
- keep URL/content out of analytics and durable logs;
- cap output and fail closed.

No-go for Phase 1 if the intended implementation is direct Supabase Edge fetch without explicit acceptance of DNS rebinding residual risk.

## Next Phase 1 slice

Minimal safe Phase 1 should produce:

- `link-intake` Edge Function skeleton behind JWT;
- server-side per-user rate limit placeholder or real minimal table/RPC;
- provider-backed `controlledFetch`;
- deterministic extraction only:
  - JSON-LD;
  - Open Graph;
  - standard meta;
  - limited cleaned text;
- no AI;
- no UI;
- test fixtures for provider-normalized documents;
- provider disabled by config when key is missing.
