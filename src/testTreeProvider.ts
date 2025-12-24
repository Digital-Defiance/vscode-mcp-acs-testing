/**
 * Test Tree Provider - Shows discovered tests in a tree view
 */

import * as vscode from 'vscode';
import { MCPTestingClient, TestResult } from './mcpClient';

interface TestTreeItem {
  type: 'file' | 'suite' | 'test';
  label: string;
  test?: TestResult;
  children?: TestTreeItem[];
}

export class TestTreeProvider implements vscode.TreeDataProvider<TestTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TestTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private tests: TestResult[] = [];
  private treeItems: TestTreeItem[] = [];

  constructor(
    private readonly mcpClient: MCPTestingClient,
    private readonly outputChannel: vscode.LogOutputChannel
  ) {
    this.refresh();
  }

  async refresh(): Promise<void> {
    try {
      this.tests = await this.mcpClient.listTests();
      this.outputChannel.info(`TestTreeProvider: Loaded ${this.tests.length} tests`);
      this.treeItems = this.buildTree(this.tests);
      this._onDidChangeTreeData.fire();
    } catch (error) {
      this.outputChannel.error(
        `Failed to refresh tests: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private buildTree(tests: TestResult[]): TestTreeItem[] {
    const fileMap = new Map<string, TestTreeItem>();

    for (const test of tests) {
      const fileName = test.file.split('/').pop() || test.file;

      if (!fileMap.has(test.file)) {
        fileMap.set(test.file, {
          type: 'file',
          label: fileName,
          children: [],
        });
      }

      const fileItem = fileMap.get(test.file)!;

      // Add test to file
      fileItem.children!.push({
        type: 'test',
        label: test.name,
        test,
      });
    }

    return Array.from(fileMap.values());
  }

  getTreeItem(element: TestTreeItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      element.label,
      element.children && element.children.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    if (element.type === 'file') {
      treeItem.iconPath = new vscode.ThemeIcon('file');
      treeItem.contextValue = 'testFile';
      treeItem.description = `${element.children?.length || 0} tests`;
    } else if (element.type === 'test') {
      treeItem.iconPath = new vscode.ThemeIcon('beaker');
      treeItem.contextValue = 'test';
      treeItem.command = {
        command: 'mcp-testing.runTestAtCursor',
        title: 'Run Test',
        arguments: [element.test],
      };

      // Show status if available
      if (element.test?.status) {
        const statusIcons: Record<string, string> = {
          passed: '✓',
          failed: '✗',
          skipped: '○',
          running: '⟳',
        };
        treeItem.description = statusIcons[element.test.status] || '';
      }
    }

    return treeItem;
  }

  getChildren(element?: TestTreeItem): Thenable<TestTreeItem[]> {
    if (!element) {
      return Promise.resolve(this.treeItems);
    }
    return Promise.resolve(element.children || []);
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
