#!/bin/bash
# Integration tests for lang-toggle plugin
# Covers the two official marketplace validations:
#   1. omarchy plugin validate  (manifest + repository layout)
#   2. qmllint                  (QML static analysis against the shell)
# plus structural assertions on the manifest.

set -uo pipefail

PLUGIN_DIR="${PLUGIN_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PLUGIN_ID="io.github.statick.lang-toggle"
USER_PLUGINS_DIR="$HOME/.config/omarchy/plugins"
OMARCHY_PATH="${OMARCHY_PATH:-/usr/share/omarchy}"

passed=0
failed=0

check() {
  local condition="$1"
  local message="$2"
  if eval "$condition"; then
    echo "✅ PASS: $message"
    passed=$((passed + 1))
  else
    echo "❌ FAIL: $message"
    failed=$((failed + 1))
  fi
}

# qmllint ships in qt6-tools; on Arch it is not always on PATH.
QMLLINT_BIN=""
for candidate in qmllint /usr/lib/qt6/bin/qmllint /usr/lib/qt5/bin/qmllint; do
  if command -v "$candidate" >/dev/null 2>&1; then
    QMLLINT_BIN="$candidate"
    break
  fi
done

# The shell's QML modules are imported as `qs.Commons` / `qs.Ui`, so qmllint
# needs an import path that exposes the shell tree under a `qs` directory.
QMLLINT_SCRATCH=""
setup_qmllint_env() {
  QMLLINT_SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/omarchy-lang-toggle-qmllint-XXXXXX")"
  ln -s "$OMARCHY_PATH/shell" "$QMLLINT_SCRATCH/qs"
}

cleanup_qmllint_env() {
  [[ -n $QMLLINT_SCRATCH && -d $QMLLINT_SCRATCH ]] && rm -rf "$QMLLINT_SCRATCH"
}

echo "=== Integration Tests for $PLUGIN_ID ==="
echo "Plugin dir: $PLUGIN_DIR"
echo

MANIFEST="$PLUGIN_DIR/manifest.json"

# --- Repository layout ---------------------------------------------------

echo "--- Repository layout ---"
check '[ -d "$PLUGIN_DIR" ]' "Plugin directory exists"
check '[ -f "$PLUGIN_DIR/manifest.json" ]' "manifest.json exists at repository root"
check '[ -f "$PLUGIN_DIR/README.md" ]' "README.md exists at repository root"
check '[ -f "$PLUGIN_DIR/LICENSE" ]' "LICENSE exists at repository root"
check 'jq -e . "$MANIFEST" >/dev/null 2>&1' "manifest.json is valid JSON"

MANIFEST_COUNT=$(find "$PLUGIN_DIR" -name manifest.json -not -path "*/.git/*" | wc -l)
check '[ "$MANIFEST_COUNT" -eq 1 ]' "Repository contains exactly one plugin manifest"

# README must document installation and removal.
check 'grep -q "omarchy plugin add" "$PLUGIN_DIR/README.md"' "README documents installation command"
check 'grep -q "omarchy plugin remove" "$PLUGIN_DIR/README.md"' "README documents removal command"
check 'grep -qi "external dependencies" "$PLUGIN_DIR/README.md"' "README documents external dependencies"

# --- Manifest contract ----------------------------------------------------

echo
echo "--- Manifest contract ---"
check 'jq -e ".schemaVersion == 1" "$MANIFEST" >/dev/null 2>&1' "schemaVersion is 1"
check 'jq -e ".id == \"$PLUGIN_ID\"" "$MANIFEST" >/dev/null 2>&1' "Plugin ID matches"
check 'jq -e ".id | test(\"^[a-z0-9][a-z0-9._-]*$\")" "$MANIFEST" >/dev/null 2>&1' "Plugin ID is lowercase and namespaced"
check 'jq -e ".name" "$MANIFEST" >/dev/null 2>&1' "Has name field"
check 'jq -e ".version" "$MANIFEST" >/dev/null 2>&1' "Has version field"
check 'jq -e ".description" "$MANIFEST" >/dev/null 2>&1' "Has description field"
check 'jq -e ".license" "$MANIFEST" >/dev/null 2>&1' "Has license field"
check 'jq -e ".kinds | index(\"bar-widget\") != null" "$MANIFEST" >/dev/null 2>&1' "Has bar-widget kind"
check 'jq -e ".entryPoints.barWidget" "$MANIFEST" >/dev/null 2>&1' "Has barWidget entry point"
check 'jq -e ".entryPoints.barWidget == \"BarWidget.qml\"" "$MANIFEST" >/dev/null 2>&1' "Entry point follows the bar-widget convention"
check '[ -f "$PLUGIN_DIR/BarWidget.qml" ]' "BarWidget.qml entry point exists"
check '[ -f "$PLUGIN_DIR/LangToggleModel.js" ]' "LangToggleModel.js exists"
check '! [[ "$PLUGIN_ID" == omarchy.* ]]' "Plugin ID is outside the reserved omarchy.* namespace"

echo
echo "--- barWidget metadata ---"
check 'jq -e ".barWidget.displayName" "$MANIFEST" >/dev/null 2>&1' "barWidget has displayName"
check 'jq -e ".barWidget.category" "$MANIFEST" >/dev/null 2>&1' "barWidget has category"
check 'jq -e ".barWidget.allowMultiple == false" "$MANIFEST" >/dev/null 2>&1' "barWidget allowMultiple is false"
check 'jq -e ".barWidget.defaultSection" "$MANIFEST" >/dev/null 2>&1' "barWidget has defaultSection"
check 'jq -e ".barWidget.defaultSection | IN(\"left\",\"center\",\"right\")" "$MANIFEST" >/dev/null 2>&1' "defaultSection is a valid section"
check 'jq -e ".barWidget.schema" "$MANIFEST" >/dev/null 2>&1' "barWidget has schema"
check 'jq -e ".barWidget.schema | length >= 1" "$MANIFEST" >/dev/null 2>&1' "schema has at least one setting"
check 'jq -e ".barWidget.defaults | has(\"toggleKey\")" "$MANIFEST" >/dev/null 2>&1' "Has toggleKey default"
check 'jq -e ".barWidget.defaults | has(\"showFullName\")" "$MANIFEST" >/dev/null 2>&1' "Has showFullName default"

# --- Official validation #1: manifest + layout ----------------------------

echo
echo "--- Official validation 1/2: omarchy plugin validate ---"
if omarchy plugin validate "$PLUGIN_DIR" 2>/dev/null; then
  echo "✅ PASS: omarchy plugin validate passes"
  passed=$((passed + 1))
else
  echo "❌ FAIL: omarchy plugin validate fails"
  omarchy plugin validate "$PLUGIN_DIR" 2>&1 | head -20
  failed=$((failed + 1))
fi

# --- Official validation #2: qmllint --------------------------------------

echo
echo "--- Official validation 2/2: qmllint ---"
if [[ -z $QMLLINT_BIN ]]; then
  echo "⚠️  SKIP: qmllint not found (install qt6-tools)"
else
  setup_qmllint_env
  QMLLINT_OUT="$("$QMLLINT_BIN" -I "$QMLLINT_SCRATCH" -I /usr/lib/qt6/qml "$PLUGIN_DIR/BarWidget.qml" 2>&1)"
  QMLLINT_STATUS=$?
  cleanup_qmllint_env

  if [[ $QMLLINT_STATUS -eq 0 ]]; then
    echo "✅ PASS: qmllint reports no errors"
    passed=$((passed + 1))
  else
    echo "❌ FAIL: qmllint reported errors"
    echo "$QMLLINT_OUT" | head -30
    failed=$((failed + 1))
  fi

  # Warnings that mirror the official first-party plugins (unresolved dynamic
  # members on `bar`/`Style` singletons) are accepted; a missing module import
  # is not, because that means the QML would not load at runtime.
  if echo "$QMLLINT_OUT" | grep -q "Failed to import"; then
    echo "❌ FAIL: qmllint could not resolve a QML import"
    failed=$((failed + 1))
  else
    echo "✅ PASS: all QML imports resolve"
    passed=$((passed + 1))
  fi

  if echo "$QMLLINT_OUT" | grep -q "Unused import"; then
    echo "❌ FAIL: qmllint found an unused import"
    echo "$QMLLINT_OUT" | grep -A2 "Unused import"
    failed=$((failed + 1))
  else
    echo "✅ PASS: no unused imports"
    passed=$((passed + 1))
  fi
fi

# --- Installability -------------------------------------------------------

echo
echo "--- Installability ---"
LINKS=$(find "$PLUGIN_DIR" -name .git -prune -o -type l -print 2>/dev/null | head -1)
check '[ -z "$LINKS" ]' "No symlinks in plugin directory"

STAGE_DIR="$USER_PLUGINS_DIR/.test-add.$$"
rm -rf "$STAGE_DIR"
if git clone -- "$PLUGIN_DIR" "$STAGE_DIR" 2>/dev/null; then
  if omarchy plugin validate "$STAGE_DIR" 2>/dev/null; then
    echo "✅ PASS: Plugin clones and validates as an installed plugin"
    passed=$((passed + 1))
  else
    echo "❌ FAIL: Cloned plugin fails validation"
    failed=$((failed + 1))
  fi
  rm -rf "$STAGE_DIR"
else
  echo "❌ FAIL: Failed to clone plugin locally"
  failed=$((failed + 1))
fi

echo
echo "=== SUMMARY ==="
echo "Passed: $passed"
echo "Failed: $failed"
echo "Total: $((passed + failed))"

if [ $failed -gt 0 ]; then
  exit 1
fi
