# MCP ACS Testing Manager - Settings Documentation

## Overview

The MCP ACS Testing Manager extension provides comprehensive configuration options organized into 11 categories with 80+ individual settings.

## Settings Categories

### 1. Server Settings (`mcp-testing.server.*`)

- `serverPath`: Path to MCP testing server executable
- `autoStart`: Automatically start server on VS Code startup
- `timeout`: Server connection timeout (1000-300000 ms)
- `logLevel`: Logging level (debug, info, warn, error)
- `retryAttempts`: Number of connection retry attempts (0-10)
- `retryDelay`: Delay between retries (100-10000 ms)

### 2. Test Settings (`mcp-testing.test.*`)

- `defaultFramework`: Default test framework (jest, mocha, pytest, vitest, jasmine, ava, auto)
- `defaultTimeout`: Default test timeout (100-300000 ms)
- `maxParallelTests`: Maximum parallel test processes (1-32)
- `autoRun`: Automatically run tests on file changes
- `autoRunDelay`: Delay before auto-running tests (100-10000 ms)
- `watchMode`: Enable watch mode for continuous testing
- `runOnSave`: Run tests when test files are saved
- `clearConsoleOnRun`: Clear console before running tests
- `showInlineResults`: Show test results inline in editor
- `testPathPatterns`: Glob patterns for test file discovery
- `testPathIgnorePatterns`: Glob patterns to ignore during discovery

### 3. Coverage Settings (`mcp-testing.coverage.*`)

- `enabled`: Enable coverage analysis
- `showInEditor`: Show coverage decorations in editor
- `showGutterIcons`: Show coverage gutter icons
- `showLineHighlights`: Highlight covered/uncovered lines
- `heatMapMode`: Show coverage as heat map
- `thresholds`: Coverage thresholds (lines, branches, functions, statements)
- `reportFormats`: Coverage report formats (json, html, lcov, cobertura, text)
- `outputDirectory`: Directory for coverage reports
- `collectFrom`: Glob patterns for coverage collection
- `excludePatterns`: Patterns to exclude from coverage
- `trackTrends`: Track coverage trends over time
- `trendHistorySize`: Number of historical reports to keep (1-365)

### 4. Test Generation Settings (`mcp-testing.testGeneration.*`)

- `enabled`: Enable AI-powered test generation
- `autoSuggest`: Automatically suggest tests for uncovered code
- `includeEdgeCases`: Include edge cases in generated tests
- `includePropertyTests`: Include property-based tests
- `followProjectPatterns`: Follow existing project patterns
- `testFileLocation`: Where to place generated tests (adjacent, testDirectory, ask)
- `testDirectory`: Directory for generated tests

### 5. Debugging Settings (`mcp-testing.debugging.*`)

- `enabled`: Enable debugging integration
- `autoStartDebugger`: Automatically start debugger on test failure
- `breakOnFailure`: Break at failure point
- `showVariables`: Show variable values at failure
- `showCallStack`: Show call stack at failure
- `suggestRootCauses`: Suggest potential root causes

### 6. Flaky Test Settings (`mcp-testing.flaky.*`)

- `detectionEnabled`: Enable flaky test detection
- `detectionIterations`: Number of iterations for detection (2-100)
- `failureRateThreshold`: Failure rate threshold (0-1)
- `autoAnalyze`: Automatically analyze flaky test causes
- `suggestFixes`: Suggest fixes for flaky tests
- `trackHistory`: Track flaky test history

### 7. Mutation Testing Settings (`mcp-testing.mutation.*`)

- `enabled`: Enable mutation testing
- `mutationTypes`: Types of mutations to generate
- `scoreThreshold`: Minimum mutation score (0-100%)
- `timeout`: Timeout per mutation (1000-300000 ms)

### 8. Impact Analysis Settings (`mcp-testing.impact.*`)

- `enabled`: Enable test impact analysis
- `useGitDiff`: Use git diff for change detection
- `useCoverageData`: Use coverage data for impact analysis
- `useImportAnalysis`: Use import/dependency analysis
- `runAffectedOnly`: Run only affected tests by default

### 9. Performance Settings (`mcp-testing.performance.*`)

- `enabled`: Enable performance benchmarking
- `slowTestThreshold`: Threshold for slow tests (100-60000 ms)
- `trackTrends`: Track performance trends
- `detectRegressions`: Detect performance regressions
- `regressionThreshold`: Regression threshold multiplier (1.0-10.0)
- `suggestOptimizations`: Suggest optimization opportunities

### 10. Visual Regression Settings (`mcp-testing.visualRegression.*`)

- `enabled`: Enable visual regression testing
- `threshold`: Visual difference threshold (0-1)
- `baselineDirectory`: Directory for baseline screenshots
- `diffDirectory`: Directory for diff images
- `updateBaselines`: Automatically update baselines

### 11. Security Settings (`mcp-testing.security.*`)

- `enableAuditLog`: Enable audit logging
- `auditLogPath`: Path to audit log file
- `allowedFrameworks`: Allowed test frameworks (security allowlist)
- `maxCpuPercent`: Maximum CPU usage (10-100%)
- `maxMemoryMB`: Maximum memory usage (128-16384 MB)
- `blockShellCommands`: Block shell command execution

### 12. UI Settings (`mcp-testing.ui.*`)

- `showNotifications`: Show test result notifications
- `notificationLevel`: Notification level (all, failures, none)
- `autoRefreshInterval`: Auto-refresh interval (0-60000 ms)
- `showStatusBar`: Show test status in status bar
- `statusBarPosition`: Status bar position (left, right)
- `showCodeLens`: Show CodeLens above test functions
- `codeLensPosition`: CodeLens position (above, inline)
- `showDiagnostics`: Show diagnostics for test issues
- `diagnosticSeverity`: Severity levels for different issue types
- `treeViewGrouping`: Default tree view grouping (file, suite, tag, status)
- `treeViewSorting`: Default tree view sorting (name, duration, status, recent)
- `webviewTheme`: Webview panel theme (auto, light, dark)
- `showWelcomeMessage`: Show welcome message on first activation

### 13. Advanced Settings (`mcp-testing.advanced.*`)

- `cacheEnabled`: Enable caching for test discovery
- `cacheTTL`: Cache time-to-live (0-3600000 ms)
- `enableExperimentalFeatures`: Enable experimental features
- `telemetryEnabled`: Enable anonymous usage telemetry
- `debugMode`: Enable debug mode with verbose logging

## Settings Manager API

The `SettingsManager` class provides a type-safe API for accessing and managing settings:

```typescript
// Get singleton instance
const settingsManager = SettingsManager.getInstance(outputChannel);

// Get entire configuration
const config = settingsManager.getConfiguration();

// Get specific section
const serverConfig = settingsManager.get('server');

// Get nested value
const timeout = settingsManager.getValue('server', 'timeout');

// Update value
await settingsManager.updateValue('test', 'defaultTimeout', 10000);

// Validate configuration
const validation = settingsManager.validateConfiguration();
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}

// Listen for changes
settingsManager.onDidChangeConfiguration((config) => {
  console.log('Configuration changed:', config);
});
```

## Configuration Validation

The Settings Manager automatically validates all configuration values and provides detailed error messages for invalid settings:

- Server timeout must be between 1000-300000 ms
- Retry attempts must be between 0-10
- Test timeout must be between 100-300000 ms
- Max parallel tests must be between 1-32
- Coverage thresholds must be between 0-100%
- Flaky detection iterations must be between 2-100
- Failure rate threshold must be between 0-1
- Mutation score threshold must be between 0-100%
- Slow test threshold must be between 100-60000 ms
- Performance regression threshold must be between 1.0-10.0
- Visual regression threshold must be between 0-1
- Max CPU percent must be between 10-100%
- Max memory must be between 128-16384 MB

## Change Notifications

The Settings Manager automatically detects configuration changes and:

1. Reloads the configuration
2. Validates the new values
3. Emits change events to subscribers
4. Notifies users if changes require a server restart
5. Shows warnings for invalid configuration values

## Accessing Settings in VS Code

Users can access settings through:

1. **Command Palette**: `MCP Testing: Open Settings`
2. **Settings UI**: Search for "mcp-testing" in VS Code settings
3. **settings.json**: Add `mcp-testing.*` configuration keys

## Example Configuration

```json
{
  "mcp-testing.server.autoStart": true,
  "mcp-testing.server.timeout": 30000,
  "mcp-testing.test.defaultFramework": "jest",
  "mcp-testing.test.maxParallelTests": 4,
  "mcp-testing.coverage.enabled": true,
  "mcp-testing.coverage.thresholds": {
    "lines": 80,
    "branches": 75,
    "functions": 85,
    "statements": 80
  },
  "mcp-testing.ui.showNotifications": true,
  "mcp-testing.ui.notificationLevel": "failures"
}
```
