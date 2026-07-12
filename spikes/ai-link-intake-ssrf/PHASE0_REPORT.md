# AI Link Intake Phase 0 — SSRF Spike Report

Date: 2026-07-11  
Scope: SSRF feasibility spike only. No UI, AI extraction, ItemDraft preview, TripItem creation, analytics, production release, or production Edge Function changes.

## A. Runtime support

Tested runtime through temporary Supabase Edge Function `link-intake-ssrf-spike`.

- Supabase project: `dzypqopspfuingvistkm`
- Runtime: `supabase-edge-runtime-1.74.2`, compatible with Deno `v2.1.4`
- `Deno.resolveDns`: supported
- `fetch(..., { redirect: "manual" })`: supported, returns 3xx response without following redirect
- `AbortController`: supported and aborts slow fetches
- `AbortSignal.timeout`: supported
- `ReadableStream` / `response.body.getReader()`: supported
- Streaming size limit: feasible, stream can be cancelled after limit
- Missing `Content-Length`: feasible to handle by streaming and counting bytes

Observed runtime details:

- `https://example.com/`: A and AAAA records resolved; HTML fetched; body streamed.
- `https://httpbin.org/redirect-to?...`: 302 returned with `location`, `redirected=false`.
- `https://www.w3.org/.../dummy.pdf`: PDF returned with `application/pdf`; binary content is detectable.
- `https://httpbin.org/stream-bytes/90000?...`: body streamed without `Content-Length`; limit exceeded and stream cancellation worked.
- `https://httpbin.org/delay/10`: fetch aborted at ~6000 ms.
- Nonexistent DNS target: DNS errors are catchable.

## B. SSRF checks implemented in spike

Implemented in `ssrf-policy.js`:

- URL normalization.
- `https:` only.
- URL length limit.
- IP literal URL rejection.
- `localhost` / `.localhost` / `.local` / `.internal` / `.localdomain` hostname rejection.
- Cloud metadata hostname rejection for common names.
- IPv4 blocking:
  - loopback;
  - private;
  - link-local;
  - shared address space;
  - documentation ranges;
  - benchmark/inter-network ranges;
  - multicast;
  - reserved/future ranges;
  - cloud metadata address `169.254.169.254`.
- IPv6 blocking:
  - unspecified;
  - loopback;
  - unique local;
  - link-local;
  - multicast;
  - documentation;
  - IPv4-mapped private/metadata addresses.
- DNS resolution through injectable resolver.
- Mixed public/private DNS answers blocked.
- DNS error normalized to `DNS_RESOLUTION_FAILED`.
- Manual redirect handling.
- Maximum 3 redirects.
- Full URL/DNS/address validation for every redirect target.
- Redirect loop detection.
- Unsupported redirect protocol rejection.
- Per-fetch timeout.
- Total timeout hook.
- Supported content type allowlist: `text/html`, `application/xhtml+xml`.
- PDF/binary/missing content type rejection.
- `Content-Length` pre-check.
- Streaming body size limit independent of `Content-Length`.

## C. Checks without sufficient guarantee

The main gap is DNS rebinding / DNS race.

The Edge runtime allows `Deno.resolveDns(hostname, "A" | "AAAA")`, but ordinary `fetch(url)` does not let us pin the already-validated IP address while preserving the original hostname for TLS/SNI and certificate validation. Therefore the actual network connection can perform a second DNS resolution after the pre-check.

This means direct Edge Function implementation can reduce SSRF risk significantly, but cannot fully prove that the IP checked by `resolveDns` is the IP used by `fetch`.

Other notes:

- Supabase Edge does not expose a built-in egress denylist/network policy in this app setup.
- AAAA "no records" is returned as a DNS error for that family; implementation must treat A and AAAA independently and fail only when both families fail or any returned address is blocked.
- Direct fetch to private targets was not performed against production infrastructure during the spike. Private/internal blocking was tested in the policy layer.

## D. Test results

Local Node matrix:

```text
node --test spikes/ai-link-intake-ssrf/ssrf-policy.test.js
tests 10
pass 10
fail 0
```

Covered cases:

- invalid and unsupported protocols;
- localhost;
- IPv4/IPv6 IP literals;
- private IPv4;
- private IPv6;
- IPv4-mapped IPv6;
- cloud metadata address;
- DNS empty answer;
- DNS error;
- mixed public/private DNS answers;
- redirect revalidation;
- redirect to private IP;
- redirect to unsupported protocol;
- redirect loop;
- more than 3 redirects;
- per-fetch timeout;
- chunked oversized body without `Content-Length`;
- oversized `Content-Length`;
- PDF/binary content type.

Live Edge runtime probes:

```text
Temporary function deployed: link-intake-ssrf-spike
Temporary function deleted after probes.
Remaining deployed functions: trip-share, trip-draft-ai
```

Runtime probes passed for:

- DNS A and AAAA on `example.com`;
- manual redirect behavior on `httpbin.org`;
- PDF content-type detection;
- streaming read and cancellation;
- slow response abort;
- DNS error handling.

## E. Residual risks

- DNS rebinding / TOCTOU remains if production uses direct `resolveDns` then `fetch`.
- No IP pinning for TLS fetch in Supabase Edge runtime.
- No runtime-level private-network egress block confirmed.
- Public endpoints must require JWT and server-side rate limits before any production use.
- URL and page content must not be logged; errors should use bucketed codes only.
- Anti-bot/captcha/paywall pages should fail closed.
- Redirect targets need the same full validation as the original URL.

## F. Go / No-go

### Own Supabase Edge Function

Decision: conditional No-go as the sole SSRF boundary.

Reason: the runtime supports the mechanics needed for controlled fetch, but cannot provide a strong DNS rebinding guarantee because checked DNS records cannot be pinned to the actual `fetch` connection.

It may be acceptable only if the product explicitly accepts this residual risk and adds compensating controls:

- strict allowlist-style URL and address validation;
- JWT;
- per-user rate limits;
- no raw URL/content logs;
- small size/time limits;
- no headless browser;
- aggressive fail-closed behavior.

### Controlled provider / egress proxy

Decision: Go / recommended for production-grade SSRF boundary.

The safer production architecture is a controlled fetch provider or egress proxy that can enforce network-level private range blocking at connection time.

### Stop epic

Decision: No.

The epic can continue, but Phase 1 should be designed behind a `controlledFetch` boundary so the fetch implementation can be swapped to provider/proxy without rewriting extraction.

## G. Spike files

- `spikes/ai-link-intake-ssrf/ssrf-policy.js`
- `spikes/ai-link-intake-ssrf/ssrf-policy.test.js`
- `spikes/ai-link-intake-ssrf/PHASE0_REPORT.md`
- `supabase/functions/link-intake-ssrf-spike/index.ts`

## H. What can be deleted after decision

Safe to delete after the architecture decision:

- `supabase/functions/link-intake-ssrf-spike/index.ts`

Optional to keep as Phase 1 starting point:

- `spikes/ai-link-intake-ssrf/ssrf-policy.js`
- `spikes/ai-link-intake-ssrf/ssrf-policy.test.js`
- `spikes/ai-link-intake-ssrf/PHASE0_REPORT.md`

The deployed temporary Edge Function has already been deleted from Supabase.

## I. Phase 1 readiness

Can proceed to Phase 1 extraction layer only with one of these decisions:

1. Recommended: build extraction behind a controlled fetch interface and use a controlled provider / egress proxy for the actual network fetch.
2. Risk-accepted alternative: use direct Supabase Edge fetch with the implemented checks, documenting DNS rebinding as accepted residual risk.

Do not proceed to production release with direct Edge fetch unless the residual DNS rebinding risk is explicitly accepted.
