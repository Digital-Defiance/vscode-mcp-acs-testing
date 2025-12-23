/**
 * TestImpactWebviewPanel - Webview panel for test impact analysis
 *
 * Displays affected tests visualization and change-to-test mapping
 */

import * as vscode from 'vscode';
import { MCPTestingClient } from '../mcpClient';

interface ImpactAnalysis {
  affectedTests: TestCase[];
  totalTests: number;
  affectedPercentage: number;
  changes: CodeChange[];
  prioritizedTests: TestCase[];
}

interface TestCase {
  id: string;
  name: string;
  file: string;
  line: number;
  suite: string[];
  tags: string[];
  priority: number;
}

interface CodeChange {
  file: string;
  type: 'added' | 'modified' | 'deleted';
  lines: number[];
  functions: string[];
}

/**
 * TestImpactWebviewPanel
 *
 * Manages a webview panel for test impact analysis
 */
export class TestImpactWebviewPanel {
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly mcpClient: MCPTestingClient,
    private readonly outputChannel: vscode.LogOutputChannel
  ) {}

  /**
   * Show the test impact panel
   */
  public async show(analysis: ImpactAnalysis): Promise<void> {
    if (this.panel) {
      // Panel already exists, update it
      this.panel.reveal(vscode.ViewColumn.Two);
      this.updateAnalysis(analysis);
      return;
    }

    // Create new panel
    this.panel = vscode.window.createWebviewPanel(
      'mcpTestingImpact',
      'Test Impact Analysis',
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
    this.panel.webview.html = this.getHtmlContent(analysis);

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
   * Update analysis in the panel
   */
  private updateAnalysis(analysis: ImpactAnalysis): void {
    if (!this.panel) {
      return;
    }

    this.panel.webview.postMessage({
      type: 'updateAnalysis',
      analysis,
    });
  }

  /**
   * Handle messages from the webview
   */
  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'runAffectedTests':
        await this.runAffectedTests(message.testIds);
        break;

      case 'navigateToTest':
        await this.navigateToTest(message.testId);
        break;

      case 'navigateToChange':
        await this.navigateToChange(message.filePath, message.line);
        break;

      case 'refreshAnalysis':
        await this.refreshAnalysis();
        break;

      default:
        this.outputChannel.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Run affected tests
   */
  private async runAffectedTests(testIds: string[]): Promise<void> {
    try {
      vscode.window.showInformationMessage(`Running ${testIds.length} affected tests...`);
      // This would run the specific tests
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to run tests: ${error instanceof Error ? error.message : String(error)}`
      );
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
   * Navigate to a code change
   */
  private async navigateToChange(filePath: string, line?: number): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(filePath);
      const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);

      if (line !== undefined) {
        const position = new vscode.Position(line - 1, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to navigate to change: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Refresh impact analysis
   */
  private async refreshAnalysis(): Promise<void> {
    try {
      vscode.window.showInformationMessage('Refreshing impact analysis...');
      const analysis = await this.mcpClient.analyzeImpact();
      this.updateAnalysis(analysis);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to refresh analysis: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get HTML content for the webview
   */
  private getHtmlContent(analysis: ImpactAnalysis): string {
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Test Impact Analysis</title>
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

        .impact-high { color: #f44336; }
        .impact-medium { color: #ff9800; }
        .impact-low { color: #4caf50; }

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

        button.primary {
            background-color: #2196f3;
        }

        button.primary:hover {
            background-color: #1976d2;
        }

        .section {
            margin-bottom: 30px;
        }

        .changes-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 30px;
        }

        .change-item {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid;
            cursor: pointer;
        }

        .change-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .change-added { border-left-color: #4caf50; }
        .change-modified { border-left-color: #ff9800; }
        .change-deleted { border-left-color: #f44336; }

        .change-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .change-file {
            font-weight: bold;
        }

        .change-type {
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
        }

        .type-added { background-color: #4caf50; color: white; }
        .type-modified { background-color: #ff9800; color: white; }
        .type-deleted { background-color: #f44336; color: white; }

        .change-details {
            font-size: 12px;
            opacity: 0.8;
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

        .test-priority {
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
        }

        .priority-high { background-color: #f44336; color: white; }
        .priority-medium { background-color: #ff9800; color: white; }
        .priority-low { background-color: #4caf50; color: white; }

        .test-details {
            font-size: 12px;
            opacity: 0.8;
        }

        .visualization {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 30px;
        }

        .impact-graph {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .graph-row {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .graph-label {
            min-width: 150px;
            font-size: 12px;
        }

        .graph-bar {
            flex: 1;
            height: 30px;
            background-color: var(--vscode-button-background);
            border-radius: 3px;
            display: flex;
            align-items: center;
            padding: 0 10px;
            color: white;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <h1>Test Impact Analysis</h1>

    <div class="summary">
        <div class="summary-card">
            <div class="summary-label">Total Tests</div>
            <div class="summary-value">${analysis.totalTests}</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Affected Tests</div>
            <div class="summary-value impact-${this.getImpactClass(analysis.affectedPercentage)}">
                ${analysis.affectedTests.length}
            </div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Impact Percentage</div>
            <div class="summary-value impact-${this.getImpactClass(analysis.affectedPercentage)}">
                ${analysis.affectedPercentage.toFixed(1)}%
            </div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Code Changes</div>
            <div class="summary-value">${analysis.changes.length}</div>
        </div>
    </div>

    <div class="controls">
        <button class="primary" id="runAffectedBtn">Run Affected Tests</button>
        <button id="refreshBtn">Refresh Analysis</button>
        <button id="runAllBtn">Run All Tests</button>
    </div>

    <div class="visualization">
        <h2>Impact Visualization</h2>
        <div class="impact-graph">
            <div class="graph-row">
                <div class="graph-label">Affected Tests</div>
                <div class="graph-bar" style="width: ${analysis.affectedPercentage}%">
                    ${analysis.affectedTests.length}
                </div>
            </div>
            <div class="graph-row">
                <div class="graph-label">Unaffected Tests</div>
                <div class="graph-bar" style="width: ${
                  100 - analysis.affectedPercentage
                }%; background-color: var(--vscode-input-background);">
                    ${analysis.totalTests - analysis.affectedTests.length}
                </div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Code Changes</h2>
        <div class="changes-list" id="changesList"></div>
    </div>

    <div class="section">
        <h2>Affected Tests (Prioritized)</h2>
        <div class="test-list" id="testList"></div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let analysis = ${JSON.stringify(analysis)};

        // Initialize
        renderChanges();
        renderTests();

        // Event listeners
        document.getElementById('runAffectedBtn').addEventListener('click', runAffectedTests);
        document.getElementById('refreshBtn').addEventListener('click', refreshAnalysis);
        document.getElementById('runAllBtn').addEventListener('click', runAllTests);

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'updateAnalysis':
                    analysis = message.analysis;
                    renderChanges();
                    renderTests();
                    break;
            }
        });

        function renderChanges() {
            const changesList = document.getElementById('changesList');
            changesList.innerHTML = '';

            if (analysis.changes.length === 0) {
                changesList.innerHTML = '<p style="text-align: center; opacity: 0.6;">No code changes detected</p>';
                return;
            }

            analysis.changes.forEach(change => {
                const changeItem = document.createElement('div');
                changeItem.className = \`change-item change-\${change.type}\`;
                changeItem.innerHTML = \`
                    <div class="change-header">
                        <div class="change-file">\${escapeHtml(change.file)}</div>
                        <div class="change-type type-\${change.type}">\${change.type}</div>
                    </div>
                    <div class="change-details">
                        \${change.lines.length} lines changed
                        \${change.functions.length > 0 ? \` • Functions: \${change.functions.join(', ')}\` : ''}
                    </div>
                \`;
                changeItem.addEventListener('click', () => navigateToChange(change.file, change.lines[0]));
                changesList.appendChild(changeItem);
            });
        }

        function renderTests() {
            const testList = document.getElementById('testList');
            testList.innerHTML = '';

            if (analysis.prioritizedTests.length === 0) {
                testList.innerHTML = '<p style="text-align: center; opacity: 0.6;">No affected tests</p>';
                return;
            }

            analysis.prioritizedTests.forEach(test => {
                const priorityClass = getPriorityClass(test.priority);
                const testItem = document.createElement('div');
                testItem.className = 'test-item';
                testItem.innerHTML = \`
                    <div class="test-header">
                        <div class="test-name">\${escapeHtml(test.name)}</div>
                        <div class="test-priority priority-\${priorityClass}">
                            Priority: \${test.priority}
                        </div>
                    </div>
                    <div class="test-details">
                        📁 \${escapeHtml(test.file)}:\${test.line}
                        \${test.suite.length > 0 ? \` • Suite: \${test.suite.join(' > ')}\` : ''}
                        \${test.tags.length > 0 ? \` • Tags: \${test.tags.join(', ')}\` : ''}
                    </div>
                \`;
                testItem.addEventListener('click', () => navigateToTest(test.id));
                testList.appendChild(testItem);
            });
        }

        function runAffectedTests() {
            const testIds = analysis.affectedTests.map(t => t.id);
            vscode.postMessage({ type: 'runAffectedTests', testIds });
        }

        function runAllTests() {
            vscode.postMessage({ type: 'runAffectedTests', testIds: [] });
        }

        function refreshAnalysis() {
            vscode.postMessage({ type: 'refreshAnalysis' });
        }

        function navigateToTest(testId) {
            vscode.postMessage({ type: 'navigateToTest', testId });
        }

        function navigateToChange(filePath, line) {
            vscode.postMessage({ type: 'navigateToChange', filePath, line });
        }

        function getPriorityClass(priority) {
            if (priority >= 8) return 'high';
            if (priority >= 5) return 'medium';
            return 'low';
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
   * Get impact class based on percentage
   */
  private getImpactClass(percentage: number): string {
    if (percentage >= 50) return 'high';
    if (percentage >= 25) return 'medium';
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
