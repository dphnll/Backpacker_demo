"use strict";

const DEFAULT_LIMITS = Object.freeze({
  timeoutMs: 12000,
  markdownMaxChars: 12000,
  htmlMaxChars: 250000,
  metadataStringMaxChars: 1000,
});

const DEFAULT_FIRECRAWL_ENDPOINT = "https://api.firecrawl.dev/v2/scrape";

class ControlledFetchError extends Error {
  constructor(code, message, detail = null) {
    super(message || code);
    this.name = "ControlledFetchError";
    this.code = code;
    this.detail = detail;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function capText(value, maxChars) {
  if (typeof value !== "string" || !value) {
    return { value: null, chars: 0, truncated: false };
  }
  if (value.length <= maxChars) {
    return { value, chars: value.length, truncated: false };
  }
  return { value: value.slice(0, maxChars), chars: maxChars, truncated: true };
}

function normalizeMetadataValue(value, maxStringChars) {
  if (value === null) return null;
  if (typeof value === "string") return value.slice(0, maxStringChars);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .filter((entry) => typeof entry === "string")
      .slice(0, 20)
      .map((entry) => entry.slice(0, maxStringChars));
  }
  return undefined;
}

function normalizeMetadata(metadata, limits = DEFAULT_LIMITS) {
  if (!metadata || typeof metadata !== "object") return {};
  return Object.fromEntries(
    Object.entries(metadata)
      .map(([key, value]) => [key, normalizeMetadataValue(value, limits.metadataStringMaxChars)])
      .filter(([, value]) => value !== undefined),
  );
}

function hasJsonLd(html) {
  return /application\/ld\+json/i.test(String(html || ""));
}

function hasOpenGraph(metadata) {
  return Object.keys(metadata || {}).some((key) => key.toLowerCase().startsWith("og"));
}

function extractCanonicalFromHtml(html) {
  const text = String(html || "");
  const match = text.match(/<link\b[^>]*rel=["'][^"']*\bcanonical\b[^"']*["'][^>]*>/i);
  if (!match) return null;
  return firstString((match[0].match(/\bhref=["']([^"']+)["']/i) || [])[1]);
}

function getExplicitCanonical(metadata, html) {
  return firstString(
    metadata?.canonical,
    metadata?.canonicalUrl,
    metadata?.["canonical:url"],
    metadata?.["twitter:url"],
    extractCanonicalFromHtml(html),
  );
}

function hasCanonical(metadata, html) {
  return Boolean(getExplicitCanonical(metadata, html));
}

function hasSignalInKeys(metadata, patterns) {
  return Object.keys(metadata || {}).some((key) => {
    const normalized = key.toLowerCase();
    return patterns.some((pattern) => pattern.test(normalized));
  });
}

function hasSignalInText(text, patterns) {
  const normalized = String(text || "").toLowerCase();
  return patterns.some((pattern) => pattern.test(normalized));
}

function getPriceSignals(metadata, markdown, html) {
  const patterns = [
    /price/,
    /offer/,
    /currency/,
    /amount/,
    /cost/,
    /tariff/,
    /ticket/,
    /admission/,
    /fromprice/,
    /lowprice/,
    /highprice/,
  ];
  return {
    metadata: hasSignalInKeys(metadata, patterns),
    markdown: hasSignalInText(markdown, patterns),
    html: hasSignalInText(html, patterns),
  };
}

function getLocationSignals(metadata, markdown, html) {
  const patterns = [
    /address/,
    /location/,
    /geo/,
    /latitude/,
    /longitude/,
    /street/,
    /postal/,
    /locality/,
    /region/,
    /country/,
  ];
  return {
    metadata: hasSignalInKeys(metadata, patterns),
    markdown: hasSignalInText(markdown, patterns),
    html: hasSignalInText(html, patterns),
  };
}

function normalizeWarnings(...values) {
  return values
    .flat()
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim().slice(0, 200));
}

function mapFirecrawlToControlledPageResult(payload, options = {}) {
  const requestedUrl = options.requestedUrl || "";
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  const data = payload?.data && typeof payload.data === "object" ? payload.data : {};
  const rawMetadata = data.metadata && typeof data.metadata === "object" ? data.metadata : {};
  const rawHtml = typeof data.html === "string" ? data.html : data.rawHtml;

  const markdown = capText(data.markdown, limits.markdownMaxChars);
  const html = capText(rawHtml, limits.htmlMaxChars);
  const metadata = normalizeMetadata(rawMetadata, limits);
  const canonicalUrl = getExplicitCanonical(rawMetadata, html.value);
  const title = firstString(rawMetadata.title, rawMetadata.ogTitle, rawMetadata["og:title"]);
  const description = firstString(
    rawMetadata.description,
    rawMetadata.ogDescription,
    rawMetadata["og:description"],
  );

  return {
    provider: "firecrawl",
    originalUrl: firstString(rawMetadata.sourceURL, requestedUrl),
    finalUrl: firstString(rawMetadata.url),
    statusCode: typeof rawMetadata.statusCode === "number" ? rawMetadata.statusCode : null,
    contentType: firstString(rawMetadata.contentType),
    fetchedAt: options.fetchedAt || nowIso(),
    title,
    description,
    canonicalUrl,
    language: firstString(rawMetadata.language),
    markdown: markdown.value,
    htmlForExtraction: html.value,
    metadata,
    availability: {
      hasMarkdown: Boolean(markdown.value),
      hasHtml: Boolean(html.value),
      hasJsonLd: hasJsonLd(html.value),
      hasOpenGraph: hasOpenGraph(rawMetadata),
      hasCanonical: hasCanonical(rawMetadata, html.value),
    },
    signals: {
      price: getPriceSignals(rawMetadata, markdown.value, html.value),
      location: getLocationSignals(rawMetadata, markdown.value, html.value),
    },
    limits: {
      markdownChars: markdown.chars,
      htmlChars: html.chars,
      truncated: markdown.truncated || html.truncated,
    },
    warnings: normalizeWarnings(data.warning, rawMetadata.warning, rawMetadata.error, payload?.error),
  };
}

function buildFirecrawlRequestBody(url, options = {}) {
  return {
    url,
    formats: ["markdown", "html"],
    onlyMainContent: true,
    timeout: options.timeoutMs || DEFAULT_LIMITS.timeoutMs,
    removeBase64Images: true,
    blockAds: true,
    storeInCache: false,
    zeroDataRetention: options.zeroDataRetention === true,
  };
}

function mapFirecrawlHttpError(status) {
  if (status === 401 || status === 403) return "PROVIDER_AUTH_FAILED";
  if (status === 408 || status === 504) return "FETCH_TIMEOUT";
  if (status === 413) return "CONTENT_TOO_LARGE";
  if (status === 429) return "PROVIDER_RATE_LIMITED";
  return "PROVIDER_ERROR";
}

function createFirecrawlControlledFetch(options = {}) {
  const apiKey = options.apiKey;
  const fetcher = options.fetcher || fetch;
  const endpoint = options.endpoint || DEFAULT_FIRECRAWL_ENDPOINT;
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  const clock = options.clock || nowIso;

  if (!apiKey) {
    throw new ControlledFetchError("PROVIDER_NOT_CONFIGURED", "Firecrawl API key is missing");
  }

  return async function controlledFetch(url, requestOptions = {}) {
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildFirecrawlRequestBody(url, {
        timeoutMs: requestOptions.timeoutMs || limits.timeoutMs,
        zeroDataRetention: requestOptions.zeroDataRetention,
      })),
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      throw new ControlledFetchError("PROVIDER_ERROR", "Firecrawl returned non-JSON response");
    }

    if (!response.ok || payload.success === false) {
      throw new ControlledFetchError(
        mapFirecrawlHttpError(response.status),
        "Firecrawl request failed",
        { status: response.status },
      );
    }

    return mapFirecrawlToControlledPageResult(payload, {
      requestedUrl: url,
      fetchedAt: clock(),
      limits,
    });
  };
}

export {
  ControlledFetchError,
  DEFAULT_LIMITS,
  buildFirecrawlRequestBody,
  createFirecrawlControlledFetch,
  mapFirecrawlToControlledPageResult,
};
