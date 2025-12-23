/**
 * TestTagsTreeProvider - Display tests grouped by tags
 *
 * Implements vscode.TreeDataProvider to show tests grouped by tags
 */

import * as vscode from 'vscode';
import { MCPTestingClient, TestResult } from './mcpClient';

/**
 * Tree item types
 */
type TreeItemType = 'tag' | 'test';

/**
 * Tree item data
 */
interface TreeItemData {
  type: TreeItemType;
  tag?: string;
  test?: TestResult;
}

/**
 * TestTagsTreeProvider
 *
 * Displays tests grouped by tags with test counts and tag-based execution
 */
export class TestTagsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private tests: TestResult[] = [];
  private readonly treeItemData = new WeakMap<vscode.TreeItem, TreeItemData>();

  constructor(
    private readonly mcpClient: MCPTestingClient,
    private readonly outputChannel: vscode.LogOutputChannel
  ) {
    // Listen to test events to update tags
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
      // Root level - show tags
      return this.getTags();
    }

    const data = this.treeItemData.get(element);
    if (!data) {
      return [];
    }

    switch (data.type) {
      case 'tag':
        return this.getTestsForTag(data.tag!);
      case 'test':
        return [];
      default:
        return [];
    }
  }

  /**
   * Get all tags
   */
  private getTags(): vscode.TreeItem[] {
    // Collect all unique tags
    const tagCounts = new Map<string, number>();
    for (const test of this.tests) {
      for (const tag of test.tags || []) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    if (tagCounts.size === 0) {
      const item = new vscode.TreeItem('No tags found', vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon('tag');
      item.tooltip = 'Add tags to tests to organize them';
      return [item];
    }

    // Sort tags alphabetically
    const sortedTags = Array.from(tagCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    // Create tree items for tags
    return sortedTags.map(([tag, count]) => this.createTagItem(tag, count));
  }

  /**
   * Create tag item
   */
  private createTagItem(tag: string, count: number): vscode.TreeItem {
    const label = `${tag} (${count})`;

    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
    item.iconPath = new vscode.ThemeIcon('tag');
    item.description = `${count} test${count !== 1 ? 's' : ''}`;

    // Set tooltip
    item.tooltip = new vscode.MarkdownString();
    item.tooltip.appendMarkdown(`**Tag: ${tag}**\n\n`);
    item.tooltip.appendMarkdown(`Tests: ${count}\n`);

    item.contextValue = 'testTag';

    this.treeItemData.set(item, {
      type: 'tag',
      tag,
    });

    return item;
  }

  /**
   * Get tests for a tag
   */
  private getTestsForTag(tag: string): vscode.TreeItem[] {
    const testsWithTag = this.tests.filter((test) => test.tags?.includes(tag));
    return testsWithTag.map((test) => this.createTestItem(test));
  }

  /**
   * Create test item
   */
  private createTestItem(test: TestResult): vscode.TreeItem {
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

    item.description = test.file.split('/').pop();

    // Set tooltip
    item.tooltip = new vscode.MarkdownString();
    item.tooltip.appendMarkdown(`**${test.name}**\n\n`);
    item.tooltip.appendMarkdown(`- Status: ${test.status}\n`);
    item.tooltip.appendMarkdown(`- File: ${test.file}\n`);
    item.tooltip.appendMarkdown(`- Tags: ${test.tags?.join(', ') || 'none'}\n`);

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

    item.contextValue = 'taggedTest';

    this.treeItemData.set(item, {
      type: 'test',
      test,
    });

    return item;
  }

  /**
   * Load tests
   */
  async loadTests(): Promise<void> {
    try {
      this.tests = await this.mcpClient.listTests();
      this.refresh();
    } catch (error) {
      this.outputChannel.error(
        `Failed to load tests: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Run tests with tag
   */
  async runTestsWithTag(tag: string): Promise<void> {
    try {
      this.outputChannel.info(`Running tests with tag: ${tag}`);

      // Get tests with this tag
      const testsWithTag = this.tests.filter((test) => test.tags?.includes(tag));

      if (testsWithTag.length === 0) {
        vscode.window.showInformationMessage(`No tests found with tag: ${tag}`);
        return;
      }

      // Run tests
      // In a real implementation, we would pass the tag filter to the MCP server
      // For now, we'll just show a message
      vscode.window.showInformationMessage(`Running ${testsWithTag.length} tests with tag: ${tag}`);

      // TODO: Implement actual test execution with tag filter
      // await this.mcpClient.runTests({ tags: [tag] });
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to run tests: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Add tag to test
   */
  async addTagToTest(testId: string, tag: string): Promise<void> {
    try {
      // In a real implementation, this would call the MCP server
      // For now, we'll update locally
      const test = this.tests.find((t) => t.id === testId);
      if (test) {
        if (!test.tags) {
          test.tags = [];
        }
        if (!test.tags.includes(tag)) {
          test.tags.push(tag);
          this.refresh();
          vscode.window.showInformationMessage(`Added tag "${tag}" to test "${test.name}"`);
        } else {
          vscode.window.showInformationMessage(`Test already has tag "${tag}"`);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to add tag: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Remove tag from test
   */
  async removeTagFromTest(testId: string, tag: string): Promise<void> {
    try {
      // In a real implementation, this would call the MCP server
      // For now, we'll update locally
      const test = this.tests.find((t) => t.id === testId);
      if (test && test.tags) {
        const index = test.tags.indexOf(tag);
        if (index !== -1) {
          test.tags.splice(index, 1);
          this.refresh();
          vscode.window.showInformationMessage(`Removed tag "${tag}" from test "${test.name}"`);
        } else {
          vscode.window.showInformationMessage(`Test does not have tag "${tag}"`);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to remove tag: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Rename tag
   */
  async renameTag(oldTag: string, newTag: string): Promise<void> {
    try {
      // Update all tests with the old tag
      let count = 0;
      for (const test of this.tests) {
        if (test.tags?.includes(oldTag)) {
          const index = test.tags.indexOf(oldTag);
          test.tags[index] = newTag;
          count++;
        }
      }

      this.refresh();
      vscode.window.showInformationMessage(
        `Renamed tag "${oldTag}" to "${newTag}" in ${count} tests`
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to rename tag: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Delete tag
   */
  async deleteTag(tag: string): Promise<void> {
    try {
      // Remove tag from all tests
      let count = 0;
      for (const test of this.tests) {
        if (test.tags?.includes(tag)) {
          const index = test.tags.indexOf(tag);
          test.tags.splice(index, 1);
          count++;
        }
      }

      this.refresh();
      vscode.window.showInformationMessage(`Deleted tag "${tag}" from ${count} tests`);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to delete tag: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Show tag management dialog
   */
  async showTagManagementDialog(testId?: string): Promise<void> {
    const actions = ['Add Tag', 'Remove Tag', 'Rename Tag', 'Delete Tag', 'Run Tests with Tag'];

    const action = await vscode.window.showQuickPick(actions, {
      placeHolder: 'Select tag management action',
    });

    if (!action) {
      return;
    }

    switch (action) {
      case 'Add Tag':
        await this.promptAddTag(testId);
        break;
      case 'Remove Tag':
        await this.promptRemoveTag(testId);
        break;
      case 'Rename Tag':
        await this.promptRenameTag();
        break;
      case 'Delete Tag':
        await this.promptDeleteTag();
        break;
      case 'Run Tests with Tag':
        await this.promptRunTestsWithTag();
        break;
    }
  }

  /**
   * Prompt to add tag
   */
  private async promptAddTag(testId?: string): Promise<void> {
    if (!testId) {
      vscode.window.showErrorMessage('No test selected');
      return;
    }

    const tag = await vscode.window.showInputBox({
      prompt: 'Enter tag name',
      placeHolder: 'e.g., smoke, integration, slow',
    });

    if (tag) {
      await this.addTagToTest(testId, tag);
    }
  }

  /**
   * Prompt to remove tag
   */
  private async promptRemoveTag(testId?: string): Promise<void> {
    if (!testId) {
      vscode.window.showErrorMessage('No test selected');
      return;
    }

    const test = this.tests.find((t) => t.id === testId);
    if (!test || !test.tags || test.tags.length === 0) {
      vscode.window.showInformationMessage('Test has no tags');
      return;
    }

    const tag = await vscode.window.showQuickPick(test.tags, {
      placeHolder: 'Select tag to remove',
    });

    if (tag) {
      await this.removeTagFromTest(testId, tag);
    }
  }

  /**
   * Prompt to rename tag
   */
  private async promptRenameTag(): Promise<void> {
    // Get all unique tags
    const tags = new Set<string>();
    for (const test of this.tests) {
      for (const tag of test.tags || []) {
        tags.add(tag);
      }
    }

    if (tags.size === 0) {
      vscode.window.showInformationMessage('No tags found');
      return;
    }

    const oldTag = await vscode.window.showQuickPick(Array.from(tags), {
      placeHolder: 'Select tag to rename',
    });

    if (!oldTag) {
      return;
    }

    const newTag = await vscode.window.showInputBox({
      prompt: 'Enter new tag name',
      value: oldTag,
    });

    if (newTag && newTag !== oldTag) {
      await this.renameTag(oldTag, newTag);
    }
  }

  /**
   * Prompt to delete tag
   */
  private async promptDeleteTag(): Promise<void> {
    // Get all unique tags
    const tags = new Set<string>();
    for (const test of this.tests) {
      for (const tag of test.tags || []) {
        tags.add(tag);
      }
    }

    if (tags.size === 0) {
      vscode.window.showInformationMessage('No tags found');
      return;
    }

    const tag = await vscode.window.showQuickPick(Array.from(tags), {
      placeHolder: 'Select tag to delete',
    });

    if (tag) {
      const confirm = await vscode.window.showWarningMessage(
        `Delete tag "${tag}" from all tests?`,
        'Delete',
        'Cancel'
      );

      if (confirm === 'Delete') {
        await this.deleteTag(tag);
      }
    }
  }

  /**
   * Prompt to run tests with tag
   */
  private async promptRunTestsWithTag(): Promise<void> {
    // Get all unique tags
    const tags = new Set<string>();
    for (const test of this.tests) {
      for (const tag of test.tags || []) {
        tags.add(tag);
      }
    }

    if (tags.size === 0) {
      vscode.window.showInformationMessage('No tags found');
      return;
    }

    const tag = await vscode.window.showQuickPick(Array.from(tags), {
      placeHolder: 'Select tag to run tests',
    });

    if (tag) {
      await this.runTestsWithTag(tag);
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
