#!/usr/bin/env node
// Unit tests for LangToggleModel.js
// Run with: node test/unit/lang-toggle-model-test.js
//
// The xkb fixture is a trimmed copy of the real `xkbcli list --load-exotic`
// output, including the multi-variant blocks that share a layout code, because
// the code table has to pick the default variant and ignore the rest.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load the model (it's Qt-free JavaScript)
const modelPath = path.join(__dirname, '../../LangToggleModel.js')
const modelCode = fs.readFileSync(modelPath, 'utf8')

// Create a module context
const module = { exports: {} }
eval(modelCode)
const {
  layoutBriefs,
  layoutCodes,
  layoutTable,
  codeBrief,
  otherEnEsIndex,
  toggleTargetIndex,
  briefFor,
  shortLabel,
  eventKeyboardName,
  isTypedKeyboard,
  selectKeyboard,
  isEnEsLayout
} = module.exports

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log('✅ PASS:', message)
    passed++
  } else {
    console.log('❌ FAIL:', message)
    failed++
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log('✅ PASS:', message)
    passed++
  } else {
    console.log('❌ FAIL:', message, '- expected:', JSON.stringify(expected), 'got:', JSON.stringify(actual))
    failed++
  }
}

// Real xkbcli output, trimmed. The variant blocks after the default one share
// the layout code, and the models block carries no brief of its own.
const xkbOutput = `
- layout: 'us'
  variant: ''
  brief: 'en'
  description: English (US)
  iso639: ['eng']
- layout: 'us'
  variant: 'intl'
  brief: 'en'
  description: English (US, intl., with dead keys)
- layout: 'es'
  variant: ''
  brief: 'es'
  description: Spanish
- layout: 'es'
  variant: 'nodeadkeys'
  brief: 'es'
  description: Spanish (no dead keys)
- layout: 'latam'
  variant: ''
  brief: 'es'
  description: Spanish (Latin American)
- layout: 'latam'
  variant: 'nodeadkeys'
  brief: 'es'
  description: Spanish (Latin American, no dead keys)
- layout: 'fr'
  variant: ''
  brief: 'fr'
  description: French (FR)
- layout: 'de'
  variant: ''
  brief: 'de'
  description: German (DE)
- layout: 'gb'
  variant: ''
  brief: 'en'
  description: English (UK)
`

// --- layoutTable ----------------------------------------------------------

console.log('\n--- layoutTable tests ---')
const table = layoutTable(xkbOutput)
assert(typeof table.briefs === 'object' && typeof table.codes === 'object', 'layoutTable returns briefs and codes')
assertEqual(table.briefs['English (US)'], 'en', 'English (US) -> en')
assertEqual(table.briefs['Spanish'], 'es', 'Spanish -> es')
assertEqual(table.briefs['Spanish (Latin American)'], 'es', 'Spanish (Latin American) -> es')
assertEqual(table.briefs['French (FR)'], 'fr', 'French (FR) -> fr')
assertEqual(table.briefs['German (DE)'], 'de', 'German (DE) -> de')
assertEqual(table.briefs['English (UK)'], 'en', 'English (UK) -> en')
assertEqual(table.briefs['Non-existent'], undefined, 'Non-existent description returns undefined')

// The code table must claim the default variant, and the variants that share
// the code must not overwrite it.
assertEqual(table.codes['us'], 'en', 'code us -> en')
assertEqual(table.codes['es'], 'es', 'code es -> es')
assertEqual(table.codes['latam'], 'es', 'code latam -> es')
assertEqual(table.codes['fr'], 'fr', 'code fr -> fr')
assertEqual(table.codes['de'], 'de', 'code de -> de')
assertEqual(table.codes['gb'], 'en', 'code gb -> en')
assertEqual(table.codes['nonexistent'], undefined, 'Unknown code returns undefined')

// Every variant block still contributes its description.
assertEqual(table.briefs['English (US, intl., with dead keys)'], 'en', 'Variant block contributes its description')
assertEqual(table.briefs['Spanish (no dead keys)'], 'es', 'Spanish variant contributes its description')

// The last block in the file must not be dropped.
const lastBlockTable = layoutTable("- layout: 'jp'\n  variant: ''\n  brief: 'ja'\n  description: Japanese\n")
assertEqual(lastBlockTable.briefs['Japanese'], 'ja', 'Last block is not dropped')
assertEqual(lastBlockTable.codes['jp'], 'ja', 'Last block claims its code')

// --- layoutBriefs (compatibility wrapper) ---------------------------------

console.log('\n--- layoutBriefs tests ---')
const briefs = layoutBriefs(xkbOutput)
assertEqual(briefs['English (US)'], 'en', 'English (US) -> en')
assertEqual(briefs['Spanish (ES)'], undefined, 'Unknown description returns undefined')
assertEqual(Object.keys(layoutBriefs('')).length, 0, 'Empty string returns empty table')
assertEqual(Object.keys(layoutBriefs(null)).length, 0, 'Null returns empty table')

// --- layoutCodes ----------------------------------------------------------

console.log('\n--- layoutCodes tests ---')
assertEqual(layoutCodes('latam,us').join('|'), 'latam|us', 'Splits a layout list')
assertEqual(layoutCodes('us').join('|'), 'us', 'Single layout')
assertEqual(layoutCodes(' us , latam ').join('|'), 'us|latam', 'Trims whitespace')
assertEqual(layoutCodes('').length, 0, 'Empty list yields no codes')
assertEqual(layoutCodes(null).length, 0, 'Null list yields no codes')
assertEqual(layoutCodes('us,,latam').join('|'), 'us|latam', 'Empty entries are dropped')

// --- codeBrief ------------------------------------------------------------

console.log('\n--- codeBrief tests ---')
assertEqual(codeBrief(table.codes, 'us'), 'en', 'codeBrief us -> en')
assertEqual(codeBrief(table.codes, 'latam'), 'es', 'codeBrief latam -> es')
assertEqual(codeBrief(table.codes, ' unknown '), '', 'Unknown code yields empty brief')
assertEqual(codeBrief(null, 'us'), '', 'Null table yields empty brief')
assertEqual(codeBrief(table.codes, ''), '', 'Empty code yields empty brief')

// --- otherEnEsIndex (the toggle core) ------------------------------------

console.log('\n--- otherEnEsIndex tests ---')
// The real seat: hyprctl reports codes, the active keymap is a description.
assertEqual(otherEnEsIndex('latam,us', table.codes, 'en'), 0, 'EN active -> Spanish slot (index 0)')
assertEqual(otherEnEsIndex('latam,us', table.codes, 'es'), 1, 'ES active -> English slot (index 1)')
assertEqual(otherEnEsIndex('us,latam', table.codes, 'en'), 1, 'us,latam with EN active -> index 1')
assertEqual(otherEnEsIndex('us,latam', table.codes, 'es'), 0, 'us,latam with ES active -> index 0')
assertEqual(otherEnEsIndex('us,es', table.codes, 'en'), 1, 'us,es with EN active -> index 1')
assertEqual(otherEnEsIndex('es,us', table.codes, 'es'), 1, 'es,us with ES active -> index 1')

// A third, unrelated layout must not be picked.
assertEqual(otherEnEsIndex('us,de,latam', table.codes, 'en'), 2, 'Skips the unrelated German slot')
assertEqual(otherEnEsIndex('de,us,latam', table.codes, 'es'), 1, 'Skips the German slot in the middle')

// No other EN/ES on the seat: inert, never a wrong switch.
assertEqual(otherEnEsIndex('us,de', table.codes, 'en'), -1, 'No ES on the seat -> -1')
assertEqual(otherEnEsIndex('latam,fr', table.codes, 'es'), -1, 'No EN on the seat -> -1')
assertEqual(otherEnEsIndex('de,fr', table.codes, 'de'), -1, 'Neither EN nor ES on the seat -> -1')
assertEqual(otherEnEsIndex('', table.codes, 'en'), -1, 'Empty layout list -> -1')
assertEqual(otherEnEsIndex(null, table.codes, 'en'), -1, 'Null layout list -> -1')
assertEqual(otherEnEsIndex('us,latam', null, 'en'), -1, 'Null code table -> -1')
assertEqual(otherEnEsIndex('us,latam', {}, 'en'), -1, 'Empty code table -> -1')
assertEqual(otherEnEsIndex('us,latam', table.codes, ''), 0, 'Unknown current brief still finds the ES slot')

// The brief of the active layout comes from the description table, so the
// full round trip has to line up.
const activeDescription = 'English (US)'
const activeBrief = briefs[activeDescription]
assertEqual(activeBrief, 'en', 'Active description resolves to a brief')
assertEqual(otherEnEsIndex('latam,us', table.codes, activeBrief), 0, 'Round trip: English (US) -> Spanish slot')

// --- shortLabel -----------------------------------------------------------

console.log('\n--- shortLabel tests ---')
assertEqual(shortLabel('English (US)', briefs), 'EN', 'English (US) -> EN')
assertEqual(shortLabel('Spanish', briefs), 'ES', 'Spanish -> ES')
assertEqual(shortLabel('Spanish (Latin American)', briefs), 'ES', 'Spanish (Latin American) -> ES')
assertEqual(shortLabel('French (FR)', briefs), 'FR', 'French (FR) -> FR')
assertEqual(shortLabel('German (DE)', briefs), 'DE', 'German (DE) -> DE')
assertEqual(shortLabel('English (UK)', briefs), 'EN', 'English (UK) -> EN')
assertEqual(shortLabel('Unknown Layout', briefs), 'UNK', 'Unknown falls back to first word')
assertEqual(shortLabel('English (US)', {}), 'EN', 'Without the xkb table English reads EN')
assertEqual(shortLabel('Spanish (Latin American)', {}), 'ES', 'Without the xkb table Spanish reads ES')
assertEqual(shortLabel('English (US)', null), 'EN', 'Without a table at all English reads EN')
assertEqual(shortLabel('', briefs), '', 'Empty string returns empty')
assertEqual(shortLabel(null, briefs), '', 'Null returns empty')

// --- eventKeyboardName ----------------------------------------------------

console.log('\n--- eventKeyboardName tests ---')
const mockEvent = {
  parse: (n) => ['at-translated-set-2-keyboard', 'English (US)'],
  data: 'at-translated-set-2-keyboard,English (US)'
}
assertEqual(eventKeyboardName(mockEvent), 'at-translated-set-2-keyboard', 'Parses keyboard name from event')

const virtualEvent = {
  parse: (n) => ['hl-virtual-keyboard', 'English (US)'],
  data: 'hl-virtual-keyboard,English (US)'
}
assertEqual(eventKeyboardName(virtualEvent), '', 'Ignores virtual keyboard')

const rawEvent = { data: 'at-translated-set-2-keyboard,Spanish (ES)' }
assertEqual(eventKeyboardName(rawEvent), 'at-translated-set-2-keyboard', 'Handles raw string event')

// --- isTypedKeyboard ------------------------------------------------------

console.log('\n--- isTypedKeyboard tests ---')
assert(isTypedKeyboard('at-translated-set-2-keyboard'), 'Real keyboard is typed')
assert(isTypedKeyboard('logitech-keyboard'), 'Logitech keyboard is typed')
assert(!isTypedKeyboard('hl-virtual-keyboard'), 'Virtual keyboard is not typed')
assert(!isTypedKeyboard('power-button'), 'Power button is not typed')
assert(!isTypedKeyboard('sleep-button'), 'Sleep button is not typed')
assert(!isTypedKeyboard('lid-switch'), 'Lid switch is not typed')
assert(!isTypedKeyboard('video-bus'), 'Video bus is not typed')
assert(!isTypedKeyboard('intel-hid-events'), 'Intel HID events is not typed')
assert(!isTypedKeyboard('thinkpad-extra-buttons'), 'ThinkPad extra buttons is not typed')

// --- selectKeyboard -------------------------------------------------------

console.log('\n--- selectKeyboard tests ---')
const keyboards = [
  { name: 'keyboard1', active_layout_index: 0, layout: 'latam,us' },
  { name: 'keyboard2', active_layout_index: 1, layout: 'latam,us' },
  { name: 'keyboard3', active_layout_index: 0, layout: 'us' }
]

assertEqual(selectKeyboard(keyboards, 'keyboard2').name, 'keyboard2', 'Selects keyboard by event name')
assertEqual(selectKeyboard(keyboards, 'keyboard3').name, 'keyboard3', 'Selects first when tie on furthest advanced')
assertEqual(selectKeyboard([], 'keyboard1'), undefined, 'Returns undefined for empty array')
assertEqual(selectKeyboard(null, 'keyboard1'), undefined, 'Returns undefined for null array')

// --- isEnEsLayout ---------------------------------------------------------

console.log('\n--- isEnEsLayout tests ---')
assert(isEnEsLayout('English (US)'), 'English (US) is EN/ES')
assert(isEnEsLayout('English (UK)'), 'English (UK) is EN/ES')
assert(isEnEsLayout('Spanish'), 'Spanish is EN/ES')
assert(isEnEsLayout('Spanish (ES)'), 'Spanish (ES) is EN/ES')
assert(isEnEsLayout('Spanish (Latin American)'), 'Spanish (Latin American) is EN/ES')
assert(!isEnEsLayout('French (FR)'), 'French is not EN/ES')
assert(!isEnEsLayout('German (DE)'), 'German is not EN/ES')
assert(!isEnEsLayout(''), 'Empty is not EN/ES')
assert(!isEnEsLayout(null), 'Null is not EN/ES')

// --- briefFor --------------------------------------------------------------

console.log('\n--- briefFor tests ---')
assertEqual(briefFor('English (US)', briefs), 'en', 'English (US) -> en')
assertEqual(briefFor('Spanish (Latin American)', briefs), 'es', 'Spanish (Latin American) -> es')
assertEqual(briefFor('French (FR)', briefs), 'fr', 'French (FR) -> fr')

// The table did not answer, or did not carry the description: the description
// of an English or a Spanish layout still names its own language, which is
// what keeps the badge readable without xkb's table.
assertEqual(briefFor('English (US)', {}), 'en', 'Empty table -> en from the description')
assertEqual(briefFor('English (UK)', {}), 'en', 'Empty table -> en from the description')
assertEqual(briefFor('Spanish (Latin American)', {}), 'es', 'Empty table -> es from the description')
assertEqual(briefFor('Spanish (ES)', null), 'es', 'Null table -> es from the description')
assertEqual(briefFor('French (FR)', {}), '', 'A description naming no language has no brief')
assertEqual(briefFor('constructor', briefs), '', 'An inherited member is not a brief')
assertEqual(briefFor('', briefs), '', 'Empty description has no brief')
assertEqual(briefFor(null, briefs), '', 'Null description has no brief')

// --- toggleTargetIndex -----------------------------------------------------

console.log('\n--- toggleTargetIndex tests ---')
// Where the keyboard stands comes from hyprctl twice: the description of the
// active layout and its index in the layout list. The index is what the
// toggle believes, because the description only names a language when xkb's
// table answered.
assertEqual(toggleTargetIndex('latam,us', table.codes, 1, 'en'), 0, 'Index 1 (EN) -> Spanish slot (index 0)')
assertEqual(toggleTargetIndex('latam,us', table.codes, 0, 'es'), 1, 'Index 0 (ES) -> English slot (index 1)')
assertEqual(toggleTargetIndex('us,latam', table.codes, 0, 'en'), 1, 'us,latam, index 0 -> index 1')
assertEqual(toggleTargetIndex('us,latam', table.codes, 1, 'es'), 0, 'us,latam, index 1 -> index 0')
assertEqual(toggleTargetIndex('es,us', table.codes, 1, 'es'), 0, 'es,us, index 1 -> index 0')
assertEqual(toggleTargetIndex('us,es', table.codes, 0, 'en'), 1, 'us,es, index 0 -> index 1')

// The bug the index replaces: the active layout was found by its brief, so a
// description xkb's table did not carry left the comparison with nothing to
// compare, and the toggle resolved to the slot the keyboard was already on.
// That switches nothing and reads as a dead key.
assertEqual(toggleTargetIndex('us,latam', table.codes, 0, ''), 1, 'Unknown brief, index 0 -> the other slot (index 1)')
assertEqual(toggleTargetIndex('latam,us', table.codes, 0, ''), 1, 'Unknown brief, index 0 -> the other slot (index 1)')
assertEqual(toggleTargetIndex('us,latam', table.codes, 1, ''), 0, 'Unknown brief, index 1 -> the other slot (index 0)')

// A third, unrelated layout must not be picked.
assertEqual(toggleTargetIndex('us,de,latam', table.codes, 0, 'en'), 2, 'Skips the unrelated German slot')
assertEqual(toggleTargetIndex('de,us,latam', table.codes, 1, 'es'), 2, 'Skips the German slot in the middle')

// On neither of the two: English leads.
assertEqual(toggleTargetIndex('de,us,latam', table.codes, 0, 'de'), 1, 'Neither active -> the English slot')
assertEqual(toggleTargetIndex('latam,fr,us', table.codes, 1, 'fr'), 2, 'Neither active, English last -> the English slot')

// No pair on the seat: inert, never a wrong switch.
assertEqual(toggleTargetIndex('us,de', table.codes, 0, 'en'), -1, 'No ES on the seat -> -1')
assertEqual(toggleTargetIndex('latam,fr', table.codes, 0, 'es'), -1, 'No EN on the seat -> -1')
assertEqual(toggleTargetIndex('de,fr', table.codes, 0, 'de'), -1, 'Neither EN nor ES on the seat -> -1')
assertEqual(toggleTargetIndex('', table.codes, 0, 'en'), -1, 'Empty layout list -> -1')
assertEqual(toggleTargetIndex(null, table.codes, 0, 'en'), -1, 'Null layout list -> -1')
assertEqual(toggleTargetIndex('us,latam', null, 0, 'en'), -1, 'Null code table -> -1')
assertEqual(toggleTargetIndex('us,latam', {}, 0, 'en'), -1, 'Empty code table -> -1')

// A Hyprland that reports no index falls back to the brief.
assertEqual(toggleTargetIndex('latam,us', table.codes, undefined, 'en'), 0, 'No index, EN active -> Spanish slot')
assertEqual(toggleTargetIndex('latam,us', table.codes, null, 'es'), 1, 'No index, ES active -> English slot')
assertEqual(toggleTargetIndex('latam,us', table.codes, undefined, ''), 0, 'No index and no brief -> the first EN/ES slot')
assertEqual(toggleTargetIndex('latam,us', table.codes, 9, 'en'), 0, 'An index past the seat -> the brief decides')

// Summary
console.log('\n=== SUMMARY ===')
console.log('Passed:', passed)
console.log('Failed:', failed)
console.log('Total:', passed + failed)

if (failed > 0) {
  process.exit(1)
}
