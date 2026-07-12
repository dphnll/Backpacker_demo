"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  controlledFetch,
  isBlockedAddress,
  isBlockedHostname,
  isIpLiteral,
  isSupportedContentType,
  validateInitialUrl,
  validateResolvedUrl,
} = require("./ssrf-policy.js");

function resolver(recordsByHost) {
  return async (hostname) => {
    if (hostname === "dns-error.example") throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    return recordsByHost[hostname] || [];
  };
}

function htmlResponse(body, init = {}) {
  return new Response(body, {
    status: init.status || 200,
    headers: {
      "content-type": init.contentType || "text/html; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

function redirectResponse(location, status = 302) {
  return new Response("", { status, headers: { location } });
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (error) => error.code === code);
}

test("URL validation allows only https domain names", () => {
  assert.equal(validateInitialUrl("https://example.com/place").hostname, "example.com");
  assert.throws(() => validateInitialUrl("http://example.com"), { code: "UNSUPPORTED_PROTOCOL" });
  assert.throws(() => validateInitialUrl("file:///etc/passwd"), { code: "UNSUPPORTED_PROTOCOL" });
  assert.throws(() => validateInitialUrl("data:text/html,hi"), { code: "UNSUPPORTED_PROTOCOL" });
  assert.throws(() => validateInitialUrl("javascript:alert(1)"), { code: "UNSUPPORTED_PROTOCOL" });
  assert.throws(() => validateInitialUrl("https://localhost/path"), { code: "BLOCKED_HOSTNAME" });
  assert.throws(() => validateInitialUrl("https://127.0.0.1/path"), { code: "BLOCKED_ADDRESS" });
  assert.throws(() => validateInitialUrl("https://[::1]/path"), { code: "BLOCKED_ADDRESS" });
});

test("address policy blocks private, loopback, link-local, multicast, reserved and metadata IPs", () => {
  [
    "0.0.0.0",
    "10.1.2.3",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "192.0.2.10",
    "198.51.100.10",
    "203.0.113.10",
    "224.0.0.1",
    "240.0.0.1",
    "::",
    "::1",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "2001:db8::1",
    "::ffff:192.168.1.10",
    "::ffff:169.254.169.254",
  ].forEach((address) => assert.equal(isBlockedAddress(address), true, address));

  assert.equal(isBlockedAddress("93.184.216.34"), false);
  assert.equal(isBlockedAddress("2606:2800:220:1:248:1893:25c8:1946"), false);
  assert.equal(isBlockedHostname("metadata.google.internal"), true);
  assert.equal(isBlockedHostname("service.internal"), true);
  assert.equal(isIpLiteral("93.184.216.34"), true);
});

test("DNS validation rejects empty, private and mixed public/private answers", async () => {
  await assert.doesNotReject(validateResolvedUrl("https://public.example", resolver({
    "public.example": ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"],
  })));
  await rejectsCode(validateResolvedUrl("https://empty.example", resolver({ "empty.example": [] })), "DNS_RESOLUTION_FAILED");
  await rejectsCode(validateResolvedUrl("https://private.example", resolver({ "private.example": ["10.0.0.1"] })), "BLOCKED_ADDRESS");
  await rejectsCode(validateResolvedUrl("https://mixed.example", resolver({
    "mixed.example": ["93.184.216.34", "192.168.1.1"],
  })), "BLOCKED_ADDRESS");
  await rejectsCode(validateResolvedUrl("https://dns-error.example", resolver({})), "DNS_RESOLUTION_FAILED");
});

test("content policy accepts only initial HTML, not PDF or binary", () => {
  assert.equal(isSupportedContentType("text/html; charset=utf-8"), true);
  assert.equal(isSupportedContentType("application/xhtml+xml"), true);
  assert.equal(isSupportedContentType("application/pdf"), false);
  assert.equal(isSupportedContentType("application/octet-stream"), false);
  assert.equal(isSupportedContentType(""), false);
});

test("controlled fetch handles successful public HTML", async () => {
  const result = await controlledFetch("https://public.example/place", {
    resolver: resolver({ "public.example": ["93.184.216.34"] }),
    fetcher: async () => htmlResponse("<html><title>ok</title></html>"),
  });
  assert.equal(result.status, 200);
  assert.equal(result.finalUrl, "https://public.example/place");
  assert.match(result.body, /title/);
});

test("controlled fetch revalidates every redirect target", async () => {
  const fetcher = async (url) => {
    if (url === "https://public.example/start") return redirectResponse("https://next.example/final");
    return htmlResponse("<html>final</html>");
  };
  const result = await controlledFetch("https://public.example/start", {
    resolver: resolver({
      "public.example": ["93.184.216.34"],
      "next.example": ["93.184.216.35"],
    }),
    fetcher,
  });
  assert.equal(result.finalUrl, "https://next.example/final");
  assert.equal(result.redirects, 1);
});

test("controlled fetch blocks redirect to private IP, unsupported protocol and loops", async () => {
  await rejectsCode(controlledFetch("https://public.example/start", {
    resolver: resolver({ "public.example": ["93.184.216.34"] }),
    fetcher: async () => redirectResponse("https://127.0.0.1/private"),
  }), "BLOCKED_ADDRESS");

  await rejectsCode(controlledFetch("https://public.example/start", {
    resolver: resolver({ "public.example": ["93.184.216.34"] }),
    fetcher: async () => redirectResponse("http://example.com/plain"),
  }), "UNSUPPORTED_PROTOCOL");

  await rejectsCode(controlledFetch("https://public.example/start", {
    resolver: resolver({ "public.example": ["93.184.216.34"] }),
    fetcher: async () => redirectResponse("https://public.example/start"),
  }), "REDIRECT_LOOP");
});

test("controlled fetch blocks more than three redirects", async () => {
  const chain = new Map([
    ["https://a.example/", "https://b.example/"],
    ["https://b.example/", "https://c.example/"],
    ["https://c.example/", "https://d.example/"],
    ["https://d.example/", "https://e.example/"],
  ]);
  await rejectsCode(controlledFetch("https://a.example/", {
    resolver: resolver({
      "a.example": ["93.184.216.1"],
      "b.example": ["93.184.216.2"],
      "c.example": ["93.184.216.3"],
      "d.example": ["93.184.216.4"],
      "e.example": ["93.184.216.5"],
    }),
    fetcher: async (url) => redirectResponse(chain.get(url)),
  }), "TOO_MANY_REDIRECTS");
});

test("controlled fetch enforces content type and size with or without Content-Length", async () => {
  await rejectsCode(controlledFetch("https://public.example/doc.pdf", {
    resolver: resolver({ "public.example": ["93.184.216.34"] }),
    fetcher: async () => htmlResponse("%PDF-1.7", { contentType: "application/pdf" }),
  }), "UNSUPPORTED_CONTENT");

  await rejectsCode(controlledFetch("https://public.example/large", {
    resolver: resolver({ "public.example": ["93.184.216.34"] }),
    limits: { maxBytes: 8 },
    fetcher: async () => htmlResponse("0123456789", { headers: { "content-length": "10" } }),
  }), "CONTENT_TOO_LARGE");

  await rejectsCode(controlledFetch("https://public.example/chunked", {
    resolver: resolver({ "public.example": ["93.184.216.34"] }),
    limits: { maxBytes: 8 },
    fetcher: async () => htmlResponse("0123456789"),
  }), "CONTENT_TOO_LARGE");
});

test("controlled fetch applies per-fetch timeout", async () => {
  await rejectsCode(controlledFetch("https://public.example/slow", {
    resolver: resolver({ "public.example": ["93.184.216.34"] }),
    limits: { perFetchTimeoutMs: 20, totalTimeoutMs: 100 },
    fetcher: async (_url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new Error("aborted")));
      setTimeout(() => resolve(htmlResponse("<html>late</html>")), 100);
    }),
  }), "FETCH_TIMEOUT");
});
