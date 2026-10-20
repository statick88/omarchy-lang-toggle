import QtQuick
import Quickshell
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

  property string layoutFull: ""
  property string keyboardName: ""
  property string typedKeyboardName: ""
  property int keyboardCount: 0
  property bool keyboardUnresolved: false
  property bool multipleLayouts: true
  property var layoutBriefs: ({})
  readonly property string layoutLabel: LangToggleModel.shortLabel(layoutFull, layoutBriefs)
  property bool refreshPending: false
  property bool fnPressed: false

  function refresh() {
    if (queryProc.running) {
      refreshPending = true
      return
    }
    refreshPending = false
    queryProc.running = true
  }

  function typedKeyboards(keyboards) {
    return keyboards.filter(k => LangToggleModel.isTypedKeyboard(k.name))
  }

  function selectKeyboard(typed) {
    return LangToggleModel.selectKeyboard(typed, root.typedKeyboardName)
  }

  function cycleLayout() {
    if (!root.keyboardName || !root.bar) return
    root.bar.run("hyprctl switchxkblayout " + Util.shellQuote(root.keyboardName) + " next")
    refreshTimer.restart()
  }

  // Toggle specifically between EN and ES layouts
  function toggleEnEs() {
    if (!root.keyboardName || !root.bar) return
    var keyboard = selectKeyboard(root.typedKeyboards(JSON.parse(queryProc.lastOutput || "{}").keyboards || []))
    if (!keyboard) return

    var otherLayout = LangToggleModel.getOtherEnEsLayout(keyboard, root.layoutFull)
    if (!otherLayout) return

    var targetIndex = LangToggleModel.getLayoutIndex(keyboard, otherLayout)
    if (targetIndex >= 0) {
      root.bar.run("hyprctl switchxkblayout " + Util.shellQuote(root.keyboardName) + " " + targetIndex)
      refreshTimer.restart()
    }
  }

  Component.onCompleted: {
    briefsProc.running = true
    refresh()
  }

  Connections {
    target: Hyprland
    function onRawEvent(event) {
      if (!event || !event.name) return
      var name = String(event.name)
      if (name === "activelayout") {
        const named = LangToggleModel.eventKeyboardName(event)
        if (named) root.typedKeyboardName = named
      }
      if (name.indexOf("activelayout") !== -1 || name === "configreloaded") root.refresh()
    }
  }

  // Global key press handler for Fn key toggle
  Connections {
    target: Hyprland
    function onRawEvent(event) {
      if (!event || !event.name) return
      var name = String(event.name)
      // Handle key press events - this is a simplified approach
      // In practice, you'd use a more specific key binding
      if (name === "keyboard_key" || name === "keyboard_key_released") {
        // The actual key handling would be done via Hyprland keybindings
        // This widget provides the toggleEnEs() function that can be called
      }
    }
  }

  Process {
    id: queryProc
    property string lastOutput: ""
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
        lastOutput = text || ""
        let listed
        try {
          listed = JSON.parse(text || "{}").keyboards
        } catch (e) {
          return
        }
        if (!Array.isArray(listed)) return

        const typed = root.typedKeyboards(listed)
        const kb = root.selectKeyboard(typed)
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

  Process {
    id: briefsProc
    command: ["xkbcli", "list", "--load-exotic"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.layoutBriefs = LangToggleModel.layoutBriefs(text)
    }
  }

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

  // Expose toggleEnEs for external key binding
  IpcHandler {
    target: "io.github.statick.lang-toggle"
    function toggleEnEs(): void { root.toggleEnEs() }
    function refresh(): void { root.refresh() }
    function cycleLayout(): void { root.cycleLayout() }
  }

  visible: layoutLabel !== "" && multipleLayouts
  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: setting("showFullName", false) ? root.layoutFull : root.layoutLabel
    fontSize: Style.font.caption
    horizontalMargin: 6
    tooltipText: root.layoutFull
    onPressed: function(b) {
      if (b === Qt.RightButton) root.cycleLayout()
      else root.toggleEnEs()
    }
  }
}