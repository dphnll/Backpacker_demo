const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadModule() {
  return import(pathToFileURL(path.join(
    __dirname,
    "../supabase/functions/_shared/link-intake/controlled-fetch.mjs",
  )));
}

function firecrawlPayload(overrides = {}) {
  return {
    success: true,
    data: {
      markdown: "Price from 20 EUR\nAddress near the river",
      html: "<html><head><script type=\"application/ld+json\">{}</script><link rel=\"canonical\" href=\"https://canonical.example/place\"></head><body>ticket location</body></html>",
      metadata: {
        sourceURL: "https://input.example/place",
        url: "https://final.example/place",
        statusCode: 200,
        contentType: "text/html; charset=utf-8",
        title: "Provider title",
        description: "Provider description",
        language: "en",
        "og:title": "OG title",
        "og:description": "OG description",
        "product:price:amount": "20",
        nested: { ignored: true },
        array: ["one", "two"],
      },
      ...overrides.data,
    },
    ...overrides,
  };
}

test("maps Firecrawl response to provider-neutral ControlledPageResult", async () => {
  const { mapFirecrawlToControlledPageResult } = await loadModule();
  const result = mapFirecrawlToControlledPageResult(firecrawlPayload(), {
    requestedUrl: "https://requested.example/place",
    fetchedAt: "2026-07-12T12:00:00.000Z",
  });

  assert.equal(result.provider, "firecrawl");
  assert.equal(result.originalUrl, "https://input.example/place");
  assert.equal(result.finalUrl, "https://final.example/place");
  assert.equal(result.statusCode, 200);
  assert.equal(result.contentType, "text/html; charset=utf-8");
  assert.equal(result.fetchedAt, "2026-07-12T12:00:00.000Z");
  assert.equal(result.title, "Provider title");
  assert.equal(result.description, "Provider description");
  assert.equal(result.canonicalUrl, "https://canonical.example/place");
  assert.equal(result.language, "en");
  assert.equal(result.availability.hasMarkdown, true);
  assert.equal(result.availability.hasHtml, true);
  assert.equal(result.availability.hasJsonLd, true);
  assert.equal(result.availability.hasOpenGraph, true);
  assert.equal(result.availability.hasCanonical, true);
  assert.equal(result.signals.price.metadata, true);
  assert.equal(result.signals.price.markdown, true);
  assert.equal(result.signals.location.markdown, true);
  assert.equal(result.signals.location.html, true);
  assert.deepEqual(result.metadata.array, ["one", "two"]);
  assert.equal(Object.hasOwn(result.metadata, "nested"), false);
});

test("does not treat provider final URL as canonical", async () => {
  const { mapFirecrawlToControlledPageResult } = await loadModule();
  const result = mapFirecrawlToControlledPageResult(firecrawlPayload({
    data: {
      html: "<html><head></head><body>plain</body></html>",
      metadata: {
        sourceURL: "https://input.example",
        url: "https://final.example",
        statusCode: 200,
        title: "Title",
      },
    },
  }));

  assert.equal(result.finalUrl, "https://final.example");
  assert.equal(result.canonicalUrl, null);
  assert.equal(result.availability.hasCanonical, false);
});

test("caps markdown and HTML for transient extraction use", async () => {
  const { mapFirecrawlToControlledPageResult } = await loadModule();
  const result = mapFirecrawlToControlledPageResult(firecrawlPayload({
    data: {
      markdown: "m".repeat(10),
      html: "h".repeat(12),
    },
  }), {
    limits: {
      markdownMaxChars: 4,
      htmlMaxChars: 5,
      metadataStringMaxChars: 1000,
    },
  });

  assert.equal(result.markdown, "mmmm");
  assert.equal(result.htmlForExtraction, "hhhhh");
  assert.equal(result.limits.markdownChars, 4);
  assert.equal(result.limits.htmlChars, 5);
  assert.equal(result.limits.truncated, true);
});

test("builds minimal Firecrawl request without user headers or cache", async () => {
  const { buildFirecrawlRequestBody } = await loadModule();
  assert.deepEqual(buildFirecrawlRequestBody("https://example.com/place", {
    timeoutMs: 9000,
    zeroDataRetention: true,
  }), {
    url: "https://example.com/place",
    formats: ["markdown", "html"],
    onlyMainContent: true,
    timeout: 9000,
    removeBase64Images: true,
    blockAds: true,
    storeInCache: false,
    zeroDataRetention: true,
  });
});

test("Firecrawl adapter uses injected key and maps response", async () => {
  const { createFirecrawlControlledFetch } = await loadModule();
  const calls = [];
  const controlledFetch = createFirecrawlControlledFetch({
    apiKey: "test-key",
    clock: () => "2026-07-12T12:00:00.000Z",
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(firecrawlPayload()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const result = await controlledFetch("https://input.example/place");

  assert.equal(result.provider, "firecrawl");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.firecrawl.dev/v2/scrape");
  assert.equal(calls[0].init.headers.Authorization, "Bearer test-key");
  assert.equal(JSON.parse(calls[0].init.body).storeInCache, false);
});

test("Firecrawl adapter maps provider errors without exposing body", async () => {
  const { createFirecrawlControlledFetch } = await loadModule();
  const controlledFetch = createFirecrawlControlledFetch({
    apiKey: "test-key",
    fetcher: async () => new Response(JSON.stringify({
      success: false,
      error: "private provider details",
    }), {
      status: 429,
      headers: { "content-type": "application/json" },
    }),
  });

  await assert.rejects(
    controlledFetch("https://input.example/place"),
    (error) => error.code === "PROVIDER_RATE_LIMITED"
      && error.message === "Firecrawl request failed"
      && error.detail.status === 429,
  );
});

test("Firecrawl adapter requires API key from environment layer", async () => {
  const { ControlledFetchError, createFirecrawlControlledFetch } = await loadModule();
  assert.throws(
    () => createFirecrawlControlledFetch(),
    (error) => error instanceof ControlledFetchError
      && error.code === "PROVIDER_NOT_CONFIGURED",
  );
});
