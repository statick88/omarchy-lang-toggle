#!/usr/bin/env node
// Unit tests for LangToggleModel.js
// Run with: node test/unit/lang-toggle-model-test.js

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
  shortLabel,
  eventKeyboardName,
  isTypedKeyboard,
  selectKeyboard,
  isEnEsLayout,
  getOtherEnEsLayout,
  getLayoutIndex
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
    console.log('❌ FAIL:', message, '- expected:', expected, 'got:', actual)
    failed++
  }
}

// Test layoutBriefs
console.log('\n--- layoutBriefs tests ---')
const xkbOutput = `
- layout: 'us'
  variant: ''
  brief: 'en'
  description: English (US)
- layout: 'es'
  variant: ''
  brief: 'es'
  description: Spanish (ES)
- layout: 'fr'
  variant: ''
  brief: 'fr'
  description: French (FR)
- layout: 'de'
  variant: ''
  brief: 'de'
  description: German (DE)
`
const briefs = layoutBriefs(xkbOutput)
assertEqual(briefs['English (US)'], 'en', 'English (US) -> en')
assertEqual(briefs['Spanish (ES)'], 'es', 'Spanish (ES) -> es')
assertEqual(briefs['French (FR)'], 'fr', 'French (FR) -> fr')
assertEqual(briefs['German (DE)'], 'de', 'German (DE) -> de')
assertEqual(briefs['Non-existent'], undefined, 'Non-existent returns undefined')

// Test shortLabel
console.log('\n--- shortLabel tests ---')
assertEqual(shortLabel('English (US)', briefs), 'EN', 'English (US) -> EN')
assertEqual(shortLabel('Spanish (ES)', briefs), 'ES', 'Spanish (ES) -> ES')
assertEqual(shortLabel('French (FR)', briefs), 'FR', 'French (FR) -> FR')
assertEqual(shortLabel('German (DE)', briefs), 'DE', 'German (DE) -> DE')
assertEqual(shortLabel('Unknown Layout', briefs), 'UNK', 'Unknown falls back to first word')
assertEqual(shortLabel('', briefs), '', 'Empty string returns empty')
assertEqual(shortLabel(null, briefs), '', 'Null returns empty')

// Test eventKeyboardName
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

// Test isTypedKeyboard
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

// Test selectKeyboard
console.log('\n--- selectKeyboard tests ---')
const keyboards = [
  { name: 'keyboard1', active_layout_index: 0, layout: 'English (US),Spanish (ES)' },
  { name: 'keyboard2', active_layout_index: 1, layout: 'English (US),Spanish (ES)' },
  { name: 'keyboard3', active_layout_index: 0, layout: 'English (US)' }
]

const selectedByName = selectKeyboard(keyboards, 'keyboard2')
assertEqual(selectedByName.name, 'keyboard2', 'Selects keyboard by event name')

const selectedByIndex = selectKeyboard(keyboards, 'keyboard3')
// keyboard3 has index 0, same as keyboard1, so reduce returns first (keyboard3)
assertEqual(selectedByIndex.name, 'keyboard3', 'Selects first when tie on furthest advanced')

const emptySelection = selectKeyboard([], 'keyboard1')
assertEqual(emptySelection, undefined, 'Returns undefined for empty array')

// Test isEnEsLayout
console.log('\n--- isEnEsLayout tests ---')
assert(isEnEsLayout('English (US)'), 'English (US) is EN/ES')
assert(isEnEsLayout('English (UK)'), 'English (UK) is EN/ES')
assert(isEnEsLayout('Spanish (ES)'), 'Spanish (ES) is EN/ES')
assert(isEnEsLayout('Spanish (MX)'), 'Spanish (MX) is EN/ES')
assert(isEnEsLayout('Español (ES)'), 'Español (ES) is EN/ES')
assert(!isEnEsLayout('French (FR)'), 'French is not EN/ES')
assert(!isEnEsLayout('German (DE)'), 'German is not EN/ES')
assert(!isEnEsLayout(''), 'Empty is not EN/ES')
assert(!isEnEsLayout(null), 'Null is not EN/ES')

// Test getOtherEnEsLayout
console.log('\n--- getOtherEnEsLayout tests ---')
const kbWithBoth = { layout: 'English (US),Spanish (ES)', name: 'kb1' }
assertEqual(getOtherEnEsLayout(kbWithBoth, 'English (US)'), 'Spanish (ES)', 'Gets Spanish when current is English')
assertEqual(getOtherEnEsLayout(kbWithBoth, 'Spanish (ES)'), 'English (US)', 'Gets English when current is Spanish')

const kbOnlyEnglish = { layout: 'English (US)', name: 'kb2' }
assertEqual(getOtherEnEsLayout(kbOnlyEnglish, 'English (US)'), null, 'Returns null when only one layout')

const kbNoLayout = { name: 'kb3' }
assertEqual(getOtherEnEsLayout(kbNoLayout, 'English (US)'), null, 'Returns null when no layout property')

// Test getLayoutIndex
console.log('\n--- getLayoutIndex tests ---')
assertEqual(getLayoutIndex(kbWithBoth, 'English (US)'), 0, 'English (US) at index 0')
assertEqual(getLayoutIndex(kbWithBoth, 'Spanish (ES)'), 1, 'Spanish (ES) at index 1')
assertEqual(getLayoutIndex(kbWithBoth, 'French (FR)'), -1, 'Non-existent returns -1')
assertEqual(getLayoutIndex(kbOnlyEnglish, 'English (US)'), 0, 'Single layout at index 0')
assertEqual(getLayoutIndex(kbNoLayout, 'English (US)'), -1, 'No layout returns -1')

// Summary
console.log('\n=== SUMMARY ===')
console.log('Passed:', passed)
console.log('Failed:', failed)
console.log('Total:', passed + failed)

if (failed > 0) {
  process.exit(1)
}