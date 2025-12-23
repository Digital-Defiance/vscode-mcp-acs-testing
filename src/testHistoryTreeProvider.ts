/**
 * TestHistoryTreeProvider - Display test run history
 *
 * Implements vscode.TreeDataProvider to show test run history grouped by time
 */

import * as vscode from 'vscode';
import { MCPTestingClient, TestResult } from './mcpClient';

/**
 * Test run history entry
 */
export interface TestRunHistory {
  id: string;
  timestamp: Date;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  tests: TestResult[];
}

/**
 * Tree item types
 */
type TreeItemType = 'timeGroup' | 'run' | 'test';

/**
 * Tree item data
 */
interface TreeItemData {
  type: TreeItemType;
  timeGroup?: string;
  run?: TestRunHistory;
  test?: TestResult;
}

/**
 * TestHistoryTreeProvider
 *
 * Displays test run history grouped by time with pass/fail statistics
 */
export class TestHistoryTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private history: TestRunHistory[] = [];
  private readonly treeItemData = new WeakMap<vscode.TreeItem, TreeItemData>();

  constructor(
    private readonly mcpClient: MCPTestingClient,
    private readonly outputChannel: vscode.LogOutputChannel
  ) {
    // Listen to test completion events to update history
    this.mcpClient.onTestCompleted(() => {
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
    if (!element) {
      // Root level - show time groups
      return this.getTimeGroups();
    }

    const data = this.treeItemData.get(element);
    if (!data) {
      return [];
    }

    switch (data.type) {
      case 'timeGroup':
        return this.getRunsForTimeGroup(data.timeGroup!);
      case 'run':
        return this.getTestsForRun(data.run!);
      case 'test':
        return [];
      default:
        return [];
    }
  }

  /**
   * Get time groups (Today, Yesterday, This Week, etc.)
   */
  private getTimeGroups(): vscode.TreeItem[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    const groups = new Map<string, TestRunHistory[]>();
    groups.set('Today', []);
    groups.set('Yesterday', []);
    groups.set('This Week', []);
    groups.set('Older', []);

    // Group history by time
    for (const run of this.history) {
      const runDate = new Date(run.timestamp);
      if (runDate >= today) {
        groups.get('Today')!.push(run);
      } else if (runDate >= yesterday) {
        groups.get('Yesterday')!.push(run);
      } else if (runDate >= thisWeek) {
        groups.get('This Week')!.push(run);
      } else {
        groups.get('Older')!.push(run);
      }
    }

    // Create tree items for non-empty groups
    const items: vscode.TreeItem[] = [];
    for (const [groupName, runs] of groups) {
      if (runs.length > 0) {
        const item = new vscode.TreeItem(
          `${groupName} (${runs.length})`,
          vscode.TreeItemCollapsibleState.Collapsed
        );
        item.iconPath = new vscode.ThemeIcon('history');
        item.contextValue = 'timeGroup';

        this.treeItemData.set(item, {
          type: 'timeGroup',
          timeGroup: groupName,
        });

        items.push(item);
      }
    }

    return items;
  }

  /**
   * Get runs for a time group
   */
  private getRunsForTimeGroup(timeGroup: string): vscode.TreeItem[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    // Filter runs by time group
    const runs = this.history.filter((run) => {
      const runDate = new Date(run.timestamp);
      switch (timeGroup) {
        case 'Today':
          return runDate >= today;
        case 'Yesterday':
          return runDate >= yesterday && runDate < today;
        case 'This Week':
          return runDate >= thisWeek && runDate < yesterday;
        case 'Older':
          return runDate < thisWeek;
        default:
          return false;
      }
    });

    // Create tree items for runs
    return runs.map((run) => this.createRunTreeItem(run));
  }

  /**
   * Create tree item for a test run
   */
  private createRunTreeItem(run: TestRunHistory): vscode.TreeItem {
    const time = run.timestamp.toLocaleTimeString();
    const passRate = run.totalTests > 0 ? Math.round((run.passed / run.totalTests) * 100) : 0;
    const label = `${time} - ${run.passed}/${run.totalTests} passed (${passRate}%)`;

    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);

    // Set icon based on pass rate
    if (run.failed === 0) {
      item.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
    } else if (run.passed === 0) {
      item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
    } else {
      item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('testing.iconQueued'));
    }

    // Set description
    item.description = `${run.duration}ms`;

    // Set tooltip
    item.tooltip = new vscode.MarkdownString();
    item.tooltip.appendMarkdown(`**Test Run**\n\n`);
    item.tooltip.appendMarkdown(`- Time: ${run.timestamp.toLocaleString()}\n`);
    item.tooltip.appendMarkdown(`- Total: ${run.totalTests}\n`);
    item.tooltip.appendMarkdown(`- Passed: ${run.passed}\n`);
    item.tooltip.appendMarkdown(`- Failed: ${run.failed}\n`);
    item.tooltip.appendMarkdown(`- Skipped: ${run.skipped}\n`);
    item.tooltip.appendMarkdown(`- Duration: ${run.duration}ms\n`);

    item.contextValue = 'testRun';

    this.treeItemData.set(item, {
      type: 'run',
      run,
    });

    return item;
  }

  /**
   * Get tests for a run
   */
  private getTestsForRun(run: TestRunHistory): vscode.TreeItem[] {
    return run.tests.map((test) => this.createTestTreeItem(test));
  }

  /**
   * Create tree item for a test
   */
  private createTestTreeItem(test: TestResult): vscode.TreeItem {
    const item = new vscode.TreeItem(test.name, vscode.TreeItemCollapsibleState.None);

    // Set icon based on status
    switch (test.status) {
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
      default:
        item.iconPath = new vscode.ThemeIcon('circle-outline');
        break;
    }

    // Set description
    item.description = `${test.duration}ms`;

    // Set tooltip
    item.tooltip = new vscode.MarkdownString();
    item.tooltip.appendMarkdown(`**${test.name}**\n\n`);
    item.tooltip.appendMarkdown(`- Status: ${test.status}\n`);
    item.tooltip.appendMarkdown(`- Duration: ${test.duration}ms\n`);
    item.tooltip.appendMarkdown(`- File: ${test.file}\n`);
    if (test.error) {
      item.tooltip.appendMarkdown(`\n**Error:**\n\`\`\`\n${test.error.message}\n\`\`\`\n`);
    }

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

    item.contextValue = 'historyTest';

    this.treeItemData.set(item, {
      type: 'test',
      test,
    });

    return item;
  }

  /**
   * Add test run to history
   */
  addTestRun(tests: TestResult[]): void {
    const passed = tests.filter((t) => t.status === 'passed').length;
    const failed = tests.filter((t) => t.status === 'failed').length;
    const skipped = tests.filter((t) => t.status === 'skipped').length;
    const duration = tests.reduce((sum, t) => sum + t.duration, 0);

    const run: TestRunHistory = {
      id: `run-${Date.now()}`,
      timestamp: new Date(),
      totalTests: tests.length,
      passed,
      failed,
      skipped,
      duration,
      tests,
    };

    this.history.unshift(run);

    // Keep only last 100 runs
    if (this.history.length > 100) {
      this.history = this.history.slice(0, 100);
    }

    this.refresh();
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.refresh();
  }

  /**
   * Export history
   */
  exportHistory(): TestRunHistory[] {
    return [...this.history];
  }

  /**
   * Compare two runs
   */
  compareRuns(run1Id: string, run2Id: string): void {
    const run1 = this.history.find((r) => r.id === run1Id);
    const run2 = this.history.find((r) => r.id === run2Id);

    if (!run1 || !run2) {
      vscode.window.showErrorMessage('Could not find runs to compare');
      return;
    }

    // Create comparison report
    const report = this.createComparisonReport(run1, run2);

    // Show in new document
    vscode.workspace
      .openTextDocument({
        content: report,
        language: 'markdown',
      })
      .then((doc) => {
        vscode.window.showTextDocument(doc);
      });
  }

  /**
   * Create comparison report
   */
  private createComparisonReport(run1: TestRunHistory, run2: TestRunHistory): string {
    const lines: string[] = [];

    lines.push('# Test Run Comparison\n');
    lines.push(`## Run 1: ${run1.timestamp.toLocaleString()}\n`);
    lines.push(`- Total: ${run1.totalTests}`);
    lines.push(`- Passed: ${run1.passed}`);
    lines.push(`- Failed: ${run1.failed}`);
    lines.push(`- Skipped: ${run1.skipped}`);
    lines.push(`- Duration: ${run1.duration}ms\n`);

    lines.push(`## Run 2: ${run2.timestamp.toLocaleString()}\n`);
    lines.push(`- Total: ${run2.totalTests}`);
    lines.push(`- Passed: ${run2.passed}`);
    lines.push(`- Failed: ${run2.failed}`);
    lines.push(`- Skipped: ${run2.skipped}`);
    lines.push(`- Duration: ${run2.duration}ms\n`);

    lines.push('## Differences\n');
    lines.push(`- Total Tests: ${run2.totalTests - run1.totalTests}`);
    lines.push(`- Passed: ${run2.passed - run1.passed}`);
    lines.push(`- Failed: ${run2.failed - run1.failed}`);
    lines.push(`- Skipped: ${run2.skipped - run1.skipped}`);
    lines.push(`- Duration: ${run2.duration - run1.duration}ms\n`);

    // Find tests that changed status
    const run1TestsById = new Map(run1.tests.map((t) => [t.id, t]));
    const run2TestsById = new Map(run2.tests.map((t) => [t.id, t]));

    const statusChanges: string[] = [];
    for (const [id, test2] of run2TestsById) {
      const test1 = run1TestsById.get(id);
      if (test1 && test1.status !== test2.status) {
        statusChanges.push(`- ${test2.name}: ${test1.status} → ${test2.status}`);
      }
    }

    if (statusChanges.length > 0) {
      lines.push('## Status Changes\n');
      lines.push(...statusChanges);
    }

    return lines.join('\n');
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
