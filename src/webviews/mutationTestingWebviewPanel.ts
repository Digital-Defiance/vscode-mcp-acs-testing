/**
 * MutationTestingWebviewPanel - Webview panel for mutation testing results
 *
 * Displays mutation score, surviving mutations, and code diffs
 */

import * as vscode from 'vscode';
import { MCPTestingClient } from '../mcpClient';

interface MutationReport {
  totalMutations: number;
  killedMutations: number;
  survivedMutations: number;
  mutationScore: number;
  mutations: MutationResult[];
  timestamp: string;
}

interface MutationResult {
  id: string;
  file: string;
  line: number;
  mutationType: string;
  original: string;
  mutated: string;
  killed: boolean;
  killedBy: string[];
  duration: number;
}

/**
 * MutationTestingWebviewPanel
 *
 * Manages a webview panel for mutation testing results
 */
export class MutationTestingWebviewPanel {
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly mcpClient: MCPTestingClient,
    private readonly outputChannel: vscode.LogOutputChannel
  ) {}

  /**
   * Show the mutation testing panel
   */
  public async show(report: MutationReport): Promise<void> {
    if (this.panel) {
      // Panel already exists, update it
      this.panel.reveal(vscode.ViewColumn.Two);
      this.updateReport(report);
      return;
    }

    // Create new panel
    this.panel = vscode.window.createWebviewPanel(
      'mcpTestingMutation',
      'Mutation Testing',
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
  private updateReport(report: MutationReport): void {
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
      case 'navigateToMutation':
        await this.navigateToMutation(message.mutationId);
        break;

      case 'generateTestForMutation':
        await this.generateTestForMutation(message.mutationId);
        break;

      case 'runMutationAgain':
        await this.runMutationAgain(message.mutationId);
        break;

      case 'exportReport':
        await this.exportReport(message.format);
        break;

      default:
        this.outputChannel.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Navigate to a mutation in the editor
   */
  private async navigateToMutation(mutationId: string): Promise<void> {
    try {
      // This would need to be implemented with actual mutation data
      vscode.window.showInformationMessage(`Navigating to mutation: ${mutationId}`);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to navigate to mutation: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate test for a surviving mutation
   */
  private async generateTestForMutation(mutationId: string): Promise<void> {
    try {
      vscode.window.showInformationMessage(`Generating test for mutation: ${mutationId}`);
      // This would call the test generation functionality
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to generate test: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Run a mutation again
   */
  private async runMutationAgain(mutationId: string): Promise<void> {
    try {
      vscode.window.showInformationMessage(`Running mutation: ${mutationId}`);
      // This would re-run the specific mutation
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to run mutation: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Export mutation report
   */
  private async exportReport(format: 'json' | 'html' | 'csv'): Promise<void> {
    try {
      vscode.window.showInformationMessage(`Exporting report as ${format}...`);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to export report: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get HTML content for the webview
   */
  private getHtmlContent(report: MutationReport): string {
    const nonce = this.getNonce();
    const scoreClass = this.getScoreClass(report.mutationScore);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Mutation Testing Report</title>
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

        .score-card {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            margin-bottom: 30px;
        }

        .score-value {
            font-size: 72px;
            font-weight: bold;
            margin: 20px 0;
        }

        .score-high { color: #4caf50; }
        .score-medium { color: #ff9800; }
        .score-low { color: #f44336; }

        .score-label {
            font-size: 18px;
            opacity: 0.8;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }

        .stat-card {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 20px;
            border-radius: 5px;
        }

        .stat-label {
            font-size: 12px;
            opacity: 0.8;
            margin-bottom: 5px;
        }

        .stat-value {
            font-size: 28px;
            font-weight: bold;
        }

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

        .mutation-list {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .mutation-item {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 20px;
            border-radius: 5px;
            border-left: 4px solid;
        }

        .mutation-killed {
            border-left-color: #4caf50;
        }

        .mutation-survived {
            border-left-color: #f44336;
        }

        .mutation-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .mutation-type {
            font-weight: bold;
            font-size: 14px;
        }

        .mutation-status {
            padding: 4px 12px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
        }

        .status-killed {
            background-color: #4caf50;
            color: white;
        }

        .status-survived {
            background-color: #f44336;
            color: white;
        }

        .mutation-location {
            font-size: 12px;
            opacity: 0.8;
            margin-bottom: 15px;
        }

        .mutation-diff {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            padding: 15px;
            font-family: var(--vscode-editor-font-family);
            margin-bottom: 15px;
        }

        .diff-line {
            padding: 2px 0;
        }

        .diff-removed {
            background-color: rgba(244, 67, 54, 0.2);
            color: #f44336;
        }

        .diff-added {
            background-color: rgba(76, 175, 80, 0.2);
            color: #4caf50;
        }

        .mutation-tests {
            font-size: 12px;
            margin-bottom: 15px;
        }

        .mutation-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .action-button {
            padding: 4px 10px;
            font-size: 12px;
        }

        .chart-container {
            margin-bottom: 30px;
            padding: 20px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 5px;
        }

        .chart {
            display: flex;
            height: 40px;
            border-radius: 3px;
            overflow: hidden;
        }

        .chart-segment {
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 14px;
            font-weight: bold;
        }

        .chart-killed { background-color: #4caf50; }
        .chart-survived { background-color: #f44336; }
    </style>
</head>
<body>
    <h1>Mutation Testing Report</h1>

    <div class="score-card">
        <div class="score-label">Mutation Score</div>
        <div class="score-value score-${scoreClass}">${report.mutationScore.toFixed(1)}%</div>
        <div class="score-label">
            ${report.killedMutations} of ${report.totalMutations} mutations killed
        </div>
    </div>

    <div class="chart-container">
        <div class="chart">
            <div class="chart-segment chart-killed" style="width: ${(
              (report.killedMutations / report.totalMutations) *
              100
            ).toFixed(1)}%">
                ${report.killedMutations} Killed
            </div>
            <div class="chart-segment chart-survived" style="width: ${(
              (report.survivedMutations / report.totalMutations) *
              100
            ).toFixed(1)}%">
                ${report.survivedMutations} Survived
            </div>
        </div>
    </div>

    <div class="stats">
        <div class="stat-card">
            <div class="stat-label">Total Mutations</div>
            <div class="stat-value">${report.totalMutations}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Killed Mutations</div>
            <div class="stat-value" style="color: #4caf50;">${report.killedMutations}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Survived Mutations</div>
            <div class="stat-value" style="color: #f44336;">${report.survivedMutations}</div>
        </div>
    </div>

    <div class="controls">
        <input type="text" id="searchInput" placeholder="Search mutations..." />
        <select id="statusFilter">
            <option value="all">All Mutations</option>
            <option value="survived">Survived Only</option>
            <option value="killed">Killed Only</option>
        </select>
        <select id="typeFilter">
            <option value="all">All Types</option>
            <option value="arithmetic_operator">Arithmetic Operator</option>
            <option value="relational_operator">Relational Operator</option>
            <option value="logical_operator">Logical Operator</option>
            <option value="return_value">Return Value</option>
            <option value="conditional">Conditional</option>
        </select>
        <button id="exportJson">Export JSON</button>
        <button id="exportHtml">Export HTML</button>
        <button id="exportCsv">Export CSV</button>
    </div>

    <h2>Mutations</h2>
    <div id="mutationList" class="mutation-list"></div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let report = ${JSON.stringify(report)};
        let filteredMutations = [...report.mutations];

        // Initialize
        renderMutations();

        // Event listeners
        document.getElementById('searchInput').addEventListener('input', filterMutations);
        document.getElementById('statusFilter').addEventListener('change', filterMutations);
        document.getElementById('typeFilter').addEventListener('change', filterMutations);
        document.getElementById('exportJson').addEventListener('click', () => exportReport('json'));
        document.getElementById('exportHtml').addEventListener('click', () => exportReport('html'));
        document.getElementById('exportCsv').addEventListener('click', () => exportReport('csv'));

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'updateReport':
                    report = message.report;
                    filterMutations();
                    break;
            }
        });

        function filterMutations() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            const statusFilter = document.getElementById('statusFilter').value;
            const typeFilter = document.getElementById('typeFilter').value;

            filteredMutations = report.mutations.filter(mutation => {
                const matchesSearch = mutation.file.toLowerCase().includes(searchTerm) ||
                                    mutation.mutationType.toLowerCase().includes(searchTerm);
                const matchesStatus = statusFilter === 'all' || 
                                    (statusFilter === 'survived' && !mutation.killed) ||
                                    (statusFilter === 'killed' && mutation.killed);
                const matchesType = typeFilter === 'all' || mutation.mutationType === typeFilter;
                return matchesSearch && matchesStatus && matchesType;
            });

            renderMutations();
        }

        function renderMutations() {
            const mutationList = document.getElementById('mutationList');
            mutationList.innerHTML = '';

            if (filteredMutations.length === 0) {
                mutationList.innerHTML = '<p style="text-align: center; opacity: 0.6;">No mutations found</p>';
                return;
            }

            filteredMutations.forEach(mutation => {
                const mutationItem = document.createElement('div');
                mutationItem.className = \`mutation-item mutation-\${mutation.killed ? 'killed' : 'survived'}\`;
                mutationItem.innerHTML = \`
                    <div class="mutation-header">
                        <div class="mutation-type">\${formatMutationType(mutation.mutationType)}</div>
                        <div class="mutation-status status-\${mutation.killed ? 'killed' : 'survived'}">
                            \${mutation.killed ? 'KILLED' : 'SURVIVED'}
                        </div>
                    </div>
                    <div class="mutation-location">
                        📁 \${escapeHtml(mutation.file)}:\${mutation.line}
                    </div>
                    <div class="mutation-diff">
                        <div class="diff-line diff-removed">- \${escapeHtml(mutation.original)}</div>
                        <div class="diff-line diff-added">+ \${escapeHtml(mutation.mutated)}</div>
                    </div>
                    \${mutation.killed ? \`
                        <div class="mutation-tests">
                            ✓ Killed by: \${mutation.killedBy.join(', ')}
                        </div>
                    \` : \`
                        <div class="mutation-tests" style="color: #f44336;">
                            ⚠ No tests caught this mutation
                        </div>
                    \`}
                    <div class="mutation-actions">
                        <button class="action-button" onclick="navigateToMutation('\${mutation.id}')">
                            View in Editor
                        </button>
                        \${!mutation.killed ? \`
                            <button class="action-button" onclick="generateTest('\${mutation.id}')">
                                Generate Test
                            </button>
                        \` : ''}
                        <button class="action-button" onclick="runAgain('\${mutation.id}')">
                            Run Again
                        </button>
                    </div>
                \`;
                mutationList.appendChild(mutationItem);
            });
        }

        function navigateToMutation(mutationId) {
            vscode.postMessage({ type: 'navigateToMutation', mutationId });
        }

        function generateTest(mutationId) {
            vscode.postMessage({ type: 'generateTestForMutation', mutationId });
        }

        function runAgain(mutationId) {
            vscode.postMessage({ type: 'runMutationAgain', mutationId });
        }

        function exportReport(format) {
            vscode.postMessage({ type: 'exportReport', format });
        }

        function formatMutationType(type) {
            return type.split('_').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
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
   * Get score class based on mutation score
   */
  private getScoreClass(score: number): string {
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
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
