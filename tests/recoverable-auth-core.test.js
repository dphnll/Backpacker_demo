const assert = require("node:assert/strict");
const test = require("node:test");

const core = require("../recoverable-auth-core.js");

test("normalizes and validates email input", () => {
  assert.equal(core.normalizeEmail("  USER@Example.COM "), "user@example.com");
  assert.equal(core.getEmailError(""), "Введите email");
  assert.equal(core.getEmailError("not-an-email"), "Введите корректный email");
  assert.equal(core.getEmailError("user@example.com"), "");
});

test("detects auth callback with code and preserves non-auth query params on cleanup", () => {
  const href = "https://dphnll.github.io/Backpacker_demo/?code=abc&type=magiclink&share=keep";
  const info = core.getAuthCallbackInfo(href);

  assert.equal(info.hasAuthParams, true);
  assert.equal(info.hasCode, true);
  assert.equal(info.code, "abc");
  assert.equal(core.getCleanAuthCallbackUrl(href), "https://dphnll.github.io/Backpacker_demo/?share=keep");
});

test("detects implicit hash tokens and removes auth hash on cleanup", () => {
  const href = "https://dphnll.github.io/Backpacker_demo/#access_token=token&refresh_token=refresh";
  const info = core.getAuthCallbackInfo(href);

  assert.equal(info.hasAuthParams, true);
  assert.equal(info.hasHashTokens, true);
  assert.equal(core.getCleanAuthCallbackUrl(href), "https://dphnll.github.io/Backpacker_demo/");
});

test("keeps share hash when cleaning non-auth URL", () => {
  const href = "https://dphnll.github.io/Backpacker_demo/#share=abc";

  assert.equal(core.getAuthCallbackInfo(href).hasAuthParams, false);
  assert.equal(core.getCleanAuthCallbackUrl(href), href);
});

test("summarizes anonymous and linked email users without exposing identity payloads", () => {
  assert.deepEqual(core.summarizeAuthUser({
    id: "u1",
    is_anonymous: true,
    identities: [],
  }), {
    email: "",
    hasEmailIdentity: false,
    id: "u1",
    isAnonymous: true,
    providers: [],
  });

  assert.deepEqual(core.summarizeAuthUser({
    id: "u2",
    email: "user@example.com",
    is_anonymous: false,
    identities: [{ provider: "email", identity_data: { privateField: "hidden" } }],
  }), {
    email: "user@example.com",
    hasEmailIdentity: true,
    id: "u2",
    isAnonymous: false,
    providers: ["email"],
  });
});
