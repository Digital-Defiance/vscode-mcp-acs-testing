/**
 * TestPerformanceWebviewPanel - Webview panel for test performance analysis
 *
 * Displays slowest tests, performance trends, and optimization suggestions
 */

import * as vscode from 'vscode';
import { MCPTestingClient } from '../mcpClient';

interface PerformanceReport {
  totalDuration: number;
  averageDuration: number;
  slowestTests: PerformanceTest[];
  trends: PerformanceTrend[];
  suggestions: OptimizationSuggestion[];
  timestamp: string;
}

interface PerformanceTest {
  id: string;
  name: string;
  file: string;
  line: number;
  duration: number;
  averageDuration: number;
  regression: number;
}

interface PerformanceTrend {
  testId: string;
  testName: string;
  durations: number[];
  timestamps: string[];
  trend: 'improving' | 'stable' | 'degrading';
}

interface OptimizationSuggestion {
  testId: string;
  testName: string;
  type: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * TestPerformanceWebviewPanel
 *
 * Manages a webview panel for test performance analysis
 */
export class TestPerformanceWebviewPanel {
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly mcpClient: MCPTestingClient,
    private readonly outputChannel: vscode.LogOutputChannel
  ) {}

  /**
   * Show the performance panel
   */
  public async show(report: PerformanceReport): Promise<void> {
    if (this.panel) {
      // Panel already exists, update it
      this.panel.reveal(vscode.ViewColumn.Two);
      this.updateReport(report);
      return;
    }

    // Create new panel
    this.panel = vscode.window.createWebviewPanel(
      'mcpTestingPerformance',
      'Test Performance',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.context.extensionUri],
      }
    );

    // Set icon
    this.panel.iconPath = {
      light: vscode.Uri.joinPath(this.context.extensionUri, 'images', 'icon.png'),
      dark: vscode.Uri.joinPath(this.context.extensionUri, 'images', 'icon.png'),
    };

    // Set HTML content
    this.panel.webview.html = this.getHtmlContent(report);

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleMessage(message);
      },
      null,
      this.disposables
    );

    // Handle panel disposal
    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
      },
      null,
      this.disposables
    );
  }

  /**
   * Update report in the panel
   */
  private updateReport(report: PerformanceReport): void {
    if (!this.panel) {
      return;
    }

    this.panel.webview.postMessage({
      type: 'updateReport',
      report,
    });
  }

  /**
   * Handle messages from the webview
   */
  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'navigateToTest':
        await this.navigateToTest(message.testId);
        break;

      case 'profileTest':
        await this.profileTest(message.testId);
        break;

      case 'applySuggestion':
        await this.applySuggestion(message.suggestionIndex);
        break;

      case 'refreshReport':
        await this.refreshReport();
        break;

      default:
        this.outputChannel.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Navigate to a test
   */
  private async navigateToTest(testId: string): Promise<void> {
    try {
      const tests = await this.mcpClient.listTests();
      const test = tests.find((t) => t.id === testId);

      if (!test) {
        vscode.window.showWarningMessage(`Test not found: ${testId}`);
        return;
      }

      const document = await vscode.workspace.openTextDocument(test.file);
      const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);

      const position = new vscode.Position(test.line - 1, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to navigate to test: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Profile a test
   */
  private async profileTest(testId: string): Promise<void> {
    try {
      vscode.window.showInformationMessage(`Profiling test: ${testId}`);
      // This would integrate with the debugger to profile the test
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to profile test: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Apply an optimization suggestion
   */
  private async applySuggestion(suggestionIndex: number): Promise<void> {
    try {
      vscode.window.showInformationMessage(`Applying suggestion ${suggestionIndex}...`);
      // This would apply the optimization suggestion
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to apply suggestion: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Refresh performance report
   */
  private async refreshReport(): Promise<void> {
    try {
      vscode.window.showInformationMessage('Refreshing performance report...');
      const report = await this.mcpClient.benchmarkPerformance();
      this.updateReport(report);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to refresh report: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get HTML content for the webview
   */
  private getHtmlContent(report: PerformanceReport): string {
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Test Performance Report</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }

        h1, h2 {
            margin-top: 0;
            color: var(--vscode-foreground);
        }

        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }

        .summary-card {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 20px;
            border-radius: 5px;
        }

        .summary-label {
            font-size: 12px;
            opacity: 0.8;
            margin-bottom: 5px;
        }

        .summary-value {
            font-size: 32px;
            font-weight: bold;
        }

        .controls {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }

        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
        }

        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .section {
            margin-bottom: 30px;
        }

        .test-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .test-item {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 5px;
            cursor: pointer;
        }

        .test-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .test-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .test-name {
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }

        .test-duration {
            font-size: 18px;
            font-weight: bold;
        }

        .duration-slow { color: #f44336; }
        .duration-medium { color: #ff9800; }
        .duration-fast { color: #4caf50; }

        .test-details {
            font-size: 12px;
            opacity: 0.8;
            margin-bottom: 10px;
        }

        .test-regression {
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
        }

        .regression-positive { background-color: #f44336; color: white; }
        .regression-neutral { background-color: #2196f3; color: white; }
        .regression-negative { background-color: #4caf50; color: white; }

        .test-actions {
            display: flex;
            gap: 10px;
            margin-top: 10px;
        }

        .action-button {
            padding: 4px 10px;
            font-size: 12px;
        }

        .trend-chart {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 30px;
        }

        .trend-line {
            display: flex;
            align-items: flex-end;
            height: 150px;
            gap: 5px;
            margin-top: 20px;
        }

        .trend-bar {
            flex: 1;
            background-color: var(--vscode-button-background);
            border-radius: 3px 3px 0 0;
            min-width: 20px;
            position: relative;
        }

        .trend-bar:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .trend-label {
            position: absolute;
            bottom: -20px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 10px;
            white-space: nowrap;
        }

        .suggestions-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .suggestion-item {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid;
        }

        .suggestion-high { border-left-color: #f44336; }
        .suggestion-medium { border-left-color: #ff9800; }
        .suggestion-low { border-left-color: #4caf50; }

        .suggestion-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .suggestion-type {
            font-weight: bold;
        }

        .suggestion-priority {
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
        }

        .priority-high { background-color: #f44336; color: white; }
        .priority-medium { background-color: #ff9800; color: white; }
        .priority-low { background-color: #4caf50; color: white; }

        .suggestion-description {
            font-size: 13px;
            margin-bottom: 10px;
        }

        .suggestion-test {
            font-size: 12px;
            opacity: 0.8;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <h1>Test Performance Report</h1>

    <div class="summary">
        <div class="summary-card">
            <div class="summary-label">Total Duration</div>
            <div class="summary-value">${this.formatDuration(report.totalDuration)}</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Average Duration</div>
            <div class="summary-value">${this.formatDuration(report.averageDuration)}</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Slow Tests</div>
            <div class="summary-value" style="color: #f44336;">${report.slowestTests.length}</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Suggestions</div>
            <div class="summary-value" style="color: #ff9800;">${report.suggestions.length}</div>
        </div>
    </div>

    <div class="controls">
        <button id="refreshBtn">Refresh Report</button>
        <button id="exportBtn">Export Report</button>
    </div>

    <div class="section">
        <h2>Slowest Tests</h2>
        <div class="test-list" id="testList"></div>
    </div>

    <div class="section">
        <h2>Performance Trends</h2>
        <div id="trendsContainer"></div>
    </div>

    <div class="section">
        <h2>Optimization Suggestions</h2>
        <div class="suggestions-list" id="suggestionsList"></div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let report = ${JSON.stringify(report)};

        // Initialize
        renderTests();
        renderTrends();
        renderSuggestions();

        // Event listeners
        document.getElementById('refreshBtn').addEventListener('click', refreshReport);
        document.getElementById('exportBtn').addEventListener('click', exportReport);

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'updateReport':
                    report = message.report;
                    renderTests();
                    renderTrends();
                    renderSuggestions();
                    break;
            }
        });

        function renderTests() {
            const testList = document.getElementById('testList');
            testList.innerHTML = '';

            if (report.slowestTests.length === 0) {
                testList.innerHTML = '<p style="text-align: center; opacity: 0.6;">No slow tests detected</p>';
                return;
            }

            report.slowestTests.forEach(test => {
                const durationClass = getDurationClass(test.duration);
                const regressionClass = getRegressionClass(test.regression);

                const testItem = document.createElement('div');
                testItem.className = 'test-item';
                testItem.innerHTML = \`
                    <div class="test-header">
                        <div class="test-name">\${escapeHtml(test.name)}</div>
                        <div class="test-duration duration-\${durationClass}">
                            \${formatDuration(test.duration)}
                        </div>
                    </div>
                    <div class="test-details">
                        📁 \${escapeHtml(test.file)}:\${test.line}
                        • Average: \${formatDuration(test.averageDuration)}
                        \${test.regression !== 0 ? \`
                            • <span class="test-regression regression-\${regressionClass}">
                                \${test.regression > 0 ? '+' : ''}\${test.regression.toFixed(1)}% regression
                            </span>
                        \` : ''}
                    </div>
                    <div class="test-actions">
                        <button class="action-button" onclick="navigateToTest('\${test.id}')">
                            View Test
                        </button>
                        <button class="action-button" onclick="profileTest('\${test.id}')">
                            Profile
                        </button>
                    </div>
                \`;
                testList.appendChild(testItem);
            });
        }

        function renderTrends() {
            const trendsContainer = document.getElementById('trendsContainer');
            trendsContainer.innerHTML = '';

            if (report.trends.length === 0) {
                trendsContainer.innerHTML = '<p style="text-align: center; opacity: 0.6;">No trend data available</p>';
                return;
            }

            report.trends.forEach(trend => {
                const trendChart = document.createElement('div');
                trendChart.className = 'trend-chart';
                
                const maxDuration = Math.max(...trend.durations);
                const bars = trend.durations.map((duration, index) => {
                    const height = (duration / maxDuration * 100).toFixed(1);
                    const date = new Date(trend.timestamps[index]).toLocaleDateString();
                    return \`
                        <div class="trend-bar" style="height: \${height}%" title="\${date}: \${formatDuration(duration)}">
                            <div class="trend-label">\${date}</div>
                        </div>
                    \`;
                }).join('');

                trendChart.innerHTML = \`
                    <h3>\${escapeHtml(trend.testName)}</h3>
                    <div>Trend: <strong>\${trend.trend.toUpperCase()}</strong></div>
                    <div class="trend-line">\${bars}</div>
                \`;
                trendsContainer.appendChild(trendChart);
            });
        }

        function renderSuggestions() {
            const suggestionsList = document.getElementById('suggestionsList');
            suggestionsList.innerHTML = '';

            if (report.suggestions.length === 0) {
                suggestionsList.innerHTML = '<p style="text-align: center; opacity: 0.6;">No optimization suggestions</p>';
                return;
            }

            report.suggestions.forEach((suggestion, index) => {
                const suggestionItem = document.createElement('div');
                suggestionItem.className = \`suggestion-item suggestion-\${suggestion.priority}\`;
                suggestionItem.innerHTML = \`
                    <div class="suggestion-header">
                        <div class="suggestion-type">\${escapeHtml(suggestion.type)}</div>
                        <div class="suggestion-priority priority-\${suggestion.priority}">
                            \${suggestion.priority}
                        </div>
                    </div>
                    <div class="suggestion-test">
                        Test: \${escapeHtml(suggestion.testName)}
                    </div>
                    <div class="suggestion-description">
                        \${escapeHtml(suggestion.description)}
                    </div>
                    <button class="action-button" onclick="applySuggestion(\${index})">
                        Apply Suggestion
                    </button>
                \`;
                suggestionsList.appendChild(suggestionItem);
            });
        }

        function navigateToTest(testId) {
            vscode.postMessage({ type: 'navigateToTest', testId });
        }

        function profileTest(testId) {
            vscode.postMessage({ type: 'profileTest', testId });
        }

        function applySuggestion(index) {
            vscode.postMessage({ type: 'applySuggestion', suggestionIndex: index });
        }

        function refreshReport() {
            vscode.postMessage({ type: 'refreshReport' });
        }

        function exportReport() {
            alert('Export functionality coming soon');
        }

        function getDurationClass(duration) {
            if (duration > 5000) return 'slow';
            if (duration > 1000) return 'medium';
            return 'fast';
        }

        function getRegressionClass(regression) {
            if (regression > 10) return 'positive';
            if (regression < -10) return 'negative';
            return 'neutral';
        }

        function formatDuration(ms) {
            if (ms >= 1000) {
                return (ms / 1000).toFixed(2) + 's';
            }
            return ms.toFixed(0) + 'ms';
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    </script>
</body>
</html>`;
  }

  /**
   * Format duration in milliseconds
   */
  private formatDuration(ms: number): string {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(2)}s`;
    }
    return `${ms.toFixed(0)}ms`;
  }

  /**
   * Generate a nonce for CSP
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Dispose the panel
   */
  public dispose(): void {
    if (this.panel) {
      this.panel.dispose();
    }
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
