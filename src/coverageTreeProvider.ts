/**
 * CoverageTreeProvider - Display coverage information
 *
 * Implements vscode.TreeDataProvider to show coverage organized by files and functions
 */

import * as vscode from 'vscode';
import { MCPTestingClient, CoverageReport } from './mcpClient';

/**
 * File coverage details
 */
interface FileCoverage {
  path: string;
  metrics: {
    lines: { total: number; covered: number; percentage: number };
    branches: { total: number; covered: number; percentage: number };
    functions: { total: number; covered: number; percentage: number };
    statements: { total: number; covered: number; percentage: number };
  };
  lines: Record<number, { line: number; hits: number; covered: boolean }>;
  functions: Array<{ name: string; line: number; hits: number; covered: boolean }>;
}

/**
 * Tree item types
 */
type TreeItemType = 'summary' | 'file' | 'function' | 'uncoveredLine';

/**
 * Tree item data
 */
interface TreeItemData {
  type: TreeItemType;
  file?: FileCoverage;
  functionInfo?: { name: string; line: number; hits: number; covered: boolean };
  line?: number;
  filePath?: string;
}

/**
 * CoverageTreeProvider
 *
 * Displays coverage organized by files and functions with color-coding
 */
export class CoverageTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private coverage: CoverageReport | null = null;
  private readonly treeItemData = new WeakMap<vscode.TreeItem, TreeItemData>();
  private showOnlyUncovered = false;

  constructor(
    private readonly mcpClient: MCPTestingClient,
    private readonly outputChannel: vscode.LogOutputChannel
  ) {
    // Listen to coverage updates
    this.mcpClient.onCoverageUpdated((coverage) => {
      this.coverage = coverage;
      this.refresh();
    });
  }

  /**
   * Get tree item
   */
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children of tree item
   */
  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!this.coverage) {
      return [this.createNoCoverageItem()];
    }

    if (!element) {
      // Root level - show summary and files
      return this.getRootItems();
    }

    const data = this.treeItemData.get(element);
    if (!data) {
      return [];
    }

    switch (data.type) {
      case 'summary':
        return [];
      case 'file':
        return this.getFileChildren(data.file!);
      case 'function':
      case 'uncoveredLine':
        return [];
      default:
        return [];
    }
  }

  /**
   * Create "no coverage" item
   */
  private createNoCoverageItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(
      'No coverage data available',
      vscode.TreeItemCollapsibleState.None
    );
    item.iconPath = new vscode.ThemeIcon('info');
    item.tooltip = 'Run tests with coverage to see coverage information';
    return item;
  }

  /**
   * Get root items (summary + files)
   */
  private getRootItems(): vscode.TreeItem[] {
    const items: vscode.TreeItem[] = [];

    // Add summary item
    items.push(this.createSummaryItem());

    // Add file items
    const files = Object.entries(this.coverage!.files);

    // Sort files by coverage percentage (lowest first)
    files.sort((a, b) => {
      const aPercentage = a[1].metrics.lines.percentage;
      const bPercentage = b[1].metrics.lines.percentage;
      return aPercentage - bPercentage;
    });

    for (const [path, fileCoverage] of files) {
      // Filter by uncovered if enabled
      if (this.showOnlyUncovered && fileCoverage.metrics.lines.percentage === 100) {
        continue;
      }

      items.push(this.createFileItem(path, fileCoverage));
    }

    return items;
  }

  /**
   * Create summary item
   */
  private createSummaryItem(): vscode.TreeItem {
    const overall = this.coverage!.overall;
    const label = `Overall Coverage: ${overall.lines.percentage.toFixed(1)}%`;

    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon('graph', this.getCoverageColor(overall.lines.percentage));

    // Set tooltip
    item.tooltip = new vscode.MarkdownString();
    item.tooltip.appendMarkdown(`**Overall Coverage**\n\n`);
    item.tooltip.appendMarkdown(
      `- Lines: ${overall.lines.covered}/${overall.lines.total} (${overall.lines.percentage.toFixed(
        1
      )}%)\n`
    );
    item.tooltip.appendMarkdown(
      `- Branches: ${overall.branches.covered}/${
        overall.branches.total
      } (${overall.branches.percentage.toFixed(1)}%)\n`
    );
    item.tooltip.appendMarkdown(
      `- Functions: ${overall.functions.covered}/${
        overall.functions.total
      } (${overall.functions.percentage.toFixed(1)}%)\n`
    );
    item.tooltip.appendMarkdown(
      `- Statements: ${overall.statements.covered}/${
        overall.statements.total
      } (${overall.statements.percentage.toFixed(1)}%)\n`
    );

    item.contextValue = 'coverageSummary';

    this.treeItemData.set(item, {
      type: 'summary',
    });

    return item;
  }

  /**
   * Create file item
   */
  private createFileItem(path: string, fileCoverage: FileCoverage): vscode.TreeItem {
    const fileName = path.split('/').pop() || path;
    const percentage = fileCoverage.metrics.lines.percentage;
    const label = `${fileName} (${percentage.toFixed(1)}%)`;

    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
    item.iconPath = new vscode.ThemeIcon('file', this.getCoverageColor(percentage));
    item.description = path;

    // Set tooltip
    item.tooltip = new vscode.MarkdownString();
    item.tooltip.appendMarkdown(`**${fileName}**\n\n`);
    item.tooltip.appendMarkdown(
      `- Lines: ${fileCoverage.metrics.lines.covered}/${
        fileCoverage.metrics.lines.total
      } (${percentage.toFixed(1)}%)\n`
    );
    item.tooltip.appendMarkdown(
      `- Branches: ${fileCoverage.metrics.branches.covered}/${
        fileCoverage.metrics.branches.total
      } (${fileCoverage.metrics.branches.percentage.toFixed(1)}%)\n`
    );
    item.tooltip.appendMarkdown(
      `- Functions: ${fileCoverage.metrics.functions.covered}/${
        fileCoverage.metrics.functions.total
      } (${fileCoverage.metrics.functions.percentage.toFixed(1)}%)\n`
    );

    // Set command to open file
    item.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [vscode.Uri.file(path)],
    };

    item.contextValue = 'coverageFile';

    this.treeItemData.set(item, {
      type: 'file',
      file: fileCoverage,
      filePath: path,
    });

    return item;
  }

  /**
   * Get children for a file
   */
  private getFileChildren(file: FileCoverage): vscode.TreeItem[] {
    const items: vscode.TreeItem[] = [];

    // Add functions
    const functions = file.functions || [];
    for (const func of functions) {
      // Filter by uncovered if enabled
      if (this.showOnlyUncovered && func.covered) {
        continue;
      }

      items.push(this.createFunctionItem(func, file.path));
    }

    // Add uncovered lines if showing only uncovered
    if (this.showOnlyUncovered) {
      const uncoveredLines = Object.values(file.lines || {}).filter((line) => !line.covered);
      for (const line of uncoveredLines) {
        items.push(this.createUncoveredLineItem(line, file.path));
      }
    }

    return items;
  }

  /**
   * Create function item
   */
  private createFunctionItem(
    func: { name: string; line: number; hits: number; covered: boolean },
    filePath: string
  ): vscode.TreeItem {
    const label = `${func.name} (${func.hits} hits)`;

    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);

    // Set icon based on coverage
    if (func.covered) {
      item.iconPath = new vscode.ThemeIcon(
        'symbol-method',
        new vscode.ThemeColor('testing.iconPassed')
      );
    } else {
      item.iconPath = new vscode.ThemeIcon(
        'symbol-method',
        new vscode.ThemeColor('testing.iconFailed')
      );
    }

    item.description = `Line ${func.line}`;

    // Set tooltip
    item.tooltip = new vscode.MarkdownString();
    item.tooltip.appendMarkdown(`**${func.name}**\n\n`);
    item.tooltip.appendMarkdown(`- Line: ${func.line}\n`);
    item.tooltip.appendMarkdown(`- Hits: ${func.hits}\n`);
    item.tooltip.appendMarkdown(`- Covered: ${func.covered ? 'Yes' : 'No'}\n`);

    // Set command to navigate to function
    item.command = {
      command: 'vscode.open',
      title: 'Go to Function',
      arguments: [
        vscode.Uri.file(filePath),
        {
          selection: new vscode.Range(
            new vscode.Position(func.line - 1, 0),
            new vscode.Position(func.line - 1, 0)
          ),
        },
      ],
    };

    item.contextValue = 'coverageFunction';

    this.treeItemData.set(item, {
      type: 'function',
      functionInfo: func,
      filePath,
    });

    return item;
  }

  /**
   * Create uncovered line item
   */
  private createUncoveredLineItem(
    line: { line: number; hits: number; covered: boolean },
    filePath: string
  ): vscode.TreeItem {
    const label = `Line ${line.line} (uncovered)`;

    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon(
      'circle-outline',
      new vscode.ThemeColor('testing.iconFailed')
    );

    // Set command to navigate to line
    item.command = {
      command: 'vscode.open',
      title: 'Go to Line',
      arguments: [
        vscode.Uri.file(filePath),
        {
          selection: new vscode.Range(
            new vscode.Position(line.line - 1, 0),
            new vscode.Position(line.line - 1, 0)
          ),
        },
      ],
    };

    item.contextValue = 'coverageUncoveredLine';

    this.treeItemData.set(item, {
      type: 'uncoveredLine',
      line: line.line,
      filePath,
    });

    return item;
  }

  /**
   * Get coverage color based on percentage
   */
  private getCoverageColor(percentage: number): vscode.ThemeColor {
    if (percentage >= 80) {
      return new vscode.ThemeColor('testing.iconPassed');
    } else if (percentage >= 50) {
      return new vscode.ThemeColor('testing.iconQueued');
    } else {
      return new vscode.ThemeColor('testing.iconFailed');
    }
  }

  /**
   * Toggle show only uncovered
   */
  toggleShowOnlyUncovered(): void {
    this.showOnlyUncovered = !this.showOnlyUncovered;
    this.refresh();
  }

  /**
   * Navigate to uncovered code
   */
  async navigateToUncovered(): Promise<void> {
    if (!this.coverage) {
      vscode.window.showInformationMessage('No coverage data available');
      return;
    }

    // Find first uncovered line
    for (const [path, file] of Object.entries(this.coverage.files)) {
      const uncoveredLines = Object.values(file.lines || {}).filter((line) => !line.covered);
      if (uncoveredLines.length > 0) {
        const firstUncovered = uncoveredLines[0];
        await vscode.window.showTextDocument(vscode.Uri.file(path), {
          selection: new vscode.Range(
            new vscode.Position(firstUncovered.line - 1, 0),
            new vscode.Position(firstUncovered.line - 1, 0)
          ),
        });
        return;
      }
    }

    vscode.window.showInformationMessage('No uncovered code found');
  }

  /**
   * Generate tests for uncovered code
   */
  async generateTestsForUncovered(filePath: string): Promise<void> {
    try {
      const tests = await this.mcpClient.generateTests(filePath);
      vscode.window.showInformationMessage(`Generated ${tests.length} tests for ${filePath}`);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to generate tests: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Refresh tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
