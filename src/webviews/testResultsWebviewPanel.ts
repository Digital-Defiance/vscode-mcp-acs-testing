/**
 * TestResultsWebviewPanel - Webview panel for displaying test results
 *
 * Displays test results in an interactive table with filtering, sorting, and export functionality
 */

import * as vscode from 'vscode';
import { MCPTestingClient, TestResult } from '../mcpClient';

/**
 * TestResultsWebviewPanel
 *
 * Manages a webview panel that displays test results with interactive features
 */
export class TestResultsWebviewPanel {
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly mcpClient: MCPTestingClient,
    private readonly outputChannel: vscode.LogOutputChannel
  ) {}

  /**
   * Show the test results panel
   */
  public async show(testResults: TestResult[]): Promise<void> {
    if (this.panel) {
      // Panel already exists, update it
      this.panel.reveal(vscode.ViewColumn.Two);
      this.updateResults(testResults);
      return;
    }

    // Create new panel
    this.panel = vscode.window.createWebviewPanel(
      'mcpTestingResults',
      'Test Results',
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
    this.panel.webview.html = this.getHtmlContent(testResults);

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
   * Update test results in the panel
   */
  private updateResults(testResults: TestResult[]): void {
    if (!this.panel) {
      return;
    }

    this.panel.webview.postMessage({
      type: 'updateResults',
      results: testResults,
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

      case 'runTest':
        await this.runTest(message.testId);
        break;

      case 'debugTest':
        await this.debugTest(message.testId);
        break;

      case 'exportResults':
        await this.exportResults(message.format);
        break;

      case 'filterResults':
        // Filtering is handled in the webview
        break;

      case 'sortResults':
        // Sorting is handled in the webview
        break;

      default:
        this.outputChannel.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Navigate to a test in the editor
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

      // Navigate to test line
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
   * Run a specific test
   */
  private async runTest(testId: string): Promise<void> {
    try {
      const tests = await this.mcpClient.listTests();
      const test = tests.find((t) => t.id === testId);

      if (!test) {
        vscode.window.showWarningMessage(`Test not found: ${testId}`);
        return;
      }

      vscode.window.showInformationMessage(`Running test: ${test.name}`);
      const results = await this.mcpClient.runTests({ testPath: test.file });
      this.updateResults(results);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to run test: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Debug a specific test
   */
  private async debugTest(testId: string): Promise<void> {
    try {
      vscode.window.showInformationMessage(`Debugging test: ${testId}`);
      await this.mcpClient.debugTest(testId);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to debug test: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Export test results
   */
  private async exportResults(format: 'json' | 'csv' | 'html'): Promise<void> {
    try {
      // Get current results from webview
      this.panel?.webview.postMessage({ type: 'getResults' });

      // Wait for response (handled via message)
      // For now, we'll just show a message
      vscode.window.showInformationMessage(`Exporting results as ${format}...`);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to export results: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get HTML content for the webview
   */
  private getHtmlContent(testResults: TestResult[]): string {
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Test Results</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }

        h1 {
            margin-top: 0;
            color: var(--vscode-foreground);
        }

        .stats {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }

        .stat-card {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 5px;
            min-width: 150px;
        }

        .stat-label {
            font-size: 12px;
            opacity: 0.8;
            margin-bottom: 5px;
        }

        .stat-value {
            font-size: 24px;
            font-weight: bold;
        }

        .stat-passed { color: #4caf50; }
        .stat-failed { color: #f44336; }
        .stat-skipped { color: #ff9800; }
        .stat-total { color: var(--vscode-foreground); }

        .controls {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
            align-items: center;
        }

        input[type="text"], select {
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 5px 10px;
            border-radius: 3px;
            font-family: var(--vscode-font-family);
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

        table {
            width: 100%;
            border-collapse: collapse;
            background-color: var(--vscode-editor-background);
        }

        th, td {
            text-align: left;
            padding: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        th {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            font-weight: bold;
            cursor: pointer;
            user-select: none;
        }

        th:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .status-passed { color: #4caf50; }
        .status-failed { color: #f44336; }
        .status-skipped { color: #ff9800; }
        .status-pending { color: #2196f3; }

        .test-name {
            cursor: pointer;
            color: var(--vscode-textLink-foreground);
        }

        .test-name:hover {
            text-decoration: underline;
        }

        .error-message {
            color: var(--vscode-errorForeground);
            font-size: 12px;
            margin-top: 5px;
            white-space: pre-wrap;
            font-family: var(--vscode-editor-font-family);
        }

        .actions {
            display: flex;
            gap: 5px;
        }

        .action-button {
            padding: 3px 8px;
            font-size: 12px;
        }

        .chart-container {
            margin-bottom: 20px;
            padding: 20px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 5px;
        }

        .chart {
            display: flex;
            height: 30px;
            border-radius: 3px;
            overflow: hidden;
        }

        .chart-segment {
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 12px;
            font-weight: bold;
        }

        .chart-passed { background-color: #4caf50; }
        .chart-failed { background-color: #f44336; }
        .chart-skipped { background-color: #ff9800; }
    </style>
</head>
<body>
    <h1>Test Results</h1>

    <div class="stats" id="stats"></div>

    <div class="chart-container">
        <div class="chart" id="chart"></div>
    </div>

    <div class="controls">
        <input type="text" id="searchInput" placeholder="Search tests..." />
        <select id="statusFilter">
            <option value="all">All Status</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
            <option value="pending">Pending</option>
        </select>
        <select id="sortBy">
            <option value="name">Sort by Name</option>
            <option value="status">Sort by Status</option>
            <option value="duration">Sort by Duration</option>
            <option value="file">Sort by File</option>
        </select>
        <button id="exportJson">Export JSON</button>
        <button id="exportCsv">Export CSV</button>
        <button id="exportHtml">Export HTML</button>
    </div>

    <table id="resultsTable">
        <thead>
            <tr>
                <th data-sort="name">Test Name</th>
                <th data-sort="status">Status</th>
                <th data-sort="duration">Duration</th>
                <th data-sort="file">File</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody id="resultsBody"></tbody>
    </table>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let allResults = ${JSON.stringify(testResults)};
        let filteredResults = [...allResults];

        // Initialize
        updateStats();
        updateChart();
        renderResults();

        // Event listeners
        document.getElementById('searchInput').addEventListener('input', filterResults);
        document.getElementById('statusFilter').addEventListener('change', filterResults);
        document.getElementById('sortBy').addEventListener('change', sortResults);
        document.getElementById('exportJson').addEventListener('click', () => exportResults('json'));
        document.getElementById('exportCsv').addEventListener('click', () => exportResults('csv'));
        document.getElementById('exportHtml').addEventListener('click', () => exportResults('html'));

        // Table header sorting
        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const sortBy = th.getAttribute('data-sort');
                document.getElementById('sortBy').value = sortBy;
                sortResults();
            });
        });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'updateResults':
                    allResults = message.results;
                    filterResults();
                    break;
            }
        });

        function updateStats() {
            const passed = allResults.filter(r => r.status === 'passed').length;
            const failed = allResults.filter(r => r.status === 'failed').length;
            const skipped = allResults.filter(r => r.status === 'skipped').length;
            const total = allResults.length;

            document.getElementById('stats').innerHTML = \`
                <div class="stat-card">
                    <div class="stat-label">Total Tests</div>
                    <div class="stat-value stat-total">\${total}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Passed</div>
                    <div class="stat-value stat-passed">\${passed}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Failed</div>
                    <div class="stat-value stat-failed">\${failed}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Skipped</div>
                    <div class="stat-value stat-skipped">\${skipped}</div>
                </div>
            \`;
        }

        function updateChart() {
            const passed = allResults.filter(r => r.status === 'passed').length;
            const failed = allResults.filter(r => r.status === 'failed').length;
            const skipped = allResults.filter(r => r.status === 'skipped').length;
            const total = allResults.length;

            const passedPercent = (passed / total * 100).toFixed(1);
            const failedPercent = (failed / total * 100).toFixed(1);
            const skippedPercent = (skipped / total * 100).toFixed(1);

            document.getElementById('chart').innerHTML = \`
                \${passed > 0 ? \`<div class="chart-segment chart-passed" style="width: \${passedPercent}%">\${passed}</div>\` : ''}
                \${failed > 0 ? \`<div class="chart-segment chart-failed" style="width: \${failedPercent}%">\${failed}</div>\` : ''}
                \${skipped > 0 ? \`<div class="chart-segment chart-skipped" style="width: \${skippedPercent}%">\${skipped}</div>\` : ''}
            \`;
        }

        function filterResults() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            const statusFilter = document.getElementById('statusFilter').value;

            filteredResults = allResults.filter(result => {
                const matchesSearch = result.name.toLowerCase().includes(searchTerm) ||
                                    result.file.toLowerCase().includes(searchTerm);
                const matchesStatus = statusFilter === 'all' || result.status === statusFilter;
                return matchesSearch && matchesStatus;
            });

            sortResults();
        }

        function sortResults() {
            const sortBy = document.getElementById('sortBy').value;

            filteredResults.sort((a, b) => {
                switch (sortBy) {
                    case 'name':
                        return a.name.localeCompare(b.name);
                    case 'status':
                        return a.status.localeCompare(b.status);
                    case 'duration':
                        return b.duration - a.duration;
                    case 'file':
                        return a.file.localeCompare(b.file);
                    default:
                        return 0;
                }
            });

            renderResults();
        }

        function renderResults() {
            const tbody = document.getElementById('resultsBody');
            tbody.innerHTML = '';

            filteredResults.forEach(result => {
                const row = document.createElement('tr');
                row.innerHTML = \`
                    <td>
                        <div class="test-name" onclick="navigateToTest('\${result.id}')">\${escapeHtml(result.name)}</div>
                        \${result.error ? \`<div class="error-message">\${escapeHtml(result.error.message)}</div>\` : ''}
                    </td>
                    <td class="status-\${result.status}">\${result.status.toUpperCase()}</td>
                    <td>\${result.duration}ms</td>
                    <td>\${escapeHtml(result.file)}</td>
                    <td class="actions">
                        <button class="action-button" onclick="runTest('\${result.id}')">Run</button>
                        <button class="action-button" onclick="debugTest('\${result.id}')">Debug</button>
                    </td>
                \`;
                tbody.appendChild(row);
            });
        }

        function navigateToTest(testId) {
            vscode.postMessage({ type: 'navigateToTest', testId });
        }

        function runTest(testId) {
            vscode.postMessage({ type: 'runTest', testId });
        }

        function debugTest(testId) {
            vscode.postMessage({ type: 'debugTest', testId });
        }

        function exportResults(format) {
            vscode.postMessage({ type: 'exportResults', format });
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
