#!/bin/bash
# Reinstall MCP ACS Testing Manager extension script

set -e  # Exit on error

echo "🗑️  Uninstalling current extension..."
code --uninstall-extension DigitalDefiance.mcp-acs-testing || echo "Extension not installed or already uninstalled"

echo "🔨 Compiling extension..."
yarn compile

echo "📦 Packaging extension..."
VSIX_FILE="mcp-acs-testing-reinstall-$(date +%Y%m%d-%H%M%S).vsix"
# Use vsce with --no-yarn and --no-dependencies to avoid npm checking issues
yarn vsce package --no-yarn --no-dependencies --out "$VSIX_FILE"

echo "📥 Installing extension..."
code --install-extension "$VSIX_FILE"

echo "✅ Done! Extension installed: $VSIX_FILE"
echo "⚠️  Please manually reload VS Code window:"
echo "   - Press Ctrl+R (or Cmd+R on Mac)"
echo "   - Or: Press F1 → Type 'Developer: Reload Window' → Press Enter"
echo ""
echo "After reloading, check the Output panel (View → Output → 'MCP ACS Testing Manager')"
echo "You should see: '✓ Successfully registered with shared ACS status bar'"

