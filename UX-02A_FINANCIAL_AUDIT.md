# Backpacker UX-02A — аудит текущей финансовой модели

Дата аудита: 2026-07-11
Версия приложения: `1.1.2.30`
Commit: `2ab941285e7918deafceeab41b26c67869093fe2`
Тип работы: диагностика без изменения production-кода

## 0. Executive summary

Текущая финансовая модель не использует `paidAmount` для расчёта показателя «Оплачено». Фактическая формула — сумма полной `price` карточек со статусом `paid`. Частичная оплата хранится, но почти нигде не видна и не влияет на финансовые агрегаты.

Единого полного source of truth нет:

- `getTotals()` — общий источник для шапки, основного блока бюджета, PDF header и text share;
- суммы по дням считаются отдельными inline-`reduce`;
- суммы по участникам и смета XLS считаются по `allocations`, а не по `price`;
- карточка поездки на главной показывает только `budgetLimit`;
- список полученных поездок формирует отдельную серверную карточку;
- PDF и экспорты имеют собственные правила отбора карточек.

Главные фактические расхождения:

1. «Оплачено» зависит от `status === "paid"`, а не от `paidAmount`.
2. Частичная оплата не отражается в шапке, бюджете, карточке, PDF, XLS, text share или read-only UI.
3. `backup` исключён из `possible`, но включён в PDF, plan XLS и text share как карточка с ценой.
4. Карточка с датой вне текущего диапазона поездки участвует в общих totals, но исчезает из плана, trip PDF, plan XLS и text share.
5. Неизвестный или отсутствующий статус визуально подписывается как «Хочу», но не входит в `optional`; при этом входит в `possible`.
6. Отрицательные `price`, `paidAmount` и `budgetLimit` допустимы в ручных формах.
7. PDF с выключенной сметой всё равно печатает реальные бюджетные totals в шапке.
8. `list_received` возвращает реальный `budgetLimit`, даже если `include_budget = false`; UI значение не показывает, но payload его содержит.
9. Смета XLS и суммы по участникам используют `allocations`; при повреждённых allocations они могут отличаться от UI, который использует `price`.

Переходить к UX-02B можно без обязательной массовой миграции, если сначала определить backward-compatible трактовку старых `paid`-карточек без `paidAmount` и добавить безопасную нормализацию на чтении. Исправления утечек PDF/API не требуют изменения модели данных.

---

## 1. Baseline

### 1.1 Git и версия

- `APP_VERSION`: `1.1.2.30` (`app.js:18`).
- Commit: `2ab941285e7918deafceeab41b26c67869093fe2`.
- До создания этого отчёта рабочее дерево было чистым.
- В ходе аудита production-код, UI, формулы, exports, share и analytics не менялись.

### 1.2 LocalStorage

Основные ключи:

| Key | Назначение |
|---|---|
| `backpacker.trips.v1` | Основной store всех поездок; карточки лежат внутри `trips[].state.items` |
| `backpacker.mvp.v1` | Legacy/current-state compatibility snapshot активной поездки |
| `backpacker.activeTrip.v1` | ID активной поездки |
| `backpacker.currentView.v1` | Активный раздел поездки |
| `backpacker.shareRecords.v1` | Локальные метаданные опубликованных ссылок |
| `backpacker.analytics.milestones.v1` | Флаги уже отправленных milestone events |

Отдельного localStorage key для карточек нет.

### 1.3 Файлы с финансовой логикой

- `app.js` — модель, normalizer, формы, totals, UI, export, PDF, text share, analytics, AI Draft.
- `index.html` — поля `price`, `paidAmount`, `budgetLimit`, `currency`, status/priority controls.
- `supabase/functions/trip-share/index.ts` — публикация/read-only projection, скрытие бюджета, proposals, received cards.
- `supabase/functions/trip-draft-ai/index.ts` — AI schema для `budgetLimit`, `currency`, `price`, `status`, `priority`.
- `supabase/migrations/202607020001_trip_shares.sql` — хранение snapshot в `trip_shares.state`.
- `supabase/migrations/202607030001_expense_share_proposals.sql` и последующие `...002`, `...003`, `...004`, `202607040008...` — expense proposals и финансовый version digest.
- `supabase/migrations/202607030006_item_proposals.sql`, `...007...` — предложения новых карточек.

### 1.4 Центральные функции

| Функция | Роль |
|---|---|
| `parseMoney` (`app.js:1119`) | Общий клиентский parser денег |
| `normalizeState` (`app.js:890`) | Нормализация items, participants и allocations при загрузке/сохранении |
| `isActiveCost` (`app.js:1429`) | Исключает только `backup` и `skipped` |
| `getTotals` (`app.js:1433`) | `paid`, `fixed`, `optional`, `possible`, `remaining` |
| `getItemAllocations` (`app.js:1344`) | Возвращает доли участников или fallback на owner |
| `getParticipantTotals` (`app.js:1401`) | Суммы по участникам на основе allocations |
| `buildEstimateRows` (`app.js:4073`) | Смета/XLS на основе allocations |
| `buildPlanRows` (`app.js:4100`) | План/XLS на основе item.price |
| `buildShareText` (`app.js:4016`) | Text share с totals из `getTotals` |
| `buildTripPdfBlob` (`app.js:4541`) | Trip PDF; header использует `getTotals` |

---

# A. Текущая модель

## A1. Trip

### `budgetLimit`

- Фактический тип: ожидается `number`, но legacy state может содержать строку, `null`, `undefined` или отрицательное значение.
- Default: `45000` в trainer, `0` в новой пустой поездке.
- Поле может быть пустым в форме; `saveTrip()` превращает пустое значение в `0` через `parseMoney()`.
- `normalizeState()` не нормализует `trip.budgetLimit`.
- В агрегатах применяется `parseMoney(state.trip.budgetLimit)`.
- На Home применяется `Number(value) || 0` через `formatCurrencyAmount`.
- Отрицательное значение не блокируется.

### `currency`

- Фактический тип: строка.
- Default новой поездки и AI fallback: `RUB`.
- Ручная форма ограничена: `RUB`, `EUR`, `SEK`, `USD`, `GEL`, `TRY`, `RSD`, `BAM`.
- `normalizeState()` не проверяет и не восстанавливает отсутствующую/legacy currency.
- У карточки отдельной валюты нет: все `price`, `paidAmount` и `allocations.amount` интерпретируются в валюте поездки.
- При смене валюты `convertTripCurrency()` пересчитывает `budgetLimit`, все `price`, `paidAmount` и allocations.

### Другие связанные поля

- `participants[]` — список участников поездки.
- `includeBudget` не является полем Trip: это настройка `trip_shares.include_budget` и локальной share record.
- Готовые totals в Trip и share snapshot не сохраняются.

## A2. TripItem

| Поле | Default | Пустое | Нормализация / поведение |
|---|---:|---|---|
| `price` | `0`/пусто | Да | Всегда `parseMoney()` в normalizer; AI дополнительно `Math.max(0, ...)` |
| `paidAmount` | `0` | Да | `parseMoney()`; нет clamp к `price`, нет влияния на totals |
| `status` | `want` для новой/AI | Legacy — да | В `normalizeState()` не валидируется и не default-ится |
| `priority` | `nice` | Legacy — да | В `normalizeState()` не валидируется; в финансах не используется |
| `participantId` | self | Legacy — да | В normalizer заменяется на self, если participant отсутствует |
| `allocations[]` | вся price на owner | Да | Положительные доли валидных participants; fallback на owner |

Proposal/source metadata у принятой идеи:

- `creationSource: "accepted_proposal"`;
- `sourceProposalId`;
- `proposedByUserId`;
- `proposedByDisplayName`.

Эти поля не влияют на totals. Expense proposal хранится отдельно в Supabase и после accept меняет только allocations существующей карточки.

Legacy aliases (`cost`, `amountPaid`, `paid_amount`, `totalPrice` и т. п.) не поддерживаются.

## A3. `parseMoney` и граничные значения

Клиентская формула:

```js
Number(String(value || "").replace(/[^\d.-]/g, "")) || 0
```

| Input | Результат |
|---|---:|
| `0`, `null`, `undefined`, `""` | `0` |
| `"10 000"` | `10000` |
| `"10000.50"` | `10000.5` |
| `"10000,50"` | `1000050` — запятая удаляется |
| нечисловая строка | `0` |
| `-1000` | `-1000` |
| несколько точек / malformed | `0` |

Выводы:

- дроби с точкой поддерживаются;
- русская десятичная запятая обрабатывается опасно;
- отрицательные значения поддерживаются;
- `parseInt`/`parseFloat` в финансовых путях не используются;
- клиент не округляет обычные суммы;
- Edge Function округляет proposal/card values до двух знаков;
- смена валюты округляет всё до целого `Math.round`.

## A4. Инварианты цены и оплаты

- Ограничения `paidAmount <= price` нет.
- `paidAmount > price` сохраняется без предупреждения.
- `price = 0`, `paidAmount > 0` сохраняется.
- Статус не меняется автоматически при изменении `paidAmount`.
- `paidAmount` не меняется автоматически при смене статуса.
- Карточка `paid` с `paidAmount = 0` допустима и считается полностью оплаченной на сумму `price`.
- Карточка не `paid` с `paidAmount > 0` не увеличивает paid total.

---

# B. Показатель → формула → места использования

| Показатель | Фактическая формула | Source/function | Использование | Расхождение |
|---|---|---|---|---|
| Бюджет | `parseMoney(trip.budgetLimit)` | inline / formatter | Header, Budget, PDF, Home | Trip field не нормализуется централизованно |
| Оплачено | `Σ price where status === paid` | `getTotals().paid` | Header, Budget, PDF, text share | `paidAmount` игнорируется |
| Бронь | `Σ price where status === fixed` | `getTotals().fixed` | Budget only | Не включает paid; отдельного confirmed aggregate нет |
| Опционально | `Σ price where status ∈ {want, maybe}` | `getTotals().optional` | Budget only | Priority не учитывается |
| Возможный итог | `Σ price where status ∉ {backup, skipped}` | `getTotals().possible` | Header как «Уже распределено», Budget, PDF, text share | Включает want/maybe/unknown; название неоднозначно |
| Остаток | `budgetLimit - possible` | `getTotals().remaining` | Header, Budget, PDF, text share | Это остаток после всех active plans, не после confirmed |
| По дню | `Σ price` active items в конкретной дате | inline в `renderPlan`, `renderBudget`, `buildDaysText` | Day header, Budget by day, days export | Дублируется три раза |
| По участнику | `Σ allocations.amount` active items | `getParticipantTotals` | Budget participants | Может отличаться от `possible` при повреждённых allocations |
| Estimate total | `Σ getItemAllocationTotal(item)` active items | `buildEstimateRows` | Estimate UI, XLS/PDF estimate | Использует allocations, не item.price |
| Home card | `trip.budgetLimit` | `renderHome` | Главная | Других totals нет |

Отдельного агрегата «обязательные расходы» нет. `priority === "must"` нигде в финансовых формулах не участвует.

---

# C. Матрица статусов

| Status | UI label | Paid | Fixed | Optional | Possible | Card/list behavior |
|---|---|---:|---:|---:|---:|---|
| `paid` | Оплачено | `price` | — | — | `price` | Показывается |
| `fixed` | Бронь | — | `price` | — | `price` | Показывается |
| `want` | Хочу | — | — | `price` | `price` | Показывается |
| `maybe` | Думаю | — | — | `price` | `price` | Показывается |
| `backup` | Запас | — | — | — | — | Показывается в Plan/PDF/plan XLS/text share, но не в totals |
| `skipped` | Пропущено | — | — | — | — | Скрыт из Plan/PDF/XLS/share; остаётся в «Все события» |
| отсутствует | fallback «Хочу» | — | — | — | `price` | Может исчезнуть из групп «Все события» |
| unknown (`booked`) | fallback «Хочу» | — | — | — | `price` | Может исчезнуть из групп «Все события» |

При открытии legacy item без status форма select фактически оказывается на первом option (`paid`); сохранение формы может превратить карточку в `paid`. Unknown status даёт пустое select value и при save превращается в `want`.

---

# D. Карта read/write paths

## D1. `budgetLimit`

```text
Trip form / AI preview
→ saveTrip() / normalizeTripDraftResponse()
→ parseMoney() (AI не clamp-ит budget снизу)
→ state.trip.budgetLimit
→ saveState()
→ backpacker.trips.v1 + backpacker.mvp.v1
→ loadTripStore()/loadState()/normalizeState()
→ getTotals().remaining + formatters
→ Header / Budget / Home / PDF / share
```

Дополнительные writes: `convertTripCurrency`, accepted server snapshot reload. `normalizeState()` budget не нормализует.

## D2. `price`

```text
Item form
→ saveItem()
→ parseMoney()
→ TripItem.price
→ normalizeState() повторно parseMoney()
→ localStorage/reload
→ getTotals + day totals + allocations
→ UI/PDF/XLS/share
```

Другие write paths:

- AI: `Math.max(0, parseMoney(price))`, после confirm создаётся обычный item.
- Accepted item proposal: server `numeric >= 0`, status `want`, paid `0`.
- Copy: та же currency — price сохраняется; другая currency — price становится `0`.
- Currency change: `Math.round` после conversion.
- Import пользовательских поездок отсутствует.

## D3. `paidAmount`

```text
Item form
→ saveItem()
→ parseMoney()
→ TripItem.paidAmount
→ localStorage/reload
→ только editor, currency conversion, analytics booleans
```

AI/copy/accepted item proposal задают `0`. В UI totals/exports/share поле не используется.

## D4. `status`

```text
Item select / AI / accepted proposal / copy
→ saveItem or creator
→ TripItem.status
→ localStorage/reload (normalizer не валидирует)
→ getTotals/isActiveCost + visibility filters
→ UI/PDF/XLS/share
```

- Manual default: `want`.
- AI invalid/missing default: `want`.
- Accepted item proposal: `want`.
- Copy of `paid`: меняется на `fixed`; `paidAmount` сбрасывается в `0`.

## D5. `currency`

```text
Trip form / AI
→ saveTrip()/draft normalizer
→ Trip.currency
→ при изменении convertTripCurrency()
→ budgetLimit + price + paidAmount + allocations Math.round
→ localStorage/reload
→ все formatters/exports/share
```

У item отдельной currency нет.

---

# E. Тестовая матрица

Бюджет каждого отдельного кейса: `100 000 RUB`. Значения ниже показывают вклад одной карточки.

| # | Case | Paid | Fixed | Optional | Possible | Day | Participant | Поверхности |
|---:|---|---:|---:|---:|---:|---:|---:|---|
| 1 | 20k / paid 20k / `paid` | 20k | 0 | 0 | 20k | 20k | 20k | Везде как price 20k |
| 2 | 30k / paid 10k / `fixed` | 0 | 30k | 0 | 30k | 30k | 30k | paidAmount 10k виден только в editor |
| 3 | 15k / 0 / `fixed` | 0 | 15k | 0 | 15k | 15k | 15k | Везде как price 15k |
| 4 | 8k / `want` | 0 | 0 | 8k | 8k | 8k | 8k | Active во всех totals |
| 5 | 6k / `maybe` | 0 | 0 | 6k | 6k | 6k | 6k | Active во всех totals |
| 6 | 12k / `backup` | 0 | 0 | 0 | 0 | 0 | 0 | Card есть в PDF/plan XLS/text, estimate исключает |
| 7 | 5k / `skipped` | 0 | 0 | 0 | 0 | 0 | 0 | Исключён из PDF/XLS/text и Plan |
| 8 | price 0 / paid 0 | 0 | 0 | 0 | 0 | 0 | 0 | Строка/card сохраняется с нулём |
| 9 | empty / empty | 0 | 0 | 0 | 0 | 0 | 0 | После save становится 0/0 |
| 10 | price 10k / paid 15k / `paid` | 10k | 0 | 0 | 10k | 10k | 10k | Переплата 15k игнорируется |
| 11 | price 0 / paid 5k / `paid` | 0 | 0 | 0 | 0 | 0 | 0 | Оплата 5k игнорируется |
| 12 | price -1k / `fixed` | 0 | -1k | 0 | -1k | -1k | 0 | Remaining увеличивается; estimate allocations = 0 |
| 13 | price 1k / paid -500 / `fixed` | 0 | 1k | 0 | 1k | 1k | 1k | Negative paid сохраняется и игнорируется |
| 14 | price `"10 000"` | 0 | 0 | 10k | 10k | 10k | 10k | Нормализуется корректно |
| 15 | price `"10000.50"` | 0 | 0 | 10000.5 | 10000.5 | 10000.5 | 10000.5 | Client хранит дробь |
| 16 | status отсутствует | 0 | 0 | 0 | 1k | 1k | 1k | UI label «Хочу», но optional = 0 |
| 17 | status `booked` | 0 | 0 | 0 | 1k | 1k | 1k | То же; нет legacy mapping |
| 18 | без даты / `want` 1k | 0 | 0 | 1k | 1k | 0 | 1k | Есть в overall, undated PDF/XLS/text |
| 19 | `skipped` | 0 | 0 | 0 | 0 | 0 | 0 | См. #7 |
| 20 | allocation participant 1k | по status | по status | по status | price один раз | price | allocation | Proposal меняет owner, не общий total |

### E1. Частичная оплата — ключевой кейс

Отель: `price = 30 000`, `paidAmount = 10 000`, `status = fixed`.

- Карточка в Plan: показывает только `30 000`, статус «Бронь».
- Editor: показывает `price = 30 000`, `paidAmount = 10 000`.
- Header «Оплачено»: `0`.
- Budget «Уже оплачено»: `0`.
- Budget «Бронь»: `30 000`.
- Header «Уже распределено»: `30 000`.
- Оставшиеся к оплате `20 000` отдельно нигде не показаны.
- PDF: price `30 000`; paid total `0`; paidAmount не выводится.
- Estimate/Plan XLS: paidAmount отсутствует.
- Text share: план `30 000`, оплачено `0`.
- Read-only: те же расчёты при открытой смете.

---

# F. Parity-таблица

Для валидной поездки все поверхности, использующие `getTotals`, совпадают. Таблица ниже показывает фактический контракт.

| Метрика | UI/Header | Home | Trip PDF | Estimate XLS | Plan XLS | Text share | Read-only |
|---|---|---|---|---|---|---|---|
| Budget limit | Да | Да | Да | Нет | Нет | Не выводится числом | Да/скрыто |
| Paid | `Σ price(status=paid)` | Нет | Та же формула | Нет | Нет | Та же формула | Пересчёт той же формулой |
| Fixed | Да, Budget only | Нет | Нет | Нет | status в строке | Нет | Пересчёт в Budget |
| Optional | Да, Budget only | Нет | Нет | Нет | status в строке | Нет | Пересчёт в Budget |
| Possible | Да | Нет | Та же формула | Аналог через allocations | Нет total | Та же формула как «План» | Пересчёт |
| Remaining | Да | Нет | Та же формула | Нет | Нет | Та же формула | Пересчёт |
| paidAmount | Editor only | Нет | Нет | Нет | Нет | Нет | Не виден |

### F1. Синтетическая совокупная матрица ТЗ

При объединении кейсов 1–18 и карточки с датой вне диапазона:

- UI `paid`: `30 000`.
- UI `fixed`: `46 000`.
- UI `optional`: `35 000.5`.
- UI `possible`: `113 000.5`.
- UI `remaining`: `-13 000.5`.
- Participant/estimate XLS total: `114 000.5` из-за отрицательной price без allocation.
- Сумма цен видимых PDF/plan XLS/text карточек: `124 000.5`, потому что они включают backup и пропускают out-of-range item.

Это диагностическая матрица, а не предлагаемая продуктовая формула.

---

# G. Read-only share

## G1. Snapshot

- В `trip_shares.state` сохраняется нормализованный полный state без готовых totals.
- `schema_version = trip_share.v1` сохраняется и возвращается сервером.
- Клиент не использует `schemaVersion` для ветвления или миграции.
- Read-only client запускает текущий `normalizeState(payload.state)` и пересчитывает totals локально.
- Старый snapshot поэтому интерпретируется текущими формулами.

## G2. Скрытая смета

`stripBudget()` рекурсивно удаляет:

- `price`;
- `paidAmount`;
- `budgetLimit`;
- `allocations`.

Для `read` и `read_received` это серверное удаление работает. После normalizer отсутствующие суммы становятся `0`, но UI использует `canShowBudget()` и показывает «Скрыто».

Расхождение: `list_received` вызывает `getTripCard()` на полном state и возвращает `budgetLimit` даже при `include_budget = false`. Frontend пишет «Смета скрыта», но реальное значение присутствует в response payload. Класс исправления: `export/share` + privacy.

## G3. Staleness

- Share snapshot обновляется debounce-механизмом после `saveState()`.
- При сетевой ошибке публичный snapshot может временно отставать от local state.
- Отдельных totals нет, поэтому формульного рассогласования при одинаковом snapshot нет; возможны только stale data и normalizer differences.

---

# H. Backup, skipped, hidden и out-of-range

- `backup`: исключён из общего бюджета, day totals, participant totals и estimate XLS; при этом карточка видна в Plan, PDF, plan XLS и text share с ценой.
- `skipped`: исключён из totals и большинства поверхностей; остаётся доступен в «Все события».
- Undated: входит в overall totals и participant totals; не входит в day totals; включается в PDF/plan XLS/text share как «Без даты».
- Out-of-range dated item: входит в overall totals, participants и estimate XLS; не виден в Plan, trip PDF, plan XLS и text share.
- Deleted item: физически удаляется из `state.items` и больше нигде не считается.
- AI draft до confirm: не входит в state и бюджет.
- Pending item proposal: не входит в state и бюджет.
- Accepted item proposal: становится обычным `want` item и начинает входить в optional/possible.
- Pending/rejected expense proposal: не меняет allocations и totals.
- Accepted expense proposal: меняет allocations, но не price и не общий total.

Ответ на ключевой вопрос: да, карточка с датой, оставшейся за пределами нового диапазона поездки, может исчезнуть из основного плана и большинства exports/share, но продолжить участвовать в общем бюджете.

---

# I. Legacy и normalizer

`normalizeState()` мутирует переданный объект in-place и возвращает его.

Что нормализуется:

- `price`, `paidAmount`, allocation amounts через `parseMoney`;
- participants и self participant;
- `participantId` fallback;
- allocations fallback и частичная коррекция суммы.

Что не нормализуется:

- `trip.budgetLimit`;
- `trip.currency`;
- `item.status`;
- `item.priority`;
- legacy aliases финансовых полей.

Открытие поездки работает с clone и записывает нормализованный current state в legacy `backpacker.mvp.v1`. Основной `backpacker.trips.v1` переписывается после следующего `saveState()`.

`NaN` в основных totals маловероятен: `parseMoney` возвращает `0`. Возможны логические ошибки без NaN: отрицательные totals, неверная десятичная запятая, unknown status и allocations mismatch.

Normalizer allocations:

- удаляет нулевые/отрицательные/невалидные доли;
- создаёт owner allocation = price, если allocations пусты и price > 0;
- корректирует последнюю долю на delta;
- если excess больше последней доли, `Math.max(0, ...)` может оставить общий allocation total больше price;
- duplicate allocations одного participant не объединяются.

Массовая миграция для UX-02B не обязательна. Нужен backward-compatible normalizer и отдельно принятое правило для legacy `status=paid`, `paidAmount=0/missing`.

---

# J. Участники и proposals

Главный инвариант в обычных валидных данных соблюдается: общий бюджет использует item.price один раз независимо от числа участников.

- `participantId` — primary owner/fallback.
- `allocations` делят price между participants.
- `getParticipantTotals` считает allocations только active items.
- Expense proposal до accept не влияет на бюджет.
- Accept переносит сумму из allocation автора в allocation участника.
- Reject/withdraw не меняет item.
- Server проверяет `amount > 0`, `amount <= author allocation`, currency и financial version.
- После первого accepted proposal allocations меняются; конкурентное старое предложение становится stale при accept.
- Изменение price/allocations/currency после предложения меняет financial digest и защищает accept.
- Изменение `paidAmount` или `status` не входит в financial digest, поскольку proposal меняет только ownership доли.

Риск duplicate allocations: удаление participant заменяет его ID на self, но не объединяет записи. Participant total суммирует обе записи, а `buildEstimateRows` создаёт `Map` и может оставить только последнюю запись для participant column. Row total и сумма participant columns могут разойтись.

---

# K. Валюта и округление

- Только одна currency на Trip.
- Item currency отсутствует.
- `convertTripCurrency` использует rates-to-RUB и округляет каждое значение до целого.
- Demo fallback rates напрямую влияют на изменение сохранённых сумм при смене валюты.
- Live/fallback status не сохраняется вместе с item.
- Price, paidAmount и каждая allocation округляются отдельно.
- После currency save сохранённая clone нормализуется, но текущий in-memory state до reload может иметь временный allocation mismatch.
- Client ordinary amounts могут иметь дроби; `formatMoney` использует locale defaults (обычно до 3 знаков).
- `formatCurrencyAmount` ограничивает вывод двумя знаками.
- Edge Function proposal values округляет двумя знаками.
- XLS хранит raw number без общего formatter.

AI item в другой валюте не поддерживается: AI выбирает currency поездки, отдельной currency карточки нет. Cross-currency copy обнуляет price вместо conversion.

---

# L. Analytics

Реальные финансовые суммы в PostHog не отправляются.

Финансовые/похожие свойства:

- `has_budget`: `parseMoney(budgetLimit) > 0`;
- `has_costs`: существует active item с `price > 0`;
- `has_paid_amounts`: существует active item с `paidAmount > 0`;
- item flags: `has_price`, `has_paid_amount`;
- `item_status`, `item_priority`;
- `currency_changed`;
- export flags `include_budget` и options buckets.

Milestones:

- `trip_first_value_reached` использует item/scheduled/meaningful counts; price или paidAmount являются planning signal, но суммы не отправляются.
- `trip_working_plan_reached` использует `has_budget`, `has_costs`, `has_paid_amounts`, statuses/priorities и структурные counts.

Риски UX-02B:

- изменение определения active/confirmed items может изменить `has_costs` и момент milestone;
- изменение нормализации paidAmount может изменить `has_paid_amounts`;
- definition version следует поднять, если семантика milestone будет изменена;
- отрицательные values дают boolean `has_price/has_paid_amount = true` в item events через `Boolean(value)`, но milestone `> 0` вернёт false.

Свободный financial/user text и реальные суммы текущими финансовыми событиями не отправляются.

---

# M. PDF и export-specific findings

## M1. Trip PDF

- Header всегда вызывает `getTotals()`.
- `options.includeBudget` применяется к price pill карточек.
- Но header всегда печатает Budget, Paid, Possible, Remaining независимо от `includeBudget`.
- Функция `drawBudget()` содержит отдельный budget block, но фактически не вызывается.
- PDF включает `backup`, исключает `skipped`, включает undated по option.
- Out-of-range dated items не попадают в PDF, но влияют на header totals.

Критичный класс исправления: `export/share` privacy + parity.

## M2. XLS

Есть два разных XLS:

1. Estimate XLS: active items, allocations, итоговая строка; нет status, paidAmount и budgetLimit.
2. Plan XLS: status и price по карточкам; нет paidAmount и итоговой строки; включает backup, исключает skipped и out-of-range.

## M3. Text share

- Summary использует `getTotals`: Paid, Plan=Possible, Remaining.
- Item list включает backup и исключает skipped.
- Out-of-range dated items отсутствуют в списке, но входят в summary totals.

---

# N. Найденные расхождения и классы исправлений

## Критичные

| Проблема | Класс |
|---|---|
| PDF раскрывает totals при выключенной смете | export/share + privacy |
| `list_received` возвращает budgetLimit при hidden budget | export/share + privacy |
| «Оплачено» игнорирует paidAmount | formula + labels |
| Out-of-range item невидим, но влияет на totals | formula/UI/export parity |

## Средние

| Проблема | Класс |
|---|---|
| Partial payment нигде не виден вне editor | formula + UI + export |
| Unknown status выглядит как «Хочу», но optional не считает его | normalizer + legacy |
| Negative values разрешены | validation + normalizer |
| Decimal comma превращает `10000,50` в `1000050` | parser/normalizer |
| Estimate/participant totals зависят от allocations, UI — от price | formula/source-of-truth |
| Backup виден с ценой, но исключён из totals | labels/export parity |
| Duplicate allocations могут ломать participant columns | normalizer |
| Share schemaVersion возвращается, но client его игнорирует | migration/read path |

## Косметические/семантические

- Header «Уже распределено» фактически означает possible total всех active statuses.
- «Осталось распределить» фактически `budget - possible`.
- Fixed label «Бронь» — единственный отдельный confirmed-like aggregate.
- Priority `must` не является финансовой категорией.

---

# O. AI Link Intake risks

Будущий поток `URL → ItemDraft → review → TripItem` должен учитывать текущие ограничения:

- Draft с price без status после обычного confirm логично получит default `want`.
- После превращения в TripItem цена сразу войдёт в optional и possible.
- До пользовательского confirm Draft не должен попадать в `state.items` и totals — как текущий AI Draft.
- Примерная цена, «от» и диапазон не представимы одним `price` без потери смысла; до UX-02B безопасно хранить выбранное значение только после подтверждения, исходную формулировку — в notes/source context.
- Другая currency не поддерживается на item: нужна конвертация в trip currency или явный запрос пользователю.
- Optional Draft fields: type, status, priority, date, time, duration, price, link, location, notes.
- Title должен быть обязательным до создания TripItem.
- Перед confirm нужны: finite/nonnegative price, supported status/priority, supported/converted currency, safe URL, valid date/time.
- Автоматически извлечённая price не должна считаться подтверждённой или оплаченной.

---

# P. Рекомендации для UX-02B

Ниже варианты, не реализация.

## Вариант 1 — рекомендуемый, field-driven payment

Без новых полей и статусов:

```text
paidTotal = Σ clamp(paidAmount, 0, price) по active items
confirmedTotal = Σ price для status ∈ {paid, fixed}
confirmedOutstanding = Σ max(price - effectivePaid, 0) для {paid, fixed}
additionalTotal = Σ price для status ∈ {want, maybe}
possibleTotal = confirmedTotal + additionalTotal
remainingConfirmed = budgetLimit - confirmedTotal
remainingAll = budgetLimit - possibleTotal
```

- `backup`, `skipped`, unknown исключаются из финансовых totals до явной нормализации.
- `priority` не участвует.
- Нужна backward-compatible политика для legacy `paid` с missing/zero paidAmount.

Плюс: частичная оплата становится однозначной. Минус: старые paid items без корректного paidAmount потребуют fallback или однократного review.

## Вариант 2 — legacy-compatible effective paid

```text
effectivePaid(item) =
  paidAmount > 0 ? clamp(paidAmount, 0, price)
  : status === paid ? max(price, 0)
  : 0
```

Остальные формулы — как в варианте 1.

Плюс: не ломает старые paid cards. Минус: `paidAmount = 0` для paid item нельзя отличить от legacy missing/неактуального значения; семантика остаётся смешанной.

### Нужна ли миграция

- Массовая обязательная миграция не нужна для вычислений, если normalizer даёт safe defaults.
- Для строгого варианта 1 полезен диагностический/пользовательский review legacy paid items, но это отдельное решение UX-02B.
- Новые поля или новый обязательный статус не рекомендуются по умолчанию.

---

# Q. Acceptance checklist

- [x] Production formulas/UI/data model не менялись.
- [x] Модель Trip/TripItem описана.
- [x] Read/write paths описаны.
- [x] Статусы и фактические агрегаты описаны.
- [x] Проверены Header, Budget, Home, PDF, XLS, text share, read-only share.
- [x] Проверена частичная оплата.
- [x] Проверены backup, skipped, undated, deleted, out-of-range, drafts/proposals.
- [x] Проверены legacy data и normalizer.
- [x] Проверены participants и expense/item proposals.
- [x] Проверены currency и rounding.
- [x] Проверена analytics semantics без отправки пользовательских данных.
- [x] Зафиксированы AI Link Intake risks.
- [x] Построена parity-таблица и синтетическая матрица.
- [x] Для проблем указан предполагаемый класс исправления.
- [x] Даны два варианта UX-02B без implementation.
