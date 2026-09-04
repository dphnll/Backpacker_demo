const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8").replace(/\r\n/g, "\n");
const app = read("app.js");
const edge = read("supabase/functions/trip-share/index.ts");
const index = read("index.html");
const worker = read("service-worker.js");
const styles = read("styles.css");
const ru = JSON.parse(read("locales/ru.json"));
const en = JSON.parse(read("locales/en.json"));

test("group marker is explicit while old trips normalize to personal", () => {
  assert.match(app, /normalized\.trip\.isGroupTrip = normalized\.trip\.isGroupTrip === true/);
  assert.match(app, /function isCurrentGroupTrip\(\)/);
});

test("organizer action uses one active mode, a collapsed panel, and hidden budget", () => {
  assert.match(app, /function getActiveTripShareMode/);
  assert.match(app, /openShareModePanel = null;[\s\S]*pendingShareModeSwitch = "";[\s\S]*renderSharePreview\(\)/);
  assert.match(app, /organizerActive && openShareModePanel === "organizer"/);
  assert.match(app, /ordinaryActive && openShareModePanel === "ordinary"/);
  assert.match(app, /isCurrentGroupTrip\(\) \? false : options\.includeBudget !== false/);
  assert.match(app, /if \(isCurrentGroupTrip\(\)\) includeBudget = false/);
  assert.match(app, /budgetToggle\?\.classList\.toggle\("hidden", organizerActive\)/);
  assert.match(app, /openShareModePanel = openShareModePanel === "organizer" \? null : "organizer"/);
  assert.match(edge, /prepareTripShareWrite/);
  assert.match(edge, /onConflict: "owner_user_id,trip_id"/);
  assert.match(styles, /\.group-trip-participants \{[\s\S]*font-size: 13px;[\s\S]*line-height: 1\.45;/);
  assert.match(styles, /\.group-trip-participants strong \{[\s\S]*font-weight: 700;/);
  assert.match(styles, /\.group-trip-participants ul \{[\s\S]*font-weight: 400;/);
});

test("public preview has a dedicated join action and no group proposal route", () => {
  assert.match(index, /id="joinGroupTripButton"/);
  assert.match(index, /id="groupTripPublishButton"/);
  assert.match(app, /callTripShareFunction\("join_group"/);
  assert.match(app, /if \(isReadOnlyGroupTrip\(\)\) return;/);
  assert.match(edge, /group_proposals_disabled/);
  assert.ok(edge.indexOf('if (action === "read")') < edge.indexOf("const user = await getRequestUser"), "public read must precede the authenticated action gate");
});

test("pending group intent is narrow and resumed after auth", () => {
  assert.match(app, /GROUP_TRIP_PENDING_INTENT_KEY/);
  assert.match(app, /resumePendingGroupTripIntent\(recoverableUser\)/);
  assert.match(app, /pendingGroupIntent\.expectedUserId !== currentUser\?\.id/);
  assert.match(app, /updatePendingGroupTripAuthFlow\("login"\)/);
});

test("Join reuses Received Trips and never writes participant private-trip storage", () => {
  const joinStart = app.indexOf("async function joinGroupTripByShareId");
  const joinEnd = app.indexOf("async function startGroupTripJoin", joinStart);
  const joinSource = app.slice(joinStart, joinEnd);
  assert.match(joinSource, /refreshReceivedTrips/);
  assert.match(joinSource, /openReceivedTrip\(shareId\)/);
  assert.doesNotMatch(joinSource, /saveState|tripStore\.trips\.(push|unshift)|syncPrivateTripsWithCloud/);
  assert.match(edge, /action === "read_received"[\s\S]*state: share\.include_budget \? share\.state : stripBudget\(share\.state\)/);
});

test("Group participants get view-only cards and no proposal CTA", () => {
  assert.match(app, /if \(editButton && isReadOnlyGroupTrip\(\)\)[\s\S]*openItemSheet\(editButton\.dataset\.edit, \{ readOnly: true \}\)/);
  assert.match(app, /const viewOnly = options\.readOnly === true/);
  assert.match(app, /control\.disabled = viewOnly/);
  assert.match(app, /if \(isReadOnlyGroupTrip\(\)\) return;[\s\S]*openItemProposalSheet/);
});

test("missing profile resumes through the existing profile sheet", () => {
  assert.match(app, /loadMyProfile\(\{ createSession: false \}\)[\s\S]*openGroupTripIdentitySheet\(intent, \{ profileRequired: true \}\)/);
  assert.match(app, /openProfileSheet\(\{[\s\S]*action: \(\) => resumePendingGroupTripIntent\(\)/);
});

test("group asset is loaded by the page and service worker", () => {
  assert.match(index, /<script src="\.\/group-trip-core\.js"><\/script>/);
  assert.match(worker, /\.\/group-trip-core\.js/);
});

test("RU and EN expose the same group-trip keys and corrected role labels", () => {
  const relevant = (key) => key.startsWith("share.group.") || key.startsWith("share.organizer.") || key.startsWith("share.ordinary.") || key.startsWith("share.mode.switch.") || key === "home.trip.status.group.owner" || key === "home.received.group.participant";
  const ruKeys = Object.keys(ru).filter(relevant).sort();
  const enKeys = Object.keys(en).filter(relevant).sort();
  assert.deepEqual(ruKeys, enKeys);
  assert.equal(ru["home.trip.status.shared.owner"], "Открыта попутчикам");
  assert.equal(en["home.trip.status.shared.owner"], "Open to travel companions");
  assert.equal(ru["home.trip.status.group.owner"], "Организатор");
  assert.equal(en["home.received.group.participant"], "Group participant");
});

test("ordinary sharing and Organizer Mode are separate, mutually exclusive controls", () => {
  assert.match(index, /data-i18n="share\.ordinary\.title"[\s\S]*id="openTripLinkButton"[\s\S]*data-i18n="share\.organizer\.title"[\s\S]*id="groupTripPublishButton"/);
  assert.match(app, /if \(activeMode === "organizer"\) \{[\s\S]*requestShareModeSwitch\("ordinary"\)/);
  assert.match(app, /if \(activeMode === "ordinary"\) \{[\s\S]*requestShareModeSwitch\("organizer"\)/);
  assert.match(app, /rotateToken: true/);
  assert.match(app, /const rotateToken = options\.rotateToken === true \|\| mustRotateToken/);
  assert.match(index, /id="shareModeSwitchConfirm"[\s\S]*id="confirmShareModeSwitchButton"[\s\S]*id="cancelShareModeSwitchButton"/);
  assert.equal(ru["share.organizer.panel.title"], "Ссылка для участников");
  assert.equal(ru["share.ordinary.action"], "Пригласить по ссылке");
});

test("mode rotation invalidates old relationships without deleting participant history", () => {
  assert.match(app, /state\.trip\.shareModeEpoch = new Date\(\)\.toISOString\(\)/);
  assert.match(edge, /function getShareModeEpoch/);
  assert.match(edge, /\.gte\("updated_at", activeSince\)/);
  assert.match(edge, /\.gte\("created_at", activeSince\)/);
  assert.match(edge, /Date\.parse\(entry\.created_at\) < Date\.parse\(getShareModeEpoch/);
  assert.doesNotMatch(edge, /from\("trip_share_participant_links"\)[\s\S]{0,120}\.delete\(\)/);
});
