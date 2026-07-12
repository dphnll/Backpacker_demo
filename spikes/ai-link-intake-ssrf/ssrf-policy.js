"use strict";

const DEFAULT_LIMITS = {
  maxUrlLength: 4096,
  maxRedirects: 3,
  perFetchTimeoutMs: 6000,
  totalTimeoutMs: 12000,
  maxBytes: 1024 * 1024,
  allowedContentTypes: ["text/html", "application/xhtml+xml"],
};

const METADATA_HOSTNAMES = new Set([
  "metadata.google.internal",
  "metadata",
  "instance-data",
]);

function blocked(reason, detail) {
  const error = new Error(reason);
  error.code = reason;
  if (detail) error.detail = detail;
  return error;
}

function normalizeUrl(input, baseUrl) {
  const raw = String(input || "").trim();
  if (!raw) throw blocked("INVALID_URL");
  if (raw.length > DEFAULT_LIMITS.maxUrlLength) throw blocked("URL_TOO_LONG");
  let url;
  try {
    url = baseUrl ? new URL(raw, baseUrl) : new URL(raw);
  } catch {
    throw blocked("INVALID_URL");
  }
  url.hash = "";
  return url;
}

function isIpLiteral(hostname) {
  const host = stripIpv6Brackets(hostname).toLowerCase();
  return isIPv4(host) || isIPv6Like(host);
}

function stripIpv6Brackets(hostname) {
  return String(hostname || "").replace(/^\[/, "").replace(/\]$/, "");
}

function isIPv4(value) {
  const parts = String(value || "").split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function ipv4ToInt(value) {
  if (!isIPv4(value)) return null;
  return value.split(".").reduce((acc, part) => ((acc << 8) + Number(part)) >>> 0, 0);
}

function inIPv4Cidr(value, base, bits) {
  const ip = ipv4ToInt(value);
  const network = ipv4ToInt(base);
  if (ip === null || network === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ip & mask) === (network & mask);
}

function isBlockedIPv4(value) {
  return [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ].some(([base, bits]) => inIPv4Cidr(value, base, bits));
}

function expandIPv6(value) {
  let input = stripIpv6Brackets(value).toLowerCase();
  const zoneIndex = input.indexOf("%");
  if (zoneIndex >= 0) input = input.slice(0, zoneIndex);
  if (!input.includes(":")) return null;

  const ipv4Match = input.match(/(^|:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  let ipv4Groups = [];
  if (ipv4Match) {
    const ipv4 = ipv4Match[2];
    if (!isIPv4(ipv4)) return null;
    const int = ipv4ToInt(ipv4);
    ipv4Groups = [((int >>> 16) & 0xffff).toString(16), (int & 0xffff).toString(16)];
    input = input.slice(0, input.length - ipv4.length) + ipv4Groups.join(":");
  }

  const sides = input.split("::");
  if (sides.length > 2) return null;
  const left = sides[0] ? sides[0].split(":").filter(Boolean) : [];
  const right = sides[1] ? sides[1].split(":").filter(Boolean) : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (sides.length === 1 && missing !== 0)) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== 8) return null;
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.map((group) => Number.parseInt(group, 16));
}

function isIPv6Like(value) {
  return Boolean(expandIPv6(value));
}

function ipv6StartsWith(groups, prefixGroups, bits) {
  let remaining = bits;
  for (let index = 0; index < 8; index += 1) {
    if (remaining <= 0) return true;
    const take = Math.min(16, remaining);
    const mask = (0xffff << (16 - take)) & 0xffff;
    if ((groups[index] & mask) !== (prefixGroups[index] & mask)) return false;
    remaining -= take;
  }
  return true;
}

function isIPv4MappedIPv6(groups) {
  return groups
    && groups[0] === 0
    && groups[1] === 0
    && groups[2] === 0
    && groups[3] === 0
    && groups[4] === 0
    && groups[5] === 0xffff;
}

function mappedIPv4(groups) {
  if (!isIPv4MappedIPv6(groups)) return null;
  return `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
}

function isBlockedIPv6(value) {
  const groups = expandIPv6(value);
  if (!groups) return false;
  const mapped = mappedIPv4(groups);
  if (mapped) return isBlockedIPv4(mapped);
  const allZero = groups.every((group) => group === 0);
  if (allZero) return true;
  const loopback = groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1;
  if (loopback) return true;
  const ranges = [
    ["fc00::", 7],
    ["fe80::", 10],
    ["ff00::", 8],
    ["2001:db8::", 32],
    ["2001::", 32],
    ["64:ff9b:1::", 48],
  ];
  return ranges.some(([base, bits]) => ipv6StartsWith(groups, expandIPv6(base), bits));
}

function isBlockedAddress(address) {
  const value = stripIpv6Brackets(address).toLowerCase();
  if (isIPv4(value)) return isBlockedIPv4(value);
  if (isIPv6Like(value)) return isBlockedIPv6(value);
  return false;
}

function isBlockedHostname(hostname) {
  const value = stripIpv6Brackets(hostname).toLowerCase().replace(/\.$/, "");
  return value === "localhost"
    || value.endsWith(".localhost")
    || value.endsWith(".local")
    || value.endsWith(".internal")
    || value.endsWith(".localdomain")
    || METADATA_HOSTNAMES.has(value);
}

function validateInitialUrl(input) {
  const url = normalizeUrl(input);
  if (url.protocol !== "https:") throw blocked("UNSUPPORTED_PROTOCOL");
  if (isBlockedHostname(url.hostname)) throw blocked("BLOCKED_HOSTNAME");
  if (isIpLiteral(url.hostname)) throw blocked("BLOCKED_ADDRESS", "ip_literal");
  return url;
}

async function validateResolvedUrl(input, resolver, baseUrl) {
  const url = baseUrl ? normalizeUrl(input, baseUrl) : validateInitialUrl(input);
  if (url.protocol !== "https:") throw blocked("UNSUPPORTED_PROTOCOL");
  if (isBlockedHostname(url.hostname)) throw blocked("BLOCKED_HOSTNAME");
  if (isIpLiteral(url.hostname)) throw blocked("BLOCKED_ADDRESS", "ip_literal");
  let records;
  try {
    records = await resolver(url.hostname);
  } catch (error) {
    throw blocked("DNS_RESOLUTION_FAILED", error && error.message);
  }
  if (!records || records.length === 0) throw blocked("DNS_RESOLUTION_FAILED");
  const blockedRecord = records.find((address) => isBlockedAddress(address));
  if (blockedRecord) throw blocked("BLOCKED_ADDRESS", blockedRecord);
  return { url, records };
}

function isSupportedContentType(contentType) {
  const normalized = String(contentType || "").split(";")[0].trim().toLowerCase();
  return DEFAULT_LIMITS.allowedContentTypes.includes(normalized);
}

async function readLimitedBody(response, maxBytes = DEFAULT_LIMITS.maxBytes) {
  if (!response.body || !response.body.getReader) {
    const text = await response.text();
    const bytes = new TextEncoder().encode(text);
    if (bytes.byteLength > maxBytes) throw blocked("CONTENT_TOO_LARGE");
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // Best-effort stream cancellation.
      }
      throw blocked("CONTENT_TOO_LARGE");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

async function controlledFetch(input, options) {
  const resolver = options.resolver;
  const fetcher = options.fetcher || fetch;
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  const started = Date.now();
  const seen = new Set();
  let current = validateInitialUrl(input);

  for (let redirects = 0; redirects <= limits.maxRedirects; redirects += 1) {
    if (Date.now() - started > limits.totalTimeoutMs) throw blocked("FETCH_TIMEOUT", "total");
    const { url } = await validateResolvedUrl(current.href, resolver);
    if (seen.has(url.href)) throw blocked("REDIRECT_LOOP");
    seen.add(url.href);

    const controller = new AbortController();
    const perFetchTimer = setTimeout(() => controller.abort("per_fetch_timeout"), limits.perFetchTimeoutMs);
    let response;
    try {
      response = await fetcher(url.href, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "text/html,application/xhtml+xml" },
      });
    } catch (error) {
      if (controller.signal.aborted) throw blocked("FETCH_TIMEOUT", "per_fetch");
      throw blocked("PAGE_UNAVAILABLE", error && error.message);
    } finally {
      clearTimeout(perFetchTimer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw blocked("REDIRECT_BLOCKED", "missing_location");
      try {
        current = normalizeUrl(location, url.href);
        if (current.protocol !== "https:") throw blocked("UNSUPPORTED_PROTOCOL");
      } catch (error) {
        if (error.code) throw error;
        throw blocked("REDIRECT_BLOCKED");
      }
      continue;
    }

    if (!response.ok) throw blocked("PAGE_UNAVAILABLE", String(response.status));
    const contentType = response.headers.get("content-type") || "";
    if (!isSupportedContentType(contentType)) throw blocked("UNSUPPORTED_CONTENT", contentType || "missing");
    const length = Number(response.headers.get("content-length") || 0);
    if (length > limits.maxBytes) throw blocked("CONTENT_TOO_LARGE", "content-length");
    const body = await readLimitedBody(response, limits.maxBytes);
    return {
      finalUrl: url.href,
      status: response.status,
      contentType,
      body,
      bytes: new TextEncoder().encode(body).byteLength,
      redirects,
    };
  }

  throw blocked("TOO_MANY_REDIRECTS");
}

module.exports = {
  DEFAULT_LIMITS,
  controlledFetch,
  isBlockedAddress,
  isBlockedHostname,
  isIpLiteral,
  isSupportedContentType,
  validateInitialUrl,
  validateResolvedUrl,
};
