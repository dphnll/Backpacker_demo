const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8").replace(/\r\n/g, "\n");
const core = require("../group-trip-core.js");
const privateSyncCore = require("../private-trip-sync-core.js");
const groupEdgeUrl = pathToFileURL(path.join(root, "supabase", "functions", "trip-share", "group-trips.mjs")).href;
const privacyUrl = pathToFileURL(path.join(root, "supabase", "functions", "trip-share", "privacy.mjs")).href;

const material = {
  id: "33333333-3333-4333-8333-333333333333",
  fileName: "Voucher.pdf",
  mimeType: "application/pdf",
  fileSizeBytes: 2048,
  createdAt: "2026-09-04T10:00:00.000Z",
};

test("old trips normalize with empty optional Organizer fields", () => {
  const trip = core.normalizeOrganizerTripFields({ id: "old-trip", currency: "EUR" });
  assert.deepEqual(trip.programInfo, {
    priceAmount: 0,
    priceCurrency: "EUR",
    includedText: "",
    notIncludedText: "",
    importantInfoText: "",
  });
  assert.deepEqual(trip.groupMaterials, []);
  assert.equal(trip.programUpdatedAt, "");
});

test("program facts and explicit group material normalize without private storage metadata", () => {
  const trip = core.normalizeOrganizerTripFields({
    currency: "RUB",
    programInfo: {
      priceAmount: "1200.50",
      priceCurrency: "EUR",
      includedText: "Hotel\nTransfers",
      notIncludedText: "Flights",
      importantInfoText: "Meet at 09:00",
    },
    groupMaterials: [{ ...material, storagePath: "owner/private/path.pdf", ownerUserId: "secret" }],
  });
  assert.equal(trip.programInfo.priceAmount, 1200.5);
  assert.equal(trip.programInfo.priceCurrency, "EUR");
  assert.equal(trip.programInfo.includedText, "Hotel\nTransfers");
  assert.equal(trip.programInfo.notIncludedText, "Flights");
  assert.equal(trip.programInfo.importantInfoText, "Meet at 09:00");
  assert.deepEqual(trip.groupMaterials, [material]);
  assert.equal(JSON.stringify(trip.groupMaterials).includes("storagePath"), false);
  assert.equal(JSON.stringify(trip.groupMaterials).includes("ownerUserId"), false);
});

test("browser and Edge program projections keep the same normalization contract", async () => {
  const edge = await import(groupEdgeUrl);
  const input = {
    priceAmount: "1200.50",
    priceCurrency: "eur",
    includedText: "Stay\nTransfers",
    notIncludedText: "Flights",
    importantInfoText: "Bring a passport",
  };
  assert.deepEqual(edge.normalizeProgramInfo(input, "RUB"), core.normalizeProgramInfo(input, "RUB"));
  assert.deepEqual(edge.normalizeGroupMaterials([{ ...material, storagePath: "private" }]), core.normalizeGroupMaterials([{ ...material, storagePath: "private" }]));
});

test("program information and group materials survive the existing private Trip snapshot", () => {
  const entry = {
    id: "organizer-trip",
    isDemo: false,
    createdAt: "2026-09-04T10:00:00.000Z",
    updatedAt: "2026-09-04T11:00:00.000Z",
    state: {
      trip: {
        id: "organizer-trip",
        isGroupTrip: true,
        programInfo: { priceAmount: 1200, priceCurrency: "EUR", includedText: "Stay" },
        groupMaterials: [material],
      },
      items: [],
    },
  };
  const payload = privateSyncCore.createTripUploadPayload(entry, "11111111-1111-4111-8111-111111111111");
  assert.deepEqual(payload.snapshot.state.trip.programInfo, entry.state.trip.programInfo);
  assert.deepEqual(payload.snapshot.state.trip.groupMaterials, [material]);
});

test("Organizer projection keeps program price independent while stripping internal budget", async () => {
  const { prepareTripShareWrite } = await import(groupEdgeUrl);
  const { stripBudget } = await import(privacyUrl);
  const state = {
    trip: {
      id: "trip-1",
      isGroupTrip: true,
      budgetLimit: 45000,
      currency: "RUB",
      programInfo: { priceAmount: 1200, priceCurrency: "EUR", includedText: "Stay" },
      groupMaterials: [material],
    },
    items: [{ id: "item-1", price: 13000, notes: "public itinerary note" }],
  };
  const prepared = prepareTripShareWrite({
    state,
    includeBudget: true,
    user: { id: "owner", is_anonymous: false, identities: [{ provider: "email" }] },
    stripBudget,
    now: "2026-09-04T11:00:00.000Z",
  });
  assert.equal(prepared.includeBudget, false);
  assert.equal(prepared.state.trip.budgetLimit, undefined);
  assert.equal(prepared.state.items[0].price, undefined);
  assert.equal(prepared.state.trip.programInfo.priceAmount, 1200);
  assert.equal(prepared.state.trip.programInfo.priceCurrency, "EUR");
  assert.deepEqual(prepared.state.trip.groupMaterials, [material]);
  assert.equal(prepared.state.trip.programUpdatedAt, "2026-09-04T11:00:00.000Z");
});

test("meaningful Shared Program changes advance freshness while identical updates do not", () => {
  const first = core.stampPublishedProgramState({
    trip: { id: "trip-1", isGroupTrip: true, programInfo: { includedText: "Breakfast" } },
    items: [{ id: "day-1", title: "Walk" }],
  }, null, "2026-09-04T11:00:00.000Z");
  const same = core.stampPublishedProgramState(JSON.parse(JSON.stringify(first)), first, "2026-09-04T12:00:00.000Z");
  const changed = JSON.parse(JSON.stringify(first));
  changed.trip.programInfo.includedText = "Breakfast and transfer";
  core.stampPublishedProgramState(changed, first, "2026-09-04T12:00:00.000Z");
  assert.equal(same.trip.programUpdatedAt, "2026-09-04T11:00:00.000Z");
  assert.equal(changed.trip.programUpdatedAt, "2026-09-04T12:00:00.000Z");
});

test("an internal-budget-only save does not advance Organizer program freshness", async () => {
  const { prepareTripShareWrite } = await import(groupEdgeUrl);
  const { stripBudget } = await import(privacyUrl);
  const user = { id: "owner", is_anonymous: false, identities: [{ provider: "email" }] };
  const first = prepareTripShareWrite({
    state: { trip: { id: "trip-1", isGroupTrip: true, budgetLimit: 45000 }, items: [{ id: "item-1", price: 5000 }] },
    user,
    stripBudget,
    now: "2026-09-04T11:00:00.000Z",
  }).state;
  const next = prepareTripShareWrite({
    state: { trip: { id: "trip-1", isGroupTrip: true, budgetLimit: 90000 }, items: [{ id: "item-1", price: 15000 }] },
    user,
    stripBudget,
    previousState: first,
    now: "2026-09-04T12:00:00.000Z",
  }).state;
  assert.equal(next.trip.programUpdatedAt, first.trip.programUpdatedAt);
});

test("ordinary projection removes every Organizer-only field", () => {
  const ordinary = core.stampPublishedProgramState({
    trip: {
      id: "trip-1",
      isGroupTrip: false,
      programInfo: { priceAmount: 1200, priceCurrency: "EUR" },
      groupMaterials: [material],
      programUpdatedAt: "2026-09-04T11:00:00.000Z",
    },
    items: [],
  });
  assert.equal(ordinary.trip.programInfo, undefined);
  assert.equal(ordinary.trip.groupMaterials, undefined);
  assert.equal(ordinary.trip.programUpdatedAt, undefined);
});

test("Organizer UI, participant projection, signed material access, and i18n boundaries are wired", () => {
  const app = read("app.js");
  const index = read("index.html");
  const edge = read("supabase/functions/trip-share/index.ts");
  const styles = read("styles.css");
  const ru = JSON.parse(read("locales/ru.json"));
  const en = JSON.parse(read("locales/en.json"));
  assert.match(index, /id="organizerProgramInfoForm"[\s\S]*id="organizerGroupMaterialAddButton"/);
  assert.match(index, /id="participantProgramInfo"[\s\S]*id="participantProgramInfoContent"/);
  assert.match(app, /state\.trip\.programInfo = getGroupTripCore\(\)\.normalizeProgramInfo/);
  assert.match(app, /uploadTripItemAttachment\([\s\S]*getOrganizerMaterialScope\(\)/);
  assert.match(app, /deleteTripItemAttachment\(getSupabaseClient\(\), attachment\)/);
  assert.match(app, /callTripShareFunction\("open_group_material"/);
  assert.match(styles, /\.fab\[hidden\] \{\s*display: none;/);
  assert.match(app, /if \(!isCurrentGroupTrip\(\)\) getGroupTripCore\(\)\?\.stripOrganizerFields\(published\)/);
  assert.match(edge, /trip_item_attachments/);
  assert.match(edge, /trip_item_id", GROUP_MATERIAL_SCOPE_ID/);
  assert.match(edge, /createSignedUrl\(String\(attachment\.storage_path/);
  assert.doesNotMatch(edge, /createBucket|new bucket|program_history|read_receipt/i);
  assert.equal(ru["share.organizer.program.editor.title"], "Информация для участников");
  assert.equal(en["share.organizer.program.editor.title"], "Participant information");
  assert.equal(ru["share.organizer.program.updated"], "Обновлено {date}");
  const organizerKeys = (messages) => Object.keys(messages).filter((key) => key.startsWith("share.organizer.")).sort();
  assert.deepEqual(organizerKeys(ru), organizerKeys(en));
});

test("roster, panel and link actions do not stamp program freshness", () => {
  const app = read("app.js");
  const edge = read("supabase/functions/trip-share/index.ts");
  const groupEdge = read("supabase/functions/trip-share/group-trips.mjs");
  const isolated = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
  assert.doesNotMatch(isolated(groupEdge, "async function joinGroupTrip", "async function getOrganizerGroupContext"), /stampPublishedProgramState/);
  assert.doesNotMatch(isolated(app, "async function refreshGroupTripContext", "function getOrganizerMaterialScope"), /programUpdatedAt/);
  assert.doesNotMatch(isolated(app, "async function copyTripShareLink", "async function revokeTripShareLink"), /programUpdatedAt/);
  assert.match(edge, /previousState: previousShare\?\.state \|\| null/);
});

test("budget summaries and Organizer price controls stay aligned at narrow widths", () => {
  const styles = read("styles.css");
  assert.match(styles, /\.app-shell \.budget-strip \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(styles, /\.app-shell \.budget-strip > div \{[\s\S]*?width: 100%;[\s\S]*?min-width: 0;/);
  assert.match(styles, /\.app-shell \.budget-strip span \{[\s\S]*?display: flex;[\s\S]*?white-space: nowrap;/);
  assert.match(styles, /\.app-shell \.budget-strip strong \{[\s\S]*?white-space: nowrap;/);
  assert.match(styles, /#organizerProgramPriceAmount,[\s\S]*?#organizerProgramPriceCurrency \{[\s\S]*?height: 42px;[\s\S]*?min-height: 42px;/);
});
