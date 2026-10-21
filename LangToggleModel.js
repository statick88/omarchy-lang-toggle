// Label and layout-slot math for the language toggle widget, kept Qt-free so it
// can be unit tested under node (test/unit/lang-toggle-model-test.js).
//
// hyprctl speaks two dialects about the same keyboard, and confusing them is
// the bug this file exists to prevent:
//
//   kb.layout       -> "latam,us"          xkb layout CODES, in slot order
//   kb.active_keymap -> "English (US)"      the DESCRIPTION of the active slot
//
// The slot list is what switchxkblayout indexes, and the description is what
// the bar label shows, so the two have to be translated into each other
// through xkb's own table before anything can be reasoned about.

// xkbcli list prints YAML, and every layout and variant block pairs a brief with
// the description hyprctl reports as the active keymap:
//
//   - layout: 'us'
//     variant: ''
//     brief: 'en'
//     description: English (US)
//
// The models and option groups it also prints carry no brief of their own, and
// a brief never carries past the block it was printed in, so neither reaches
// the table.
//
// Two tables come out of that. The description table answers "what is active",
// and the code table answers "which slot in the list is Spanish" — a code
// never spells its language, so "latam" has to be looked up to find it is.
function layoutTable(text) {
  var briefs = {}
  var codes = {}
  var block = { layout: "", variant: "", brief: "", description: "" }

  function flush() {
    if (!block.brief || !block.description) return
    briefs[block.description] = block.brief
    // Only the default variant claims the code itself; the variants share it,
    // and the first one printed is the default.
    if (!block.variant && !codes[block.layout]) codes[block.layout] = block.brief
  }

  String(text || "").split("\n").forEach(function (line) {
    if (/^\s*- /.test(line)) {
      flush()
      block = { layout: "", variant: "", brief: "", description: "" }
    }

    // The layout code sits on the "- " line, the rest are indented under it.
    var layoutField = line.match(/^- layout: (.*)$/)
    if (layoutField) {
      block.layout = layoutField[1].replace(/^'|'$/g, "")
      return
    }

    var field = line.match(/^  (variant|brief|description): (.*)$/)
    if (!field) return
    block[field[1]] = field[2].replace(/^'|'$/g, "")
  })

  // The last block never sees the "- " that would have closed it.
  flush()

  return { briefs: briefs, codes: codes }
}

// The brief for a description, used for the label and to know which of EN/ES
// is the one that is active.
function layoutBriefs(text) {
  return layoutTable(text).briefs
}

// The brief for an xkb layout code ("us" -> "en", "latam" -> "es").
function codeBrief(codes, code) {
  var brief = (codes || {})[String(code || "").trim()]
  return typeof brief === "string" ? brief : ""
}

// The xkb codes of a keyboard's layout list, in the order hyprctl reports them.
// That order is the index space of switchxkblayout.
function layoutCodes(layoutList) {
  return String(layoutList || "")
    .split(",")
    .map(function (code) { return code.trim() })
    .filter(function (code) { return code !== "" })
}

// The index of the other EN/ES layout in a keyboard's layout list.
//
// The codes are translated into briefs first, because the active layout is
// named by its brief and the slots are named by codes: "latam" is the Spanish
// slot even though it never spells "spanish", and "us" is the English one.
//
// Returns -1 when the other layout is not on the seat, which leaves the widget
// inert instead of switching to something the user did not ask for.
function otherEnEsIndex(layoutList, codes, currentBrief) {
  var list = layoutCodes(layoutList)
  var current = String(currentBrief || "").toLowerCase()

  for (var i = 0; i < list.length; i++) {
    var brief = codeBrief(codes, list[i]).toLowerCase()
    if (!brief || brief === current) continue
    if (brief === "en" || brief === "es") return i
  }

  return -1
}

// The slot the toggle switches to: the other of the two EN/ES layouts.
//
// Where the keyboard stands comes from hyprctl twice over — as the description
// of the active layout and as its index in the layout list — and the index is
// the one to believe. The description only names a language when xkb's table
// answered for it, so a table that did not answer, or a description the table
// does not carry, left the comparison with nothing to compare: the toggle
// resolved to the slot the keyboard was already on, which switches nothing and
// reads as a dead key.
//
// The brief stays as the fallback for a Hyprland that reports no index at all.
function toggleTargetIndex(layoutList, codes, currentIndex, currentBrief) {
  var list = layoutCodes(layoutList)
  var enEs = []

  for (var i = 0; i < list.length; i++) {
    var brief = codeBrief(codes, list[i]).toLowerCase()
    if (brief === "en" || brief === "es") enEs.push({ index: i, brief: brief })
  }

  // One of the two on the seat is not a toggle.
  if (enEs.length < 2) return -1

  var index = currentIndex === undefined || currentIndex === null || currentIndex === ""
    ? -1
    : Number(currentIndex)

  if (index >= 0 && index < list.length) {
    // Standing on one of the two: the other one is the target.
    for (var j = 0; j < enEs.length; j++) {
      if (enEs[j].index === index) {
        for (var k = 0; k < enEs.length; k++) {
          if (enEs[k].index !== index) return enEs[k].index
        }
      }
    }

    // Standing on neither: English leads, the one the badge is named after.
    for (var m = 0; m < enEs.length; m++) {
      if (enEs[m].brief === "en") return enEs[m].index
    }
    return enEs[0].index
  }

  return otherEnEsIndex(layoutList, codes, currentBrief)
}

// The brief of a layout, with the description's own language as the fallback.
//
// The brief is a short language code rather than a country one, which keeps the
// label sensible for the layouts named after a language: Esperanto reads EO and
// Arabic reads AR. It is the same code GNOME shows in its own indicator.
//
// A description names its language outright when it is an English or a Spanish
// layout, so those two can be recognised without xkb's table: a table that did
// not answer, or one that does not carry the description, still leaves the two
// layouts this widget toggles between readable as EN and ES.
//
// Layouts missing from the table fall back to the first word of the description,
// which reads as ENG/POR but at least says something.
function briefFor(description, briefs) {
  // A description like "constructor" reaches an inherited member rather than a
  // brief, so take the lookup only when it hands back the string it promises.
  var brief = (briefs || {})[description]
  if (typeof brief === "string" && brief) return brief

  var desc = String(description || "").toLowerCase()
  if (desc.indexOf("english") === 0) return "en"
  if (desc.indexOf("spanish") === 0) return "es"

  return ""
}

// The label the bar shows: the brief, capped at the three characters the
// fallback gets. The widget sits between fixed neighbours on the bar and has
// no room to grow.
//
// Nearly every brief is a bare two-letter code, but a few tack a script onto it
// (Burmese (Zawgyi) is my-zwg) and the custom layout's is a word, so drop the
// script.
function shortLabel(description, briefs) {
  if (!description) return ""

  var brief = briefFor(description, briefs)
  var label = brief ? brief.split("-")[0] : String(description).split(/\s+/)[0]
  return label.substring(0, 3).toUpperCase()
}

// Hyprland's activelayout event pairs the keyboard that switched with the layout
// it moved to. Quickshell cuts the event into that many fields, so a description
// carrying a comma of its own stays in one piece; a binding old enough to hand
// back only the raw string gets split by hand. The virtual keyboard fcitx5 binds
// to inject announces switches too, and names a keyboard nobody types on.
function eventKeyboardName(event) {
  var parts

  try {
    if (event && event.parse) parts = event.parse(2)
  } catch (error) {
  }

  if (!parts) parts = String(event && event.data ? event.data : "").split(",")

  var name = String(parts[0] || "")
  return name.indexOf("hl-virtual-keyboard") === 0 ? "" : name
}

// Hyprland reports more than keyboards as keyboards. fcitx5 binds a virtual one
// to inject through, which keeps the us layout the input method gave it, and the
// ACPI power button, lid switch and sleep key each arrive carrying the seat's
// layout list without anyone ever typing on them. Both answer to switchxkblayout
// and both can hold the main flag, so a widget that reads or switches whatever
// the seat hands it ends up describing a button. Leave them out and what remains
// is keyboards, which is what the rest of this file can then assume.
//
// Missing a name here costs the accuracy the seat had before, never a keyboard:
// anything unrecognised stays in the list.
var UNTYPED_KEYBOARDS = /^(hl-virtual-keyboard|power-button|sleep-button|lid-switch|video-bus|intel-hid-events|thinkpad-extra-buttons)/

function isTypedKeyboard(name) {
  return !UNTYPED_KEYBOARDS.test(String(name || ""))
}

// Every keyboard on the seat carries the same layout list unless one was given
// its own, but only the one being typed on advances through it. So the
// furthest-advanced is the one worth reading, and a switch names the keyboard it
// moved, which settles a seat holding two real keyboards outright.
//
// The name is taken whenever a keyboard still answers to it, wherever that
// keyboard sits in the list. Comparing positions instead would read the wrong
// keyboard the moment one wrapped from the last layout back to the first, which
// is the ordinary way round a pair of them. Applying a layout to the whole seat
// names a keyboard too, but leaves every one of them on the same layout, so the
// label reads the same whichever of them the name settles on.
function selectKeyboard(typed, namedByEvent) {
  var keyboards = typed || []

  return keyboards.find(function (keyboard) {
    return keyboard.name === namedByEvent
  }) || keyboards.reduce(function (furthest, keyboard) {
    return layoutIndex(keyboard) > layoutIndex(furthest) ? keyboard : furthest
  }, keyboards[0])
}

function layoutIndex(keyboard) {
  return (keyboard && keyboard.active_layout_index) || 0
}

// Whether a layout is one of the two this widget toggles between.
function isEnEsLayout(description) {
  if (!description) return false
  var desc = String(description).toLowerCase()
  return desc.indexOf("english") === 0 || desc.indexOf("spanish") === 0
}

if (typeof module !== "undefined") {
  module.exports = {
    eventKeyboardName: eventKeyboardName,
    isTypedKeyboard: isTypedKeyboard,
    isEnEsLayout: isEnEsLayout,
    layoutBriefs: layoutBriefs,
    layoutCodes: layoutCodes,
    layoutTable: layoutTable,
    codeBrief: codeBrief,
    otherEnEsIndex: otherEnEsIndex,
    toggleTargetIndex: toggleTargetIndex,
    briefFor: briefFor,
    selectKeyboard: selectKeyboard,
    shortLabel: shortLabel
  }
}
