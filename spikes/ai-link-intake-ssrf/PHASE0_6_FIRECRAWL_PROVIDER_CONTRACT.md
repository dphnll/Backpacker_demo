# AI Link Intake Phase 0.6 — Firecrawl Provider Contract Spike

Date: 2026-07-12  
Scope: provider contract spike only. No UI, AI, ItemDraft, TripItem creation, production deploy, crawler, or headless-browser integration.

## Status

Architecture decision from Phase 0.5 is accepted:

```text
Backpacker
→ controlledFetch interface
→ managed provider
→ extraction
→ AI normalization
→ ItemDraft
→ TripItem after user confirmation
```

First managed provider candidate: Firecrawl.

Live Firecrawl probes are pending because no `FIRECRAWL_API_KEY` is available in the local environment. This spike therefore fixes the provider boundary, request shape, response mapping, privacy rules, and exact live-probe matrix to run once the key is provided. The contract below is intentionally provider-neutral, so Phase 1 extraction will not depend on Firecrawl internals.

## Firecrawl API facts from docs

Firecrawl v2 exposes:

- endpoint: `POST https://api.firecrawl.dev/v2/scrape`;
- auth: `Authorization: Bearer <token>`;
- input fields relevant to MVP:
  - `url`;
  - `formats`;
  - `onlyMainContent`;
  - `timeout`;
  - `removeBase64Images`;
  - `blockAds`;
  - `storeInCache`;
  - `zeroDataRetention`;
  - `proxy`;
  - `location`;
  - `threatProtection`.
- documented response fields include:
  - `data.markdown`;
  - `data.html`;
  - `data.rawHtml`;
  - `data.links`;
  - `data.metadata.title`;
  - `data.metadata.description`;
  - `data.metadata.language`;
  - `data.metadata.sourceURL`;
  - `data.metadata.url`;
  - `data.metadata.keywords`;
  - `data.metadata.statusCode`;
  - `data.metadata.contentType`;
  - arbitrary additional metadata keys, which is where Open Graph / canonical-like fields may appear depending on page/provider output.

Docs checked:

- `https://docs.firecrawl.dev/api-reference/endpoint/scrape`
- `https://docs.firecrawl.dev/features/scrape`
- `https://www.firecrawl.dev/pricing`

## Live probe matrix

Run once `FIRECRAWL_API_KEY` exists.

| Page type | Candidate URL | Why |
|---|---|---|
| Restaurant | `https://guide.michelin.com/us/en/new-york-state/new-york/restaurant/le-bernardin` | Restaurant metadata, description, possible price/category signals |
| Museum/place | `https://www.louvre.fr/en/visit` | Museum/destination page, canonical/OG expected |
| Excursion | `https://www.getyourguide.com/paris-l16/louvre-museum-skip-the-line-guided-tour-t395451/` | Tour-like commercial page, likely price/date complexity |
| Hotel | `https://www.marriott.com/en-us/hotels/paris-prince-de-galles-a-luxury-collection-hotel-paris/overview/` | Hotel page, likely JS-heavy and provider-dependent |

For each URL record only a sanitized shape:

- HTTP status from provider;
- `success`;
- provider status code from metadata;
- top-level data keys;
- metadata keys;
- markdown length;
- html/rawHtml availability and length, not content;
- title/description presence;
- source/final URL presence;
- canonical-like key presence;
- Open Graph-like key presence;
- JSON-LD availability if raw/html is requested and contains `application/ld+json`;
- warning/error codes.

Do not store raw markdown, raw HTML, page title, page description, URL content, or full provider response in committed files.

## Firecrawl request profile for MVP

Recommended initial request:

```json
{
  "url": "https://example.com/place",
  "formats": ["markdown", "html"],
  "onlyMainContent": true,
  "timeout": 12000,
  "removeBase64Images": true,
  "blockAds": true,
  "storeInCache": false,
  "zeroDataRetention": false
}
```

Notes:

- Use `formats: ["markdown", "html"]` for Phase 1 extraction. Markdown is likely enough for text fallback, while HTML is useful to deterministically extract JSON-LD and meta tags before AI.
- Do not request screenshots, audio, video, PDF parser, actions, interact sessions, crawl, batch scrape, or extract/JSON mode for MVP Phase 1.
- Do not pass custom headers/cookies from the user.
- Do not enable `skipTlsVerification`.
- Do not use provider features to bypass login, paywall, captcha, anti-bot, or regional restrictions.
- Keep provider call server-side only.

`zeroDataRetention` appears in the API contract, but account/plan support needs live verification before relying on it. If ZDR is not available for the chosen plan, treat Firecrawl as a third-party processor that receives URL and page content.

## Provider-neutral contract

```ts
type ControlledFetchProvider =
  | "firecrawl"
  | "microlink"
  | "jina-reader"
  | "own-proxy"
  | "direct-edge";

type ControlledPageResult = {
  provider: ControlledFetchProvider;
  originalUrl: string;
  finalUrl: string | null;

  statusCode: number | null;
  contentType: string | null;
  fetchedAt: string;

  title: string | null;
  description: string | null;
  canonicalUrl: string | null;
  language: string | null;

  markdown: string | null;
  htmlForExtraction: string | null;

  metadata: Record<string, string | number | boolean | string[] | null>;

  availability: {
    hasMarkdown: boolean;
    hasHtml: boolean;
    hasJsonLd: boolean;
    hasOpenGraph: boolean;
    hasCanonical: boolean;
  };

  limits: {
    markdownChars: number;
    htmlChars: number;
    truncated: boolean;
  };

  warnings: string[];
};
```

Rules:

- `ControlledPageResult` is not ItemDraft.
- It never contains user ID, trip ID, participant data, existing TripItems, preferencesText, aiSourceText, or analytics identifiers.
- `originalUrl` can later become `TripItem.link` only after user confirmation.
- `finalUrl` is request-local context and should not be persisted by default.
- `metadata` is allow-normalized; extraction code must not rely on provider-specific metadata key names without a mapper.
- `htmlForExtraction` is capped and only used to extract JSON-LD/meta; raw HTML is not stored.

## Firecrawl response mapping

```ts
function mapFirecrawlToControlledPageResult(input) {
  const data = input.data || {};
  const metadata = data.metadata || {};

  return {
    provider: "firecrawl",
    originalUrl: metadata.sourceURL || requestedUrl,
    finalUrl: metadata.url || null,
    statusCode: typeof metadata.statusCode === "number" ? metadata.statusCode : null,
    contentType: typeof metadata.contentType === "string" ? metadata.contentType : null,
    fetchedAt: new Date().toISOString(),

    title: firstString(metadata.title, metadata.ogTitle),
    description: firstString(metadata.description, metadata.ogDescription),
    canonicalUrl: firstString(metadata.canonical, metadata.canonicalUrl, metadata.url),
    language: typeof metadata.language === "string" ? metadata.language : null,

    markdown: capText(data.markdown, 12000),
    htmlForExtraction: capText(data.html || data.rawHtml, 250000),

    metadata: normalizeScalarMetadata(metadata),
    availability: {
      hasMarkdown: Boolean(data.markdown),
      hasHtml: Boolean(data.html || data.rawHtml),
      hasJsonLd: containsJsonLd(data.html || data.rawHtml || ""),
      hasOpenGraph: Object.keys(metadata).some((key) => key.toLowerCase().startsWith("og")),
      hasCanonical: Boolean(metadata.canonical || metadata.canonicalUrl),
    },
    limits: {
      markdownChars: Math.min(String(data.markdown || "").length, 12000),
      htmlChars: Math.min(String(data.html || data.rawHtml || "").length, 250000),
      truncated: String(data.markdown || "").length > 12000 || String(data.html || data.rawHtml || "").length > 250000,
    },
    warnings: normalizeWarnings(data.warning, metadata.error),
  };
}
```

This is contract pseudocode, not production code.

## Privacy boundary

Data sent to Firecrawl:

- public URL supplied by the user;
- provider request options;
- no Supabase user ID;
- no trip title;
- no participant names;
- no existing cards;
- no notes/preferences;
- no analytics identifiers;
- no cookies or user headers.

Data returned by Firecrawl:

- markdown/text representation;
- optional HTML/raw HTML if requested;
- metadata;
- provider warning/error/status fields;
- final/source URL fields.

Backpacker must not persist:

- raw provider response;
- raw HTML;
- raw markdown/page text;
- full provider error body;
- final resolved URL by default;
- provider logs containing URL/content.

Backpacker may keep only after user confirmation:

- fields edited/accepted by the user in TripItem;
- original source URL in `TripItem.link`.

Analytics must not include:

- URL;
- domain;
- title;
- description;
- location;
- notes;
- markdown;
- HTML;
- provider raw response.

## Is raw HTML needed?

Recommendation: yes for Phase 1 extraction, but only as capped transient input.

Markdown + metadata may be enough for many MVP pages, especially title/description/location-ish text. However, JSON-LD is usually easier and safer to extract from HTML than from markdown. Open Graph/canonical are also more deterministic from HTML/meta tags if provider metadata is incomplete or provider-specific.

Use:

- markdown as text fallback for extraction;
- metadata as first-pass title/description/source/status;
- capped HTML only for deterministic JSON-LD/Open Graph/meta/canonical extraction;
- no raw HTML storage.

If live probes show `data.html` is unavailable or too noisy on the target plan, Phase 1 can still proceed with markdown + metadata, but JSON-LD coverage will be weaker.

## Provider limitations to account for

- URL and page content go to a third party.
- ZDR/account retention needs verification.
- Firecrawl may render or transform pages differently from initial HTML.
- Metadata key names may vary by site.
- Dynamic/anti-bot/login/captcha/paywall pages may fail or return poor content.
- Provider may return markdown with missing prices/dates on commerce/tour pages.
- Provider can have rate limits, queues, 402/429/5xx, and plan-dependent features.
- Provider final URL should not become trusted/persisted automatically.
- Provider response must be capped again inside Backpacker.

## Minimal Phase 1 Go criteria

Go for Phase 1 extraction if live probes confirm:

- `markdown` is present for at least 3 of 4 page types;
- `metadata.title` or equivalent title is present for at least 3 of 4;
- description or useful markdown text is present for at least 3 of 4;
- either provider metadata or capped HTML allows canonical/OG extraction for at least 2 of 4;
- provider failures are structured enough to map to Backpacker error codes;
- no raw response needs to be stored to debug normal cases.

No-go / revisit provider if:

- most pages return empty markdown;
- HTML is unavailable and metadata is too thin;
- provider requires browser actions/cookies/custom headers for common MVP pages;
- provider cannot disable cache/retention enough for our privacy posture;
- rate/cost makes one-link-per-action MVP impractical.

## Current Go / No-go

Conditional Go for Phase 1 design:

- implement provider-neutral `controlledFetch` boundary;
- do not hard-wire Firecrawl into extraction;
- run the live probe matrix before implementing production provider adapter;
- keep direct Edge SSRF policy as pre-validation and fallback test suite;
- keep production work blocked until Firecrawl key and live response shapes are verified.

Not yet Go for production Firecrawl adapter because real response samples are pending.
