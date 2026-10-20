#!/bin/bash
# Integration tests for lang-toggle plugin
# Tests plugin validation, installation, and basic functionality

set -euo pipefail

PLUGIN_DIR="/home/statick/Projects/omarchy-lang-toggle"
PLUGIN_ID="io.github.statick.lang-toggle"
USER_PLUGINS_DIR="$HOME/.config/omarchy/plugins"

passed=0
failed=0

check() {
  local condition="$1"
  local message="$2"
  if eval "$condition"; then
    echo "✅ PASS: $message"
    ((passed++))
  else
    echo "❌ FAIL: $message"
    ((failed++))
  fi
}

echo "=== Integration Tests for $PLUGIN_ID ==="
echo

# Test 1: Plugin directory exists
check '[ -d "$PLUGIN_DIR" ]' "Plugin directory exists"

# Test 2: manifest.json exists and is valid JSON
check '[ -f "$PLUGIN_DIR/manifest.json" ]' "manifest.json exists"
check 'jq -e . "$PLUGIN_DIR/manifest.json" >/dev/null 2>&1' "manifest.json is valid JSON"

# Test 3: Required manifest fields
MANIFEST="$PLUGIN_DIR/manifest.json"
check 'jq -e ".schemaVersion == 1" "$MANIFEST" >/dev/null 2>&1' "schemaVersion is 1"
check 'jq -e ".id == \"$PLUGIN_ID\"" "$MANIFEST" >/dev/null 2>&1' "Plugin ID matches"
check 'jq -e ".name" "$MANIFEST" >/dev/null 2>&1' "Has name field"
check 'jq -e ".version" "$MANIFEST" >/dev/null 2>&1' "Has version field"
check 'jq -e ".kinds | index(\"bar-widget\") != null" "$MANIFEST" >/dev/null 2>&1' "Has bar-widget kind"
check 'jq -e ".entryPoints.barWidget" "$MANIFEST" >/dev/null 2>&1' "Has barWidget entry point"

# Test 4: Entry point file exists
check '[ -f "$PLUGIN_DIR/Widget.qml" ]' "Widget.qml entry point exists"
check '[ -f "$PLUGIN_DIR/LangToggleModel.js" ]' "LangToggleModel.js exists"

# Test 5: Validate with omarchy-plugin-validate
echo "Running omarchy-plugin-validate..."
if omarchy-plugin-validate "$PLUGIN_DIR" 2>/dev/null; then
  echo "✅ PASS: omarchy-plugin-validate passes"
  ((passed++))
else
  echo "❌ FAIL: omarchy-plugin-validate fails"
  omarchy-plugin-validate "$PLUGIN_DIR" 2>&1 | head -20
  ((failed++))
fi

# Test 6: Plugin ID not in reserved namespace
check '! [[ "$PLUGIN_ID" == omarchy.* ]]' "Plugin ID not in reserved omarchy.* namespace"

# Test 7: No symlinks in plugin directory
LINKS=$(find "$PLUGIN_DIR" -name .git -prune -o -type l -print 2>/dev/null | head -1)
check '[ -z "$LINKS" ]' "No symlinks in plugin directory"

# Test 8: Plugin can be added (dry run - check if validation would pass)
echo "Testing plugin add validation..."
STAGE_DIR="$USER_PLUGINS_DIR/.test-add.$$"
rm -rf "$STAGE_DIR"
if git clone -- "$PLUGIN_DIR" "$STAGE_DIR" 2>/dev/null; then
  if omarchy-plugin-validate "$STAGE_DIR" 2>/dev/null; then
    echo "✅ PASS: Plugin can be cloned and validated"
    ((passed++))
  else
    echo "❌ FAIL: Cloned plugin fails validation"
    ((failed++))
  fi
  rm -rf "$STAGE_DIR"
else
  echo "❌ FAIL: Failed to clone plugin locally"
  ((failed++))
fi

# Test 9: Check manifest schema compliance
check 'jq -e "(.kinds | type) == \"array\" and (.kinds | length) > 0" "$MANIFEST" >/dev/null 2>&1' "kinds is non-empty array"
check 'jq -e "(.entryPoints | type) == \"object\"" "$MANIFEST" >/dev/null 2>&1' "entryPoints is object"

# Test 10: barWidget configuration
check 'jq -e ".barWidget.displayName" "$MANIFEST" >/dev/null 2>&1' "barWidget has displayName"
check 'jq -e ".barWidget.category" "$MANIFEST" >/dev/null 2>&1' "barWidget has category"
check 'jq -e ".barWidget.allowMultiple == false" "$MANIFEST" >/dev/null 2>&1' "barWidget allowMultiple is false"
check 'jq -e ".barWidget.defaultSection" "$MANIFEST" >/dev/null 2>&1' "barWidget has defaultSection"
check 'jq -e ".barWidget.defaultSection | IN(\"left\",\"center\",\"right\")" "$MANIFEST" >/dev/null 2>&1' "defaultSection is valid"

# Test 11: Settings schema
check 'jq -e ".barWidget.schema" "$MANIFEST" >/dev/null 2>&1' "barWidget has schema"
check 'jq -e ".barWidget.schema | length >= 1" "$MANIFEST" >/dev/null 2>&1' "schema has at least one setting"

# Test 12: Default values present
check 'jq -e ".barWidget.defaults.toggleKey" "$MANIFEST" >/dev/null 2>&1' "Has toggleKey default"
check 'jq -e ".barWidget.defaults.showFullName" "$MANIFEST" >/dev/null 2>&1' "Has showFullName default"

echo
echo "=== SUMMARY ==="
echo "Passed: $passed"
echo "Failed: $failed"
echo "Total: $((passed + failed))"

if [ $failed -gt 0 ]; then
  exit 1
fi