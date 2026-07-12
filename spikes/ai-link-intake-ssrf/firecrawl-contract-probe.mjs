const targets = [
  {
    type: "restaurant",
    url: "https://guide.michelin.com/us/en/new-york-state/new-york/restaurant/le-bernardin",
  },
  {
    type: "museum_place",
    url: "https://www.louvre.fr/en/visit",
  },
  {
    type: "excursion",
    url: "https://www.getyourguide.com/paris-l16/louvre-museum-skip-the-line-guided-tour-t395451/",
  },
  {
    type: "hotel",
    url: "https://www.marriott.com/en-us/hotels/paris-prince-de-galles-a-luxury-collection-hotel-paris/overview/",
  },
];

const key = process.env.FIRECRAWL_API_KEY;
if (!key) {
  console.error("FIRECRAWL_API_KEY is required. The script prints sanitized response shapes only.");
  process.exit(1);
}

function keysOf(value) {
  return value && typeof value === "object" ? Object.keys(value).sort() : [];
}

function hasJsonLd(text) {
  return /application\/ld\+json/i.test(String(text || ""));
}

function hasOpenGraph(metadata) {
  return keysOf(metadata).some((keyName) => keyName.toLowerCase().startsWith("og"));
}

function hasCanonical(metadata, html) {
  return Boolean(
    metadata?.canonical
      || metadata?.canonicalUrl
      || /rel=["']canonical["']/i.test(String(html || "")),
  );
}

function hasAnyKey(metadata, patterns) {
  return keysOf(metadata).some((keyName) => {
    const normalized = keyName.toLowerCase();
    return patterns.some((pattern) => pattern.test(normalized));
  });
}

function hasAnyTextHint(text, patterns) {
  const normalized = String(text || "").toLowerCase();
  return patterns.some((pattern) => pattern.test(normalized));
}

function priceSignals(data, metadata) {
  const pricePatterns = [
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
    metadataKeys: hasAnyKey(metadata, pricePatterns),
    markdownText: hasAnyTextHint(data.markdown, pricePatterns),
    htmlText: hasAnyTextHint(data.html || data.rawHtml, pricePatterns),
  };
}

function locationSignals(data, metadata) {
  const locationPatterns = [
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
    metadataKeys: hasAnyKey(metadata, locationPatterns),
    markdownText: hasAnyTextHint(data.markdown, locationPatterns),
    htmlText: hasAnyTextHint(data.html || data.rawHtml, locationPatterns),
  };
}

async function probe(target) {
  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: target.url,
      formats: ["markdown", "html"],
      onlyMainContent: true,
      timeout: 12000,
      removeBase64Images: true,
      blockAds: true,
      storeInCache: false,
      zeroDataRetention: false,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  const data = payload.data || {};
  const metadata = data.metadata || {};
  const html = data.html || data.rawHtml || "";
  const price = priceSignals(data, metadata);
  const location = locationSignals(data, metadata);
  return {
    type: target.type,
    httpStatus: response.status,
    success: Boolean(payload.success),
    providerStatusCode: metadata.statusCode ?? null,
    topLevelKeys: keysOf(payload),
    dataKeys: keysOf(data),
    metadataKeys: keysOf(metadata),
    hasTitle: Boolean(metadata.title),
    hasDescription: Boolean(metadata.description),
    markdownChars: String(data.markdown || "").length,
    hasHtml: Boolean(html),
    htmlChars: String(html).length,
    hasJsonLd: hasJsonLd(html),
    hasOpenGraph: hasOpenGraph(metadata),
    hasCanonical: hasCanonical(metadata, html),
    hasSourceUrl: Boolean(metadata.sourceURL),
    hasFinalUrl: Boolean(metadata.url),
    priceSignals: price,
    locationSignals: location,
    contentType: metadata.contentType ?? null,
    warning: data.warning ? "present" : null,
    error: metadata.error || payload.error ? "present" : null,
  };
}

const results = [];
for (const target of targets) {
  results.push(await probe(target));
}

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  note: "Sanitized Firecrawl response shapes. No page content, titles, descriptions or URLs are printed.",
  results,
}, null, 2));
