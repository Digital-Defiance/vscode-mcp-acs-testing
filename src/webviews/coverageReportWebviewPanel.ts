/**
 * CoverageReportWebviewPanel - Webview panel for displaying coverage reports
 *
 * Displays coverage metrics with charts, file-level breakdown, and drill-down navigation
 */

import * as vscode from 'vscode';
import { MCPTestingClient, CoverageReport } from '../mcpClient';

/**
 * CoverageReportWebviewPanel
 *
 * Manages a webview panel that displays coverage reports with interactive features
 */
export class CoverageReportWebviewPanel {
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];
  private coverageHistory: CoverageReport[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly mcpClient: MCPTestingClient,
    private readonly outputChannel: vscode.LogOutputChannel
  ) {}

  /**
   * Show the coverage report panel
   */
  public async show(coverageReport: CoverageReport): Promise<void> {
    // Add to history
    this.coverageHistory.push(coverageReport);
    if (this.coverageHistory.length > 10) {
      this.coverageHistory.shift();
    }

    if (this.panel) {
      // Panel already exists, update it
      this.panel.reveal(vscode.ViewColumn.Two);
      this.updateCoverage(coverageReport);
      return;
    }

    // Create new panel
    this.panel = vscode.window.createWebviewPanel(
      'mcpTestingCoverage',
      'Coverage Report',
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
    this.panel.webview.html = this.getHtmlContent(coverageReport);

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
   * Update coverage in the panel
   */
  private updateCoverage(coverageReport: CoverageReport): void {
    if (!this.panel) {
      return;
    }

    this.panel.webview.postMessage({
      type: 'updateCoverage',
      coverage: coverageReport,
      history: this.coverageHistory,
    });
  }

  /**
   * Handle messages from the webview
   */
  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'navigateToFile':
        await this.navigateToFile(message.filePath, message.line);
        break;

      case 'generateTests':
        await this.generateTests(message.filePath);
        break;

      case 'exportCoverage':
        await this.exportCoverage(message.format);
        break;

      case 'compareCoverage':
        await this.compareCoverage(message.timestamp1, message.timestamp2);
        break;

      default:
        this.outputChannel.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Navigate to a file in the editor
   */
  private async navigateToFile(filePath: string, line?: number): Promise<void> {
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
        `Failed to navigate to file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate tests for uncovered code
   */
  private async generateTests(filePath: string): Promise<void> {
    try {
      vscode.window.showInformationMessage(`Generating tests for ${filePath}...`);
      const tests = await this.mcpClient.generateTests(filePath);
      vscode.window.showInformationMessage(`Generated ${tests.length} tests`);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to generate tests: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Export coverage report
   */
  private async exportCoverage(format: 'json' | 'html' | 'lcov'): Promise<void> {
    try {
      vscode.window.showInformationMessage(`Exporting coverage as ${format}...`);
      // TODO: Implement export functionality
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to export coverage: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Compare two coverage reports
   */
  private async compareCoverage(timestamp1: string, timestamp2: string): Promise<void> {
    try {
      const report1 = this.coverageHistory.find((r) => r.timestamp === timestamp1);
      const report2 = this.coverageHistory.find((r) => r.timestamp === timestamp2);

      if (!report1 || !report2) {
        vscode.window.showWarningMessage('Coverage reports not found');
        return;
      }

      // Send comparison data to webview
      this.panel?.webview.postMessage({
        type: 'showComparison',
        report1,
        report2,
      });
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to compare coverage: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get HTML content for the webview
   */
  private getHtmlContent(coverageReport: CoverageReport): string {
    const nonce = this.getNonce();
    const files = Object.entries(coverageReport.files);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Coverage Report</title>
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

        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }

        .metric-card {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 20px;
            border-radius: 5px;
        }

        .metric-label {
            font-size: 12px;
            opacity: 0.8;
            margin-bottom: 10px;
        }

        .metric-value {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 10px;
        }

        .metric-bar {
            height: 8px;
            background-color: var(--vscode-input-background);
            border-radius: 4px;
            overflow: hidden;
        }

        .metric-bar-fill {
            height: 100%;
            transition: width 0.3s ease;
        }

        .coverage-high { color: #4caf50; }
        .coverage-medium { color: #ff9800; }
        .coverage-low { color: #f44336; }

        .bar-high { background-color: #4caf50; }
        .bar-medium { background-color: #ff9800; }
        .bar-low { background-color: #f44336; }

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

        .file-list {
            margin-top: 20px;
        }

        .file-item {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 5px;
            cursor: pointer;
        }

        .file-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .file-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .file-name {
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }

        .file-coverage {
            font-size: 18px;
            font-weight: bold;
        }

        .file-metrics {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            font-size: 12px;
        }

        .file-metric {
            display: flex;
            flex-direction: column;
        }

        .file-metric-label {
            opacity: 0.8;
            margin-bottom: 3px;
        }

        .trend-chart {
            margin: 30px 0;
            padding: 20px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 5px;
        }

        .trend-line {
            display: flex;
            align-items: flex-end;
            height: 150px;
            gap: 5px;
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

        .comparison-view {
            display: none;
            margin-top: 30px;
        }

        .comparison-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }

        .comparison-column {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 20px;
            border-radius: 5px;
        }

        .diff-positive { color: #4caf50; }
        .diff-negative { color: #f44336; }
    </style>
</head>
<body>
    <h1>Coverage Report</h1>

    <div class="metrics">
        <div class="metric-card">
            <div class="metric-label">Line Coverage</div>
            <div class="metric-value coverage-${this.getCoverageClass(
              coverageReport.overall.lines.percentage
            )}">
                ${coverageReport.overall.lines.percentage.toFixed(1)}%
            </div>
            <div class="metric-bar">
                <div class="metric-bar-fill bar-${this.getCoverageClass(
                  coverageReport.overall.lines.percentage
                )}" 
                     style="width: ${coverageReport.overall.lines.percentage}%"></div>
            </div>
            <div style="margin-top: 5px; font-size: 12px;">
                ${coverageReport.overall.lines.covered} / ${coverageReport.overall.lines.total}
            </div>
        </div>

        <div class="metric-card">
            <div class="metric-label">Branch Coverage</div>
            <div class="metric-value coverage-${this.getCoverageClass(
              coverageReport.overall.branches.percentage
            )}">
                ${coverageReport.overall.branches.percentage.toFixed(1)}%
            </div>
            <div class="metric-bar">
                <div class="metric-bar-fill bar-${this.getCoverageClass(
                  coverageReport.overall.branches.percentage
                )}" 
                     style="width: ${coverageReport.overall.branches.percentage}%"></div>
            </div>
            <div style="margin-top: 5px; font-size: 12px;">
                ${coverageReport.overall.branches.covered} / ${
      coverageReport.overall.branches.total
    }
            </div>
        </div>

        <div class="metric-card">
            <div class="metric-label">Function Coverage</div>
            <div class="metric-value coverage-${this.getCoverageClass(
              coverageReport.overall.functions.percentage
            )}">
                ${coverageReport.overall.functions.percentage.toFixed(1)}%
            </div>
            <div class="metric-bar">
                <div class="metric-bar-fill bar-${this.getCoverageClass(
                  coverageReport.overall.functions.percentage
                )}" 
                     style="width: ${coverageReport.overall.functions.percentage}%"></div>
            </div>
            <div style="margin-top: 5px; font-size: 12px;">
                ${coverageReport.overall.functions.covered} / ${
      coverageReport.overall.functions.total
    }
            </div>
        </div>

        <div class="metric-card">
            <div class="metric-label">Statement Coverage</div>
            <div class="metric-value coverage-${this.getCoverageClass(
              coverageReport.overall.statements.percentage
            )}">
                ${coverageReport.overall.statements.percentage.toFixed(1)}%
            </div>
            <div class="metric-bar">
                <div class="metric-bar-fill bar-${this.getCoverageClass(
                  coverageReport.overall.statements.percentage
                )}" 
                     style="width: ${coverageReport.overall.statements.percentage}%"></div>
            </div>
            <div style="margin-top: 5px; font-size: 12px;">
                ${coverageReport.overall.statements.covered} / ${
      coverageReport.overall.statements.total
    }
            </div>
        </div>
    </div>

    <div class="controls">
        <input type="text" id="searchInput" placeholder="Search files..." />
        <select id="sortBy">
            <option value="name">Sort by Name</option>
            <option value="coverage">Sort by Coverage</option>
            <option value="uncovered">Sort by Uncovered Lines</option>
        </select>
        <button id="exportJson">Export JSON</button>
        <button id="exportHtml">Export HTML</button>
        <button id="exportLcov">Export LCOV</button>
        <button id="showTrends">Show Trends</button>
        <button id="compareBtn">Compare Reports</button>
    </div>

    <div class="trend-chart" id="trendChart" style="display: none;">
        <h2>Coverage Trends</h2>
        <div class="trend-line" id="trendLine"></div>
    </div>

    <div class="comparison-view" id="comparisonView">
        <h2>Coverage Comparison</h2>
        <div class="comparison-grid" id="comparisonGrid"></div>
    </div>

    <div class="file-list" id="fileList"></div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let currentCoverage = ${JSON.stringify(coverageReport)};
        let coverageHistory = ${JSON.stringify(this.coverageHistory)};
        let filteredFiles = Object.entries(currentCoverage.files);

        // Initialize
        renderFiles();

        // Event listeners
        document.getElementById('searchInput').addEventListener('input', filterFiles);
        document.getElementById('sortBy').addEventListener('change', sortFiles);
        document.getElementById('exportJson').addEventListener('click', () => exportCoverage('json'));
        document.getElementById('exportHtml').addEventListener('click', () => exportCoverage('html'));
        document.getElementById('exportLcov').addEventListener('click', () => exportCoverage('lcov'));
        document.getElementById('showTrends').addEventListener('click', toggleTrends);
        document.getElementById('compareBtn').addEventListener('click', showCompareDialog);

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'updateCoverage':
                    currentCoverage = message.coverage;
                    coverageHistory = message.history;
                    filterFiles();
                    break;
                case 'showComparison':
                    showComparison(message.report1, message.report2);
                    break;
            }
        });

        function filterFiles() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            filteredFiles = Object.entries(currentCoverage.files).filter(([path]) => 
                path.toLowerCase().includes(searchTerm)
            );
            sortFiles();
        }

        function sortFiles() {
            const sortBy = document.getElementById('sortBy').value;

            filteredFiles.sort(([pathA, fileA], [pathB, fileB]) => {
                switch (sortBy) {
                    case 'name':
                        return pathA.localeCompare(pathB);
                    case 'coverage':
                        return fileB.metrics.lines.percentage - fileA.metrics.lines.percentage;
                    case 'uncovered':
                        const uncoveredA = fileA.metrics.lines.total - fileA.metrics.lines.covered;
                        const uncoveredB = fileB.metrics.lines.total - fileB.metrics.lines.covered;
                        return uncoveredB - uncoveredA;
                    default:
                        return 0;
                }
            });

            renderFiles();
        }

        function renderFiles() {
            const fileList = document.getElementById('fileList');
            fileList.innerHTML = '<h2>File Coverage</h2>';

            filteredFiles.forEach(([path, file]) => {
                const coverage = file.metrics.lines.percentage;
                const coverageClass = getCoverageClass(coverage);

                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = \`
                    <div class="file-header">
                        <div class="file-name">\${escapeHtml(path)}</div>
                        <div class="file-coverage coverage-\${coverageClass}">\${coverage.toFixed(1)}%</div>
                    </div>
                    <div class="file-metrics">
                        <div class="file-metric">
                            <div class="file-metric-label">Lines</div>
                            <div>\${file.metrics.lines.covered} / \${file.metrics.lines.total}</div>
                        </div>
                        <div class="file-metric">
                            <div class="file-metric-label">Branches</div>
                            <div>\${file.metrics.branches.covered} / \${file.metrics.branches.total}</div>
                        </div>
                        <div class="file-metric">
                            <div class="file-metric-label">Functions</div>
                            <div>\${file.metrics.functions.covered} / \${file.metrics.functions.total}</div>
                        </div>
                        <div class="file-metric">
                            <div class="file-metric-label">Statements</div>
                            <div>\${file.metrics.statements.covered} / \${file.metrics.statements.total}</div>
                        </div>
                    </div>
                \`;

                fileItem.addEventListener('click', () => navigateToFile(path));
                fileList.appendChild(fileItem);
            });
        }

        function toggleTrends() {
            const trendChart = document.getElementById('trendChart');
            const isVisible = trendChart.style.display !== 'none';
            
            if (isVisible) {
                trendChart.style.display = 'none';
            } else {
                trendChart.style.display = 'block';
                renderTrends();
            }
        }

        function renderTrends() {
            const trendLine = document.getElementById('trendLine');
            trendLine.innerHTML = '';

            coverageHistory.forEach((report, index) => {
                const percentage = report.overall.lines.percentage;
                const bar = document.createElement('div');
                bar.className = 'trend-bar';
                bar.style.height = percentage + '%';
                bar.title = \`\${new Date(report.timestamp).toLocaleDateString()}: \${percentage.toFixed(1)}%\`;
                
                const label = document.createElement('div');
                label.className = 'trend-label';
                label.textContent = new Date(report.timestamp).toLocaleDateString();
                bar.appendChild(label);
                
                trendLine.appendChild(bar);
            });
        }

        function showCompareDialog() {
            if (coverageHistory.length < 2) {
                alert('Need at least 2 coverage reports to compare');
                return;
            }

            // For simplicity, compare the last two reports
            const report1 = coverageHistory[coverageHistory.length - 2];
            const report2 = coverageHistory[coverageHistory.length - 1];
            vscode.postMessage({ 
                type: 'compareCoverage', 
                timestamp1: report1.timestamp, 
                timestamp2: report2.timestamp 
            });
        }

        function showComparison(report1, report2) {
            const comparisonView = document.getElementById('comparisonView');
            const comparisonGrid = document.getElementById('comparisonGrid');
            
            const diff = {
                lines: report2.overall.lines.percentage - report1.overall.lines.percentage,
                branches: report2.overall.branches.percentage - report1.overall.branches.percentage,
                functions: report2.overall.functions.percentage - report1.overall.functions.percentage,
                statements: report2.overall.statements.percentage - report1.overall.statements.percentage,
            };

            comparisonGrid.innerHTML = \`
                <div class="comparison-column">
                    <h3>Previous Report</h3>
                    <p>\${new Date(report1.timestamp).toLocaleString()}</p>
                    <div>Lines: \${report1.overall.lines.percentage.toFixed(1)}%</div>
                    <div>Branches: \${report1.overall.branches.percentage.toFixed(1)}%</div>
                    <div>Functions: \${report1.overall.functions.percentage.toFixed(1)}%</div>
                    <div>Statements: \${report1.overall.statements.percentage.toFixed(1)}%</div>
                </div>
                <div class="comparison-column">
                    <h3>Current Report</h3>
                    <p>\${new Date(report2.timestamp).toLocaleString()}</p>
                    <div>Lines: \${report2.overall.lines.percentage.toFixed(1)}% 
                        <span class="diff-\${diff.lines >= 0 ? 'positive' : 'negative'}">
                            (\${diff.lines >= 0 ? '+' : ''}\${diff.lines.toFixed(1)}%)
                        </span>
                    </div>
                    <div>Branches: \${report2.overall.branches.percentage.toFixed(1)}% 
                        <span class="diff-\${diff.branches >= 0 ? 'positive' : 'negative'}">
                            (\${diff.branches >= 0 ? '+' : ''}\${diff.branches.toFixed(1)}%)
                        </span>
                    </div>
                    <div>Functions: \${report2.overall.functions.percentage.toFixed(1)}% 
                        <span class="diff-\${diff.functions >= 0 ? 'positive' : 'negative'}">
                            (\${diff.functions >= 0 ? '+' : ''}\${diff.functions.toFixed(1)}%)
                        </span>
                    </div>
                    <div>Statements: \${report2.overall.statements.percentage.toFixed(1)}% 
                        <span class="diff-\${diff.statements >= 0 ? 'positive' : 'negative'}">
                            (\${diff.statements >= 0 ? '+' : ''}\${diff.statements.toFixed(1)}%)
                        </span>
                    </div>
                </div>
            \`;

            comparisonView.style.display = 'block';
        }

        function navigateToFile(filePath) {
            vscode.postMessage({ type: 'navigateToFile', filePath });
        }

        function exportCoverage(format) {
            vscode.postMessage({ type: 'exportCoverage', format });
        }

        function getCoverageClass(percentage) {
            if (percentage >= 80) return 'high';
            if (percentage >= 60) return 'medium';
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
   * Get coverage class based on percentage
   */
  private getCoverageClass(percentage: number): string {
    if (percentage >= 80) return 'high';
    if (percentage >= 60) return 'medium';
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
