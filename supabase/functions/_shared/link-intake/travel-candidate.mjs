"use strict";

const CURRENCY_BY_SYMBOL = Object.freeze({
  "€": "EUR",
  "$": "USD",
  "£": "GBP",
  "₽": "RUB",
  "₺": "TRY",
  "₾": "GEL",
});

const KNOWN_CURRENCIES = new Set([
  "RUB",
  "EUR",
  "USD",
  "GBP",
  "TRY",
  "GEL",
  "SEK",
  "RSD",
  "BAM",
]);

function cleanText(value, limit = 1000) {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, limit) : null;
}

function firstString(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return null;
}

function confidence(level) {
  if (level === "high") return 0.9;
  if (level === "medium") return 0.65;
  if (level === "low") return 0.35;
  return 0;
}

function field(value, source, level, evidence = null) {
  if (value === null || value === undefined || value === "") return null;
  return {
    value,
    provenance: {
      source,
      confidence: confidence(level),
      evidence,
    },
  };
}

function metadataValue(metadata, ...keys) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function parseJsonLdScripts(html) {
  const text = String(html || "");
  const blocks = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    const raw = match[1]
      .replace(/<!--/g, "")
      .replace(/-->/g, "")
      .trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Invalid JSON-LD is untrusted page content; ignore it.
    }
  }
  return blocks.flatMap(flattenJsonLd);
}

function flattenJsonLd(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  const graph = Array.isArray(value["@graph"]) ? value["@graph"].flatMap(flattenJsonLd) : [];
  return [value, ...graph];
}

function jsonLdType(entry) {
  const type = entry?.["@type"];
  if (Array.isArray(type)) return type.map((value) => String(value).toLowerCase());
  if (typeof type === "string") return [type.toLowerCase()];
  return [];
}

function pickJsonLdEntity(entries) {
  const priority = [
    "event",
    "touristattraction",
    "museum",
    "restaurant",
    "foodestablishment",
    "lodgingbusiness",
    "hotel",
    "place",
    "product",
    "thing",
  ];
  return entries.find((entry) => jsonLdType(entry).some((type) => priority.includes(type)))
    || entries.find((entry) => typeof entry?.name === "string")
    || null;
}

function getJsonLdImage(entity) {
  const image = entity?.image;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return firstString(...image);
  if (image && typeof image === "object") return firstString(image.url, image.contentUrl);
  return null;
}

function getJsonLdDescription(entity) {
  return firstString(entity?.description, entity?.disambiguatingDescription);
}

function getJsonLdLocation(entity) {
  const location = entity?.location || entity?.address;
  const address = location?.address || location;
  if (typeof location === "string") return location;
  if (typeof address === "string") return address;
  if (address && typeof address === "object") {
    return [
      address.streetAddress,
      address.addressLocality,
      address.addressRegion,
      address.postalCode,
      address.addressCountry,
    ].map((entry) => cleanText(entry)).filter(Boolean).join(", ") || null;
  }
  if (location && typeof location === "object") {
    return firstString(location.name);
  }
  return null;
}

function getJsonLdGeo(entity) {
  const geo = entity?.geo || entity?.location?.geo;
  if (!geo || typeof geo !== "object") return null;
  const latitude = Number(geo.latitude);
  const longitude = Number(geo.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function getJsonLdOffer(entity) {
  const offers = Array.isArray(entity?.offers) ? entity.offers : [entity?.offers].filter(Boolean);
  const offer = offers.find((entry) => entry && typeof entry === "object");
  if (!offer) return null;
  return {
    amount: parseAmount(offer.price ?? offer.lowPrice ?? offer.highPrice),
    currency: normalizeCurrency(offer.priceCurrency),
    text: firstString(offer.priceSpecification?.price, offer.price),
    kind: offer.lowPrice || offer.highPrice ? "range" : "exact",
  };
}

function normalizeCurrency(value) {
  const text = cleanText(value, 20);
  if (!text) return null;
  const upper = text.toUpperCase();
  if (KNOWN_CURRENCIES.has(upper)) return upper;
  return CURRENCY_BY_SYMBOL[text] || null;
}

function parseAmount(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100) / 100;
  const text = cleanText(value, 80);
  if (!text) return null;
  const normalized = text
    .replace(/\s+/g, "")
    .replace(/(?<=\d)[,](?=\d{1,2}\D*$)/, ".")
    .replace(/[^\d.]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null;
}

function getMetadataPrice(metadata) {
  const amount = parseAmount(metadataValue(
    metadata,
    "product:price:amount",
    "og:price:amount",
    "og:price:standard_amount",
    "price",
    "amount",
  ));
  const currency = normalizeCurrency(metadataValue(
    metadata,
    "product:price:currency",
    "og:price:currency",
    "priceCurrency",
    "currency",
  ));
  if (amount === null && !currency) return null;
  return { amount, currency, kind: amount === null ? "unknown" : "exact", text: null };
}

function getTextPrice(markdown) {
  const text = String(markdown || "");
  const match = text.match(/(?:from|от|price|цена|tickets?|билет[ыа]?)[^\n\r]{0,40}?((?:€|\$|£|₽|₺|₾)?\s*\d[\d\s.,]*\s*(?:EUR|USD|GBP|RUB|TRY|GEL|SEK|RSD|BAM|€|\$|£|₽|₺|₾)?)/i);
  if (!match) return null;
  const raw = cleanText(match[1], 80);
  const currencyMatch = raw.match(/EUR|USD|GBP|RUB|TRY|GEL|SEK|RSD|BAM|€|\$|£|₽|₺|₾/i);
  return {
    amount: parseAmount(raw),
    currency: normalizeCurrency(currencyMatch?.[0]),
    kind: /from|от/i.test(match[0]) ? "from" : "unknown",
    text: raw,
  };
}

function getTextLocation(markdown) {
  const text = String(markdown || "");
  const match = text.match(/(?:address|адрес|location|место|where|где)\s*[:\-–—]\s*([^\n\r]{4,160})/i);
  return cleanText(match?.[1], 200);
}

function buildProvenanceMap(fields) {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([, entry]) => entry)
      .map(([key, entry]) => [key, entry.provenance]),
  );
}

function extractTravelCandidate(page, options = {}) {
  const sourceType = options.sourceType || "link_intake";
  const metadata = page?.metadata || {};
  const jsonLdEntries = parseJsonLdScripts(page?.htmlForExtraction);
  const jsonLdEntity = pickJsonLdEntity(jsonLdEntries);
  const jsonLdOffer = jsonLdEntity ? getJsonLdOffer(jsonLdEntity) : null;
  const metadataPrice = getMetadataPrice(metadata);
  const textPrice = getTextPrice(page?.markdown);
  const jsonLdLocation = jsonLdEntity ? getJsonLdLocation(jsonLdEntity) : null;
  const textLocation = getTextLocation(page?.markdown);

  const title = field(
    firstString(jsonLdEntity?.name, page?.title, metadataValue(metadata, "og:title", "ogTitle", "title")),
    jsonLdEntity?.name ? "json_ld" : page?.title ? "controlled_page" : "metadata",
    jsonLdEntity?.name || page?.title ? "high" : "medium",
  );
  const description = field(
    firstString(getJsonLdDescription(jsonLdEntity), page?.description, metadataValue(metadata, "og:description", "ogDescription", "description")),
    getJsonLdDescription(jsonLdEntity) ? "json_ld" : page?.description ? "controlled_page" : "metadata",
    getJsonLdDescription(jsonLdEntity) || page?.description ? "high" : "medium",
  );
  const image = field(
    firstString(getJsonLdImage(jsonLdEntity), metadataValue(metadata, "og:image", "ogImage", "image")),
    getJsonLdImage(jsonLdEntity) ? "json_ld" : "metadata",
    getJsonLdImage(jsonLdEntity) ? "high" : "medium",
  );
  const priceSource = jsonLdOffer?.amount !== null && jsonLdOffer?.amount !== undefined
    ? "json_ld"
    : metadataPrice
      ? "metadata"
      : textPrice
        ? "text_signal"
        : null;
  const priceValue = jsonLdOffer?.amount !== null && jsonLdOffer?.amount !== undefined
    ? jsonLdOffer
    : metadataPrice || textPrice;
  const price = field(priceValue, priceSource, priceSource === "text_signal" ? "low" : "medium", priceValue?.text || null);
  const locationSource = jsonLdLocation ? "json_ld" : textLocation ? "text_signal" : null;
  const location = field(
    jsonLdLocation || textLocation,
    locationSource,
    locationSource === "json_ld" ? "medium" : "low",
  );
  const geo = field(
    jsonLdEntity ? getJsonLdGeo(jsonLdEntity) : null,
    "json_ld",
    "medium",
  );
  const sourceUrl = field(
    firstString(page?.originalUrl, page?.canonicalUrl, page?.finalUrl),
    "controlled_page",
    page?.originalUrl ? "high" : "medium",
  );
  const canonicalUrl = field(page?.canonicalUrl, "controlled_page", "medium");
  const fields = { title, description, image, price, location, geo, sourceUrl, canonicalUrl };

  return {
    schemaVersion: 1,
    sourceType,
    source: {
      fetchedAt: page?.fetchedAt || null,
    },
    fields: Object.fromEntries(
      Object.entries(fields).map(([key, entry]) => [key, entry ? entry.value : null]),
    ),
    provenance: buildProvenanceMap(fields),
    confidence: {
      overall: Math.max(
        title?.provenance.confidence || 0,
        description?.provenance.confidence || 0,
        location?.provenance.confidence || 0,
        price?.provenance.confidence || 0,
      ),
      title: title?.provenance.confidence || 0,
      description: description?.provenance.confidence || 0,
      price: price?.provenance.confidence || 0,
      location: location?.provenance.confidence || 0,
    },
    warnings: [
      ...(Array.isArray(page?.warnings) ? page.warnings : []),
      ...(page?.limits?.truncated ? ["CONTROLLED_PAGE_TRUNCATED"] : []),
      ...(jsonLdEntries.length === 0 && page?.availability?.hasJsonLd ? ["JSON_LD_PARSE_FAILED"] : []),
    ],
  };
}

export {
  extractTravelCandidate,
  parseJsonLdScripts,
};
