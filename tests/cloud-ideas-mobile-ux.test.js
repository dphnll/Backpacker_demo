const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const ruMessages = JSON.parse(fs.readFileSync(path.join(__dirname, "../locales/ru.json"), "utf8"));
const enMessages = JSON.parse(fs.readFileSync(path.join(__dirname, "../locales/en.json"), "utf8"));

function functionSource(name, nextName) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1);
  const end = nextName ? source.indexOf(`function ${nextName}`, start) : -1;
  return source.slice(start, end === -1 ? undefined : end);
}

test("Cloud Ideas save returns mobile viewport to the top of the Ideas screen", () => {
  const helper = functionSource("scrollIdeasScreenToTopAfterSave", "getDefaultIdeaFormCollectionKey");
  assert.match(helper, /document\.activeElement/);
  assert.match(helper, /\.blur\(\)/);
  assert.match(helper, /requestAnimationFrame/);
  assert.match(helper, /#ideasScreen/);
  assert.match(helper, /scrollIntoView\(\{ block: "start" \}\)/);
  assert.match(helper, /window\.scrollTo/);

  const submit = source.slice(
    source.indexOf("async function submitIdeaForm"),
    source.indexOf("async function archiveCurrentIdea"),
  );
  assert.match(submit, /closeSheet\("ideaSheet"\)[\s\S]*renderIdeasScreen\(\)[\s\S]*scrollIdeasScreenToTopAfterSave\(\)/);
});

test("Recoverable Auth success does not leave an open profile sheet hanging", () => {
  const callback = source.slice(
    source.indexOf("async function handleRecoverableAuthCallback"),
    source.indexOf("function subscribeRecoverableAuthChanges"),
  );
  assert.match(callback, /closeRecoverableAuthSheetAfterSuccess\(user\)/);

  const closeHelper = functionSource("closeRecoverableAuthSheetAfterSuccess", "subscribeRecoverableAuthChanges");
  assert.match(closeHelper, /hasEmailIdentity/);
  assert.match(closeHelper, /#profileSheet/);
  assert.match(closeHelper, /closeSheet\("profileSheet"\)/);
});

test("Extension Connect identity gate uses human copy in the home profile slot", () => {
  const labelHelper = functionSource("getHomeProfileLabel", "renderProfileSheet");
  assert.match(labelHelper, /home\.profile\.email\.save/);
  assert.match(labelHelper, /home\.profile\.email\.check/);
  assert.equal(ruMessages["home.profile.email.save"], "Сохраните доступ по email");
  assert.equal(ruMessages["home.profile.email.check"], "Проверьте почту");
  assert.equal(enMessages["home.profile.email.save"], "Save email");
  assert.equal(enMessages["home.profile.email.check"], "Check email");
  assert.doesNotMatch(labelHelper, /anonymous/);
  assert.doesNotMatch(labelHelper, /текущий аккаунт/);

  const renderConnectCard = source.slice(
    source.indexOf("function renderExtensionConnectCard"),
    source.indexOf("function dismissExtensionConnectCard"),
  );
  assert.match(renderConnectCard, /renderHomeProfile\(\)/);
});
