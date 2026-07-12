const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadModule() {
  return import(pathToFileURL(path.join(
    __dirname,
    "../supabase/functions/_shared/link-intake/travel-candidate.mjs",
  )));
}

function controlledPage(overrides = {}) {
  return {
    provider: "firecrawl",
    originalUrl: "https://source.example/place",
    finalUrl: "https://final.example/place",
    statusCode: 200,
    contentType: "text/html",
    fetchedAt: "2026-07-12T12:00:00.000Z",
    title: "Controlled title",
    description: "Controlled description",
    canonicalUrl: "https://canonical.example/place",
    language: "en",
    markdown: "Price from 20 EUR\nAddress: 1 River Street",
    htmlForExtraction: "",
    metadata: {
      "og:title": "OG title",
      "og:description": "OG description",
      "og:image": "https://image.example/cover.jpg",
      "product:price:amount": "25",
      "product:price:currency": "EUR",
    },
    availability: {
      hasMarkdown: true,
      hasHtml: true,
      hasJsonLd: false,
      hasOpenGraph: true,
      hasCanonical: true,
    },
    signals: {
      price: { metadata: true, markdown: true, html: false },
      location: { metadata: false, markdown: true, html: false },
    },
    limits: { markdownChars: 42, htmlChars: 0, truncated: false },
    warnings: [],
    ...overrides,
  };
}

test("extracts TravelCandidate from JSON-LD with provenance", async () => {
  const { extractTravelCandidate } = await loadModule();
  const page = controlledPage({
    htmlForExtraction: `<script type="application/ld+json">{
      "@context": "https://schema.org",
      "@type": "Event",
      "name": "JSON-LD tour",
      "description": "JSON-LD description",
      "image": "https://image.example/jsonld.jpg",
      "location": {
        "@type": "Place",
        "address": {
          "streetAddress": "1 Museum Square",
          "addressLocality": "Paris",
          "addressCountry": "FR"
        },
        "geo": { "latitude": 48.8606, "longitude": 2.3376 }
      },
      "offers": { "price": "30", "priceCurrency": "EUR" }
    }</script>`,
    availability: { hasJsonLd: true },
  });

  const candidate = extractTravelCandidate(page);

  assert.equal(candidate.schemaVersion, 1);
  assert.equal(candidate.sourceType, "link_intake");
  assert.deepEqual(candidate.source, { fetchedAt: "2026-07-12T12:00:00.000Z" });
  assert.equal(candidate.fields.title, "JSON-LD tour");
  assert.equal(candidate.fields.description, "JSON-LD description");
  assert.equal(candidate.fields.image, "https://image.example/jsonld.jpg");
  assert.deepEqual(candidate.fields.price, {
    amount: 30,
    currency: "EUR",
    text: "30",
    kind: "exact",
  });
  assert.equal(candidate.fields.location, "1 Museum Square, Paris, FR");
  assert.deepEqual(candidate.fields.geo, { latitude: 48.8606, longitude: 2.3376 });
  assert.equal(candidate.provenance.title.source, "json_ld");
  assert.equal(candidate.provenance.price.source, "json_ld");
  assert.equal(candidate.confidence.title, 0.9);
});

test("falls back to ControlledPageResult and Open Graph metadata", async () => {
  const { extractTravelCandidate } = await loadModule();
  const candidate = extractTravelCandidate(controlledPage({
    title: null,
    description: null,
    metadata: {
      "og:title": "OG title",
      "og:description": "OG description",
      "og:image": "https://image.example/og.jpg",
      "product:price:amount": "45",
      "product:price:currency": "USD",
    },
  }));

  assert.equal(candidate.fields.title, "OG title");
  assert.equal(candidate.fields.description, "OG description");
  assert.equal(candidate.fields.image, "https://image.example/og.jpg");
  assert.deepEqual(candidate.fields.price, {
    amount: 45,
    currency: "USD",
    kind: "exact",
    text: null,
  });
  assert.equal(candidate.provenance.title.source, "metadata");
  assert.equal(candidate.provenance.price.source, "metadata");
});

test("uses limited text signals for weak price and location candidates", async () => {
  const { extractTravelCandidate } = await loadModule();
  const candidate = extractTravelCandidate(controlledPage({
    metadata: {},
    markdown: "Tickets: from €18\nLocation: Old Town pier",
    htmlForExtraction: "",
    canonicalUrl: null,
  }));

  assert.deepEqual(candidate.fields.price, {
    amount: 18,
    currency: "EUR",
    kind: "from",
    text: "€18",
  });
  assert.equal(candidate.fields.location, "Old Town pier");
  assert.equal(candidate.provenance.price.source, "text_signal");
  assert.equal(candidate.provenance.price.confidence, 0.35);
  assert.equal(candidate.provenance.location.source, "text_signal");
});

test("keeps provider-specific data out of domain candidate fields", async () => {
  const { extractTravelCandidate } = await loadModule();
  const candidate = extractTravelCandidate(controlledPage(), {
    sourceType: "browser_extension",
  });

  assert.equal(candidate.sourceType, "browser_extension");
  assert.equal(candidate.fields.sourceUrl, "https://source.example/place");
  assert.equal(candidate.fields.canonicalUrl, "https://canonical.example/place");
  assert.equal(Object.hasOwn(candidate.source, "provider"), false);
  assert.equal(Object.hasOwn(candidate.fields, "provider"), false);
  assert.equal(Object.hasOwn(candidate.fields, "metadata"), false);
  assert.equal(Object.hasOwn(candidate.fields, "markdown"), false);
  assert.equal(Object.hasOwn(candidate.fields, "htmlForExtraction"), false);
});

test("does not use final URL as source URL when original URL exists", async () => {
  const { extractTravelCandidate } = await loadModule();
  const candidate = extractTravelCandidate(controlledPage({
    originalUrl: "https://original.example/link",
    finalUrl: "https://final.example/link",
    canonicalUrl: null,
  }));

  assert.equal(candidate.fields.sourceUrl, "https://original.example/link");
  assert.equal(candidate.provenance.sourceUrl.source, "controlled_page");
});

test("adds warnings for truncation and invalid advertised JSON-LD", async () => {
  const { extractTravelCandidate } = await loadModule();
  const candidate = extractTravelCandidate(controlledPage({
    htmlForExtraction: `<script type="application/ld+json">{ invalid }</script>`,
    availability: { hasJsonLd: true },
    limits: { truncated: true },
    warnings: ["PROVIDER_WARNING"],
  }));

  assert.deepEqual(candidate.warnings, [
    "PROVIDER_WARNING",
    "CONTROLLED_PAGE_TRUNCATED",
    "JSON_LD_PARSE_FAILED",
  ]);
});

test("parses JSON-LD graph arrays", async () => {
  const { extractTravelCandidate, parseJsonLdScripts } = await loadModule();
  const html = `<script type="application/ld+json">{
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", "name": "Page wrapper" },
      { "@type": "Restaurant", "name": "Graph restaurant" }
    ]
  }</script>`;

  assert.equal(parseJsonLdScripts(html).length, 3);
  const candidate = extractTravelCandidate(controlledPage({
    htmlForExtraction: html,
    availability: { hasJsonLd: true },
  }));

  assert.equal(candidate.fields.title, "Graph restaurant");
});
