const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function functionSource(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} should exist`);
  const next = appSource.indexOf("\nfunction ", start + 1);
  return appSource.slice(start, next >= 0 ? next : appSource.length);
}

test("TravelIdea destination flow uses all non-demo trips and no empty picker", () => {
  assert.match(functionSource("getTravelIdeaDestinationTrips"), /tripStore\.trips\.filter\(\(entry\) => !entry\.isDemo\)/);
  const openSource = functionSource("openTravelIdeaDestinationPicker");
  assert.match(openSource, /Сначала создайте поездку, чтобы добавить в неё идею\./);
  assert.match(openSource, /!getTravelIdeaDestinationTrips\(\)\.length/);
  assert.doesNotMatch(openSource, /createBlankTripEntry|createNewTrip|startTripDraft/);
});

test("TravelIdea destination flow skips scope step and does not fake source item", () => {
  assert.match(functionSource("renderCardCopyScopeStep"), /cardCopyState\.sourceKind === "travel_idea"/);
  assert.match(functionSource("renderCardCopyTripStep"), /cardCopyState\.sourceKind === "travel_idea"[\s\S]*!\s*cardCopyState\.targetTripId/);
  assert.match(functionSource("getCardCopyTripOptions"), /sourceKind === "travel_idea"[\s\S]*getTravelIdeaDestinationTrips/);
  assert.doesNotMatch(functionSource("openTravelIdeaDestinationPicker"), /sourceTrip|createTripItemCopy|fake/i);
});

test("TravelIdea confirm opens an ordinary editable item draft without writing items", () => {
  const confirmSource = functionSource("confirmCardCopy");
  const draftSource = functionSource("openTravelIdeaItemDraft");
  assert.match(confirmSource, /cardCopyState\.sourceKind === "travel_idea"[\s\S]*openTravelIdeaItemDraft/);
  assert.match(draftSource, /mapTravelIdeaToTripItemDraft\(sourceIdea, targetState\.trip\.currency\)/);
  assert.match(draftSource, /closeCardCopySheetForTransition/);
  assert.match(draftSource, /openTrip\(targetTripId, { persistNavigation: false, refreshProposals: false }\)/);
  assert.match(draftSource, /openItemSheet\(null,\s*{/);
  assert.match(draftSource, /initialDraft/);
  assert.match(draftSource, /creationMethod: "other"/);
  assert.match(draftSource, /returnScreenOnCancel: "ideas"/);
  assert.match(draftSource, /inlineWarning: draft\.priceWarning/);
  assert.doesNotMatch(draftSource, /state\.items\.push|targetState\.items\.push|saveState|persistTripStore|trackEvent\("item_created"/);
  assert.doesNotMatch(appSource, /createTripItemFromTravelIdeaDraft/);
  assert.doesNotMatch(draftSource, /updateTravelIdea|archiveTravelIdea|deleteTravelIdea|removeTravelIdea/);
});

test("TravelIdea item draft uses transient context and ordinary saveItem creation", () => {
  const openSource = functionSource("openItemSheet");
  const saveSource = functionSource("saveItem");
  assert.match(openSource, /options = {}/);
  assert.match(openSource, /resetItemCreateContext\(\)/);
  assert.match(openSource, /applyInitialDraftToItemForm\(options\.initialDraft\)/);
  assert.match(openSource, /itemCreateContext = {[\s\S]*creationMethod: options\.creationMethod \|\| "manual"[\s\S]*returnScreenOnCancel: options\.returnScreenOnCancel \|\| ""[\s\S]*sourceIdeaId: options\.sourceIdeaId \|\| ""/);
  assert.match(saveSource, /const createContext = isNew \? { \.\.\.itemCreateContext } : getDefaultItemCreateContext\(\)/);
  assert.match(saveSource, /state\.items\.push\(item\)/);
  assert.match(saveSource, /closeItemSheetAfterSave\(\)/);
  assert.match(saveSource, /creation_method: createContext\.creationMethod \|\| "manual"/);
});

test("TravelIdea item draft cancel cleans context and returns to Ideas", () => {
  const dismissSource = functionSource("dismissItemSheet");
  const closeHandlerSource = appSource.slice(appSource.indexOf("const closeTarget = event.target.closest"), appSource.indexOf("const donationDismissTarget = event.target.closest"));
  const popstateSource = appSource.slice(appSource.indexOf('window.addEventListener("popstate"'), appSource.indexOf('window.addEventListener("pagehide"'));
  assert.match(dismissSource, /resetItemCreateContext\(\)/);
  assert.match(dismissSource, /returnScreen === "ideas"[\s\S]*showIdeasScreen\(\)/);
  assert.doesNotMatch(dismissSource, /state\.items\.push|saveState|persistTripStore/);
  assert.match(closeHandlerSource, /closeTarget\.dataset\.close === "item"[\s\S]*dismissItemSheet\("close"\)/);
  assert.match(popstateSource, /itemCreateContext\.returnScreenOnCancel[\s\S]*dismissItemSheet\("back", { fromPopState: true }\)/);
});

test("TravelIdea draft navigation does not persist active trip before Save", () => {
  const openTripSource = functionSource("openTrip");
  const showTripSource = functionSource("showTripScreen");
  const draftSource = functionSource("openTravelIdeaItemDraft");
  assert.match(openTripSource, /options = {}/);
  assert.match(openTripSource, /options\.persistNavigation !== false[\s\S]*localStorage\.setItem\(ACTIVE_TRIP_STORAGE_KEY/);
  assert.match(openTripSource, /showTripScreen\({ refreshProposals: options\.refreshProposals }\)/);
  assert.match(showTripSource, /options = {}/);
  assert.match(showTripSource, /options\.refreshProposals !== false[\s\S]*refreshAuthorExpenseProposals\(\)/);
  assert.match(draftSource, /openTrip\(targetTripId, { persistNavigation: false, refreshProposals: false }\)/);
});

test("manual create after TravelIdea context resets back to manual", () => {
  const defaultSource = functionSource("getDefaultItemCreateContext");
  const resetSource = functionSource("resetItemCreateContext");
  const openSource = functionSource("openItemSheet");
  assert.match(defaultSource, /creationMethod: "manual"/);
  assert.match(resetSource, /renderItemDraftWarning\(""\)/);
  assert.match(openSource, /resetItemCreateContext\(\)[\s\S]*fillItemForm/);
});

test("existing TripItem copy source bucket exclusion remains scoped to trip items", () => {
  const dateStepSource = functionSource("renderCardCopyDateStep");
  const actionsSource = functionSource("renderCardCopyActions");
  const confirmSource = functionSource("confirmCardCopy");
  assert.match(dateStepSource, /omitSourceBucket: cardCopyState\.sourceKind === "trip_item" && sameTrip/);
  assert.match(actionsSource, /omitSourceBucket: cardCopyState\.sourceKind === "trip_item" && targetState\.trip\.id === state\.trip\.id/);
  assert.match(confirmSource, /omitSourceBucket: cardCopyState\.sourceKind === "trip_item" && targetState\.trip\.id === state\.trip\.id/);
  assert.match(confirmSource, /createTripItemCopy/);
  assert.match(confirmSource, /creation_method: "copy"/);
  assert.match(confirmSource, /copy_destination_type: copyDestinationType/);
});
