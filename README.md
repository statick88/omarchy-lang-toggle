# Language Toggle — EN/ES Keyboard Layout Widget for Omarchy

A simple, useful Omarchy bar widget that shows your current keyboard layout (EN/ES) and lets you toggle between them with a click or the Fn key.

## Preview

![Language Toggle Preview](preview.png)

*The widget shows "EN" or "ES" in the bar. Click to toggle, or press Fn (when configured).*

## Features

- **Clean display**: Shows "EN" or "ES" in the bar (configurable to show full names)
- **Click to toggle**: Left-click the widget to switch between English and Spanish layouts
- **Fn key support**: Configure a Hyprland keybinding to toggle with Fn key
- **Smart keyboard detection**: Automatically identifies the keyboard you're typing on, ignoring virtual keyboards and system buttons
- **Layout briefs**: Uses xkb's own language codes (en/es) for accurate short labels
- **Only shows when needed**: Widget hides automatically when only one layout is configured

## Installation

### Via Omarchy Plugin Manager (Recommended)

```bash
omarchy plugin add https://github.com/statick/omarchy-lang-toggle.git --enable
```

This will:
1. Clone the plugin to `~/.config/omarchy/plugins/io.github.statick.lang-toggle/`
2. Validate the plugin manifest
3. Prompt you to place it in a bar section (default: right)
4. Enable it immediately

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/statick/omarchy-lang-toggle.git \
  ~/.config/omarchy/plugins/io.github.statick.lang-toggle

# Validate the plugin
omarchy-plugin-validate ~/.config/omarchy/plugins/io.github.statick.lang-toggle

# Rescan plugins to load it
omarchy-shell shell rescanPlugins

# Enable and place in bar (right section)
omarchy plugin enable io.github.statick.lang-toggle --section right
```

## Configuration

The widget can be configured via `~/.config/omarchy/shell.json` or the Omarchy settings UI:

```json
{
  "plugins": [
    {
      "id": "io.github.statick.lang-toggle",
      "toggleKey": "Fn",
      "showFullName": false
    }
  ]
}
```

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `toggleKey` | string | `"Fn"` | Key to press for toggling (informational, actual binding in Hyprland) |
| `showFullName` | boolean | `false` | Show "English (US)" instead of "EN" in the bar |

## Fn Key Binding Setup

To use the Fn key to toggle layouts, add this to your `~/.config/hypr/bindings.lua`:

```lua
-- Toggle EN/ES with Fn key (requires the widget to be loaded)
o.bind("FN", "Toggle EN/ES Layout", function()
  omarchy.ipc("io.github.statick.lang-toggle", "toggleEnEs")
end)
```

Or using the hyprctl command directly:

```lua
o.bind("FN", "Toggle EN/ES Layout", 
  "omarchy-shell shell ipc io.github.statick.lang-toggle toggleEnEs"
)
```

**Note**: The Fn key may be intercepted by your keyboard firmware. If it doesn't work, try `SUPER+SPACE` or another key combination:

```lua
o.bind("SUPER + SPACE", "Toggle EN/ES Layout", 
  "omarchy-shell shell ipc io.github.statick.lang-toggle toggleEnEs"
)
```

## How It Works

1. **Keyboard Detection**: Queries `hyprctl -j devices` to find all keyboards, filters out virtual keyboards (fcitx5), power buttons, lid switches, and other non-typing devices
2. **Active Keyboard**: Tracks `activelayout` events from Hyprland to know which keyboard you're currently typing on
3. **Layout Reading**: Reads the `active_keymap` from the active typing keyboard
4. **Language Codes**: Uses `xkbcli list --load-exotic` to map xkb descriptions to standard language codes (en/es/fr/de/etc.)
5. **Toggle Logic**: When toggling, finds the other EN/ES layout in the keyboard's layout list and switches to it directly by index

## Requirements

- Omarchy Quattro (with omarchy-shell)
- Hyprland (for `hyprctl` and `switchxkblayout`)
- `xkbcli` (for layout briefs - included in `xkbcli` package on Arch)

## Removal

```bash
# Via Omarchy Plugin Manager
omarchy plugin remove io.github.statick.lang-toggle

# Manual removal
rm -rf ~/.config/omarchy/plugins/io.github.statick.lang-toggle
omarchy-shell shell rescanPlugins
```

## Development

### Project Structure

```
omarchy-lang-toggle/
├── manifest.json          # Plugin manifest (schemaVersion 1)
├── Widget.qml             # Main bar widget (entry point)
├── LangToggleModel.js     # Shared logic (Qt-free, unit testable)
├── test/
│   ├── unit/
│   │   └── lang-toggle-model-test.js  # Unit tests for model logic
│   ├── integration/
│   │   └── plugin-integration-test.sh # Integration tests
│   └── e2e/
│       └── lang-toggle-e2e.test.js    # Playwright E2E tests
└── odd/
    └── tasks/
        └── lang-toggle.md  # ODD feature document
```

### Running Tests

```bash
# Unit tests (model logic)
node test/unit/lang-toggle-model-test.js

# Integration tests (plugin validation, structure)
bash test/integration/plugin-integration-test.sh

# E2E tests (requires running Omarchy shell with test page)
npx playwright test test/e2e/lang-toggle-e2e.test.js
```

### Validating the Plugin

```bash
omarchy-plugin-validate .
```

## License

MIT License — see [LICENSE](LICENSE) for details.

## Author

statick (@statick on GitHub)

## Related

- [Omarchy Plugin Marketplace](https://plugins.omarchy.org/)
- [Omarchy Shell Plugin Documentation](https://github.com/omacom/omarchy/blob/quattro/docs/omarchy-shell.md)
- [Original keyboard-layout widget](https://github.com/omacom/omarchy/tree/quattro/shell/plugins/panels/keyboard-layout)