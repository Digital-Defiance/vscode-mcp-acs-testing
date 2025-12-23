/**
 * FlakyTestsTreeProvider - Display flaky tests
 *
 * Implements vscode.TreeDataProvider to show flaky tests grouped by severity
 */

import * as vscode from 'vscode';
import { MCPTestingClient } from './mcpClient';

/**
 * Flaky test information
 */
export interface FlakyTest {
  testId: string;
  testName: string;
  file: string;
  line: number;
  failureRate: number;
  totalRuns: number;
  failures: number;
  causes: Array<{
    type: 'timing' | 'external-dependency' | 'race-condition' | 'random-data' | 'unknown';
    confidence: number;
    description: string;
  }>;
  history: Array<{
    timestamp: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    error?: { message: string; stack: string };
  }>;
}

/**
 * Flaky fix suggestion
 */
interface FlakinessFix {
  type: string;
  description: string;
  code?: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Tree item types
 */
type TreeItemType = 'severityGroup' | 'flakyTest' | 'cause' | 'fix' | 'history';

/**
 * Tree item data
 */
interface TreeItemData {
  type: TreeItemType;
  severity?: 'high' | 'medium' | 'low';
  flakyTest?: FlakyTest;
  cause?: FlakyTest['causes'][0];
  fix?: FlakinessFix;
  historyEntry?: FlakyTest['history'][0];
}

/**
 * FlakyTestsTreeProvider
 *
 * Displays flaky tests grouped by severity with failure patterns and suggested fixes
 */
export class FlakyTestsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private flakyTests: FlakyTest[] = [];
  private readonly treeItemData = new WeakMap<vscode.TreeItem, TreeItemData>();
  private fixes = new Map<string, FlakinessFix[]>();

  constructor(
    private readonly mcpClient: MCPTestingClient,
    private readonly outputChannel: vscode.LogOutputChannel
  ) {}

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
    if (!element) {
      // Root level - show severity groups
      return this.getSeverityGroups();
    }

    const data = this.treeItemData.get(element);
    if (!data) {
      return [];
    }

    switch (data.type) {
      case 'severityGroup':
        return this.getTestsForSeverity(data.severity!);
      case 'flakyTest':
        return this.getFlakyTestChildren(data.flakyTest!);
      case 'cause':
      case 'fix':
      case 'history':
        return [];
      default:
        return [];
    }
  }

  /**
   * Get severity groups
   */
  private getSeverityGroups(): vscode.TreeItem[] {
    if (this.flakyTests.length === 0) {
      const item = new vscode.TreeItem(
        'No flaky tests detected',
        vscode.TreeItemCollapsibleState.None
      );
      item.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
      item.tooltip = 'Run flaky test detection to identify unreliable tests';
      return [item];
    }

    const groups = new Map<'high' | 'medium' | 'low', FlakyTest[]>();
    groups.set('high', []);
    groups.set('medium', []);
    groups.set('low', []);

    // Group tests by severity
    for (const test of this.flakyTests) {
      const severity = this.getSeverity(test.failureRate);
      groups.get(severity)!.push(test);
    }

    // Create tree items for non-empty groups
    const items: vscode.TreeItem[] = [];
    const severityOrder: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];

    for (const severity of severityOrder) {
      const tests = groups.get(severity)!;
      if (tests.length > 0) {
        items.push(this.createSeverityGroupItem(severity, tests));
      }
    }

    return items;
  }

  /**
   * Create severity group item
   */
  private createSeverityGroupItem(
    severity: 'high' | 'medium' | 'low',
    tests: FlakyTest[]
  ): vscode.TreeItem {
    const label = `${severity.charAt(0).toUpperCase() + severity.slice(1)} Severity (${
      tests.length
    })`;

    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);

    // Set icon based on severity
    switch (severity) {
      case 'high':
        item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
        break;
      case 'medium':
        item.iconPath = new vscode.ThemeIcon(
          'warning',
          new vscode.ThemeColor('testing.iconQueued')
        );
        break;
      case 'low':
        item.iconPath = new vscode.ThemeIcon('info', new vscode.ThemeColor('testing.iconSkipped'));
        break;
    }

    item.contextValue = 'flakySeverityGroup';

    this.treeItemData.set(item, {
      type: 'severityGroup',
      severity,
    });

    return item;
  }

  /**
   * Get tests for severity
   */
  private getTestsForSeverity(severity: 'high' | 'medium' | 'low'): vscode.TreeItem[] {
    return this.flakyTests
      .filter((test) => this.getSeverity(test.failureRate) === severity)
      .map((test) => this.createFlakyTestItem(test));
  }

  /**
   * Create flaky test item
   */
  private createFlakyTestItem(test: FlakyTest): vscode.TreeItem {
    const label = `${test.testName} (${(test.failureRate * 100).toFixed(1)}% failure rate)`;

    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);

    // Set icon based on severity
    const severity = this.getSeverity(test.failureRate);
    switch (severity) {
      case 'high':
        item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
        break;
      case 'medium':
        item.iconPath = new vscode.ThemeIcon(
          'warning',
          new vscode.ThemeColor('testing.iconQueued')
        );
        break;
      case 'low':
        item.iconPath = new vscode.ThemeIcon('info', new vscode.ThemeColor('testing.iconSkipped'));
        break;
    }

    item.description = `${test.failures}/${test.totalRuns} failed`;

    // Set tooltip
    item.tooltip = new vscode.MarkdownString();
    item.tooltip.appendMarkdown(`**${test.testName}**\n\n`);
    item.tooltip.appendMarkdown(`- Failure Rate: ${(test.failureRate * 100).toFixed(1)}%\n`);
    item.tooltip.appendMarkdown(`- Total Runs: ${test.totalRuns}\n`);
    item.tooltip.appendMarkdown(`- Failures: ${test.failures}\n`);
    item.tooltip.appendMarkdown(`- File: ${test.file}:${test.line}\n`);

    // Set command to navigate to test
    item.command = {
      command: 'vscode.open',
      title: 'Open Test',
      arguments: [
        vscode.Uri.file(test.file),
        {
          selection: new vscode.Range(
            new vscode.Position(test.line - 1, 0),
            new vscode.Position(test.line - 1, 0)
          ),
        },
      ],
    };

    item.contextValue = 'flakyTest';

    this.treeItemData.set(item, {
      type: 'flakyTest',
      flakyTest: test,
    });

    return item;
  }

  /**
   * Get children for flaky test
   */
  private getFlakyTestChildren(test: FlakyTest): vscode.TreeItem[] {
    const items: vscode.TreeItem[] = [];

    // Add causes section
    if (test.causes.length > 0) {
      const causesHeader = new vscode.TreeItem(
        'Potential Causes',
        vscode.TreeItemCollapsibleState.Expanded
      );
      causesHeader.iconPath = new vscode.ThemeIcon('search');
      items.push(causesHeader);

      for (const cause of test.causes) {
        items.push(this.createCauseItem(cause));
      }
    }

    // Add fixes section
    const fixes = this.fixes.get(test.testId) || [];
    if (fixes.length > 0) {
      const fixesHeader = new vscode.TreeItem(
        'Suggested Fixes',
        vscode.TreeItemCollapsibleState.Expanded
      );
      fixesHeader.iconPath = new vscode.ThemeIcon('lightbulb');
      items.push(fixesHeader);

      for (const fix of fixes) {
        items.push(this.createFixItem(fix, test));
      }
    }

    // Add history section (last 5 runs)
    if (test.history.length > 0) {
      const historyHeader = new vscode.TreeItem(
        'Recent History',
        vscode.TreeItemCollapsibleState.Collapsed
      );
      historyHeader.iconPath = new vscode.ThemeIcon('history');
      items.push(historyHeader);

      const recentHistory = test.history.slice(0, 5);
      for (const entry of recentHistory) {
        items.push(this.createHistoryItem(entry));
      }
    }

    return items;
  }

  /**
   * Create cause item
   */
  private createCauseItem(cause: FlakyTest['causes'][0]): vscode.TreeItem {
    const label = `${cause.type} (${(cause.confidence * 100).toFixed(0)}% confidence)`;

    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon('symbol-event');
    item.description = cause.description;

    item.tooltip = new vscode.MarkdownString();
    item.tooltip.appendMarkdown(`**${cause.type}**\n\n`);
    item.tooltip.appendMarkdown(`${cause.description}\n\n`);
    item.tooltip.appendMarkdown(`Confidence: ${(cause.confidence * 100).toFixed(0)}%\n`);

    item.contextValue = 'flakyCause';

    this.treeItemData.set(item, {
      type: 'cause',
      cause,
    });

    return item;
  }

  /**
   * Create fix item
   */
  private createFixItem(fix: FlakinessFix, test: FlakyTest): vscode.TreeItem {
    const label = `${fix.type} (${fix.priority} priority)`;

    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);

    // Set icon based on priority
    switch (fix.priority) {
      case 'high':
        item.iconPath = new vscode.ThemeIcon('star-full');
        break;
      case 'medium':
        item.iconPath = new vscode.ThemeIcon('star-half');
        break;
      case 'low':
        item.iconPath = new vscode.ThemeIcon('star-empty');
        break;
    }

    item.description = fix.description;

    item.tooltip = new vscode.MarkdownString();
    item.tooltip.appendMarkdown(`**${fix.type}**\n\n`);
    item.tooltip.appendMarkdown(`${fix.description}\n\n`);
    item.tooltip.appendMarkdown(`Priority: ${fix.priority}\n`);
    if (fix.code) {
      item.tooltip.appendMarkdown(`\n\`\`\`typescript\n${fix.code}\n\`\`\`\n`);
    }

    // Set command to apply fix
    if (fix.code) {
      item.command = {
        command: 'mcp-testing.applyFix',
        title: 'Apply Fix',
        arguments: [test, fix],
      };
    }

    item.contextValue = 'flakyFix';

    this.treeItemData.set(item, {
      type: 'fix',
      fix,
    });

    return item;
  }

  /**
   * Create history item
   */
  private createHistoryItem(entry: FlakyTest['history'][0]): vscode.TreeItem {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const label = `${time} - ${entry.status} (${entry.duration}ms)`;

    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);

    // Set icon based on status
    switch (entry.status) {
      case 'passed':
        item.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
        break;
      case 'failed':
        item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
        break;
      case 'skipped':
        item.iconPath = new vscode.ThemeIcon(
          'circle-slash',
          new vscode.ThemeColor('testing.iconSkipped')
        );
        break;
    }

    if (entry.error) {
      item.tooltip = new vscode.MarkdownString();
      item.tooltip.appendMarkdown(`**Error:**\n\`\`\`\n${entry.error.message}\n\`\`\`\n`);
    }

    item.contextValue = 'flakyHistory';

    this.treeItemData.set(item, {
      type: 'history',
      historyEntry: entry,
    });

    return item;
  }

  /**
   * Get severity based on failure rate
   */
  private getSeverity(failureRate: number): 'high' | 'medium' | 'low' {
    if (failureRate >= 0.3) {
      return 'high';
    } else if (failureRate >= 0.1) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Detect flaky tests
   */
  async detectFlakyTests(iterations: number = 10): Promise<void> {
    try {
      this.outputChannel.info(`Detecting flaky tests with ${iterations} iterations...`);
      const flakyTests = await this.mcpClient.detectFlakyTests({ iterations });
      this.flakyTests = flakyTests;

      // Load fixes for each flaky test
      for (const test of flakyTests) {
        // In a real implementation, this would call the MCP server
        // For now, we'll generate some example fixes
        this.fixes.set(test.testId, this.generateExampleFixes(test));
      }

      this.refresh();
      this.outputChannel.info(`Found ${flakyTests.length} flaky tests`);
    } catch (error) {
      this.outputChannel.error(
        `Failed to detect flaky tests: ${error instanceof Error ? error.message : String(error)}`
      );
      vscode.window.showErrorMessage(`Failed to detect flaky tests: ${error}`);
    }
  }

  /**
   * Generate example fixes (placeholder)
   */
  private generateExampleFixes(test: FlakyTest): FlakinessFix[] {
    const fixes: FlakinessFix[] = [];

    // Check for timing issues
    const timingCause = test.causes.find((c) => c.type === 'timing');
    if (timingCause) {
      fixes.push({
        type: 'Add wait/delay',
        description: 'Add explicit wait for async operations to complete',
        code: 'await waitFor(() => expect(element).toBeVisible(), { timeout: 5000 });',
        priority: 'high',
      });
    }

    // Check for race conditions
    const raceCause = test.causes.find((c) => c.type === 'race-condition');
    if (raceCause) {
      fixes.push({
        type: 'Use proper synchronization',
        description: 'Use locks or promises to synchronize concurrent operations',
        code: 'await Promise.all([operation1(), operation2()]);',
        priority: 'high',
      });
    }

    // Check for external dependencies
    const externalCause = test.causes.find((c) => c.type === 'external-dependency');
    if (externalCause) {
      fixes.push({
        type: 'Mock external dependencies',
        description: 'Mock external services to make tests deterministic',
        code: 'jest.mock("./externalService", () => ({ fetch: jest.fn() }));',
        priority: 'medium',
      });
    }

    // Check for random data
    const randomCause = test.causes.find((c) => c.type === 'random-data');
    if (randomCause) {
      fixes.push({
        type: 'Use fixed test data',
        description: 'Replace random data with fixed test fixtures',
        code: 'const testData = { id: 1, name: "Test User" };',
        priority: 'medium',
      });
    }

    return fixes;
  }

  /**
   * Analyze flaky test
   */
  async analyzeFlakyTest(testId: string): Promise<void> {
    try {
      const analysis = await this.mcpClient.analyzeFailure(testId);
      // Show analysis in a new document or webview
      vscode.window.showInformationMessage(`Analysis complete for test ${testId}`);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to analyze test: ${error instanceof Error ? error.message : String(error)}`
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
