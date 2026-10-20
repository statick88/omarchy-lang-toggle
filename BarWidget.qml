import QtQuick
import Quickshell.Hyprland
import Quickshell.Io
import qs.Ui
import qs.Commons
import "LangToggleModel.js" as LangToggleModel

// EN/ES Language Toggle widget for Omarchy bar
// Shows current layout (EN/ES), click or press configured toggle key to switch
BarWidget {
  id: root
  moduleName: "io.github.statick.lang-toggle"

  // State
  property string layoutFull: ""
  property string keyboardName: ""
  property string typedKeyboardName: ""
  property int keyboardCount: 0
  property bool keyboardUnresolved: false
  property bool multipleLayouts: true
  property var layoutBriefs: ({})
  property var layoutCodes: ({})
  property var currentTypedKeyboards: []

  // Computed
  readonly property string layoutLabel: LangToggleModel.shortLabel(layoutFull, layoutBriefs)
  readonly property string layoutBrief: String(layoutBriefs[layoutFull] || "")
  property bool refreshPending: false

  // --- Core Logic ---

  function refresh() {
    if (queryProc.running) {
      refreshPending = true
      return
    }
    refreshPending = false
    queryProc.running = true
  }

  function selectKeyboard() {
    return LangToggleModel.selectKeyboard(currentTypedKeyboards, root.typedKeyboardName)
  }

  function cycleLayout() {
    if (!root.keyboardName || !root.bar) return
    root.bar.run("hyprctl switchxkblayout " + Util.shellQuote(root.keyboardName) + " next")
    refreshTimer.restart()
  }

  // Toggle specifically between the EN and ES layouts.
  //
  // The keyboard's layout list is a list of xkb codes ("latam,us") and the
  // active one is named by its description ("English (US)"), so the slot of
  // the other language is found by translating the codes into briefs. The
  // result is the index switchxkblayout expects.
  function toggleEnEs() {
    if (!root.keyboardName || !root.bar) return
    const kb = root.selectKeyboard()
    if (!kb) return

    const targetIndex = LangToggleModel.otherEnEsIndex(kb.layout, root.layoutCodes, root.layoutBrief)
    if (targetIndex < 0) return

    root.bar.run("hyprctl switchxkblayout " + Util.shellQuote(root.keyboardName) + " " + targetIndex)
    refreshTimer.restart()
  }

  // --- Hyprland Event Handling ---

  Connections {
    target: Hyprland
    function onRawEvent(event) {
      if (!event || !event.name) return
      const name = String(event.name)
      if (name === "activelayout") {
        const named = LangToggleModel.eventKeyboardName(event)
        if (named) root.typedKeyboardName = named
      }
      if (name.indexOf("activelayout") !== -1 || name === "configreloaded") root.refresh()
    }
  }

  // --- Device Query ---

  Process {
    id: queryProc
    command: ["hyprctl", "-j", "devices"]
    onRunningChanged: {
      if (running) {
        stallTimer.restart()
        return
      }
      stallTimer.stop()
      if (root.refreshPending) root.refresh()
    }
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        let listed
        try {
          listed = JSON.parse(text || "{}").keyboards
        } catch (e) {
          return
        }
        if (!Array.isArray(listed)) return

        const typed = listed.filter(k => LangToggleModel.isTypedKeyboard(k.name))
        root.currentTypedKeyboards = typed

        const kb = root.selectKeyboard()
        if (!kb || !kb.active_keymap) {
          root.keyboardUnresolved = true
          if (typed.length === 0) {
            root.layoutFull = ""
            root.keyboardName = ""
          }
          return
        }
        root.keyboardUnresolved = false
        root.keyboardCount = typed.length
        root.keyboardName = String(kb.name || "")
        root.multipleLayouts = kb.layout === undefined || String(kb.layout).indexOf(",") !== -1
        root.layoutFull = kb.active_keymap
      }
    }
  }

  // --- Layout Briefs (xkbcli) ---

  Process {
    id: briefsProc
    command: ["xkbcli", "list", "--load-exotic"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        const table = LangToggleModel.layoutTable(text)
        root.layoutBriefs = table.briefs
        root.layoutCodes = table.codes
      }
    }
  }

  // --- Timers ---

  Timer {
    id: refreshTimer
    interval: 600
    onTriggered: root.refresh()
  }

  Timer {
    id: stallTimer
    interval: 5000
    onTriggered: {
      queryProc.running = false
      refreshTimer.restart()
    }
  }

  Timer {
    interval: 10000
    running: !root.keyboardName || root.keyboardUnresolved || root.keyboardCount > 1
    repeat: true
    onTriggered: root.refresh()
  }

  // --- IPC Interface ---

  IpcHandler {
    target: "io.github.statick.lang-toggle"
    function toggleEnEs(): void { root.toggleEnEs() }
    function refresh(): void { root.refresh() }
    function cycleLayout(): void { root.cycleLayout() }
  }

  // --- UI ---

  visible: layoutLabel !== "" && multipleLayouts
  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  Component.onCompleted: {
    briefsProc.running = true
    refresh()
  }

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: root.setting("showFullName", "Off") === "On" ? root.layoutFull : root.layoutLabel
    fontSize: Style.font.caption
    horizontalMargin: 6
    tooltipText: root.layoutFull
    onPressed: function(b) {
      if (b === Qt.RightButton) root.cycleLayout()
      else root.toggleEnEs()
    }
  }
}