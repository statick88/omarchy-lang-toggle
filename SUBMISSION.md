### Repository URL

https://github.com/statick88/omarchy-lang-toggle

### Category

Widgets

### Tags

bar, quickshell, hyprland

### Suggest a missing tag

_No response_

### Maintainer notes

Plugin provides EN/ES keyboard layout toggle in the Omarchy bar. Click to toggle between English and Spanish layouts, or bind a key (XF86Fn works for Fn) to the `toggleEnEs` IPC method.

Verification performed against the live system: 86 unit tests, 37 integration checks (including both official validations, `omarchy plugin validate` and `qmllint` against the installed shell), and a full lifecycle run on the real compositor — install, enable, shell restart, disable, re-enable and removal. The EN/ES toggle was driven through the live shell and confirmed bidirectional and repeatable.

External dependencies are limited to `hyprctl` (Hyprland) and `xkbcli` (Arch `xkbcli` package); the plugin installs nothing, runs no service, and never elevates privileges.
### Submission checklist

- [x] The repository is public and contains installation and removal instructions.
- [x] I have documented the plugin license and any external dependencies.
- [x] I confirm that I own or have permission to submit this plugin and its preview assets.
- [x] The plugin does not overwrite user configuration without explicit consent.
- [x] I understand that approval is for listing and is not a security review.
<!-- validation-refresh -->

<!-- validation-refresh-2 -->
