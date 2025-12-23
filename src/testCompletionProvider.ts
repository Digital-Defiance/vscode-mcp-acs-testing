/**
 * TestCompletionProvider - Provides code completion for tests
 *
 * Provides test template snippets, assertion methods, and fixture completions
 */

import * as vscode from 'vscode';
import { MCPTestingClient } from './mcpClient';
import { LogOutputChannel } from '@ai-capabilities-suite/mcp-client-base';

/**
 * TestCompletionProvider
 *
 * Implements vscode.CompletionItemProvider for test-related completions
 */
export class TestCompletionProvider implements vscode.CompletionItemProvider {
  private mcpClient: MCPTestingClient;
  private outputChannel: LogOutputChannel;
  private frameworkCache: Map<string, string> = new Map();

  constructor(mcpClient: MCPTestingClient, outputChannel: LogOutputChannel) {
    this.mcpClient = mcpClient;
    this.outputChannel = outputChannel;
  }

  /**
   * Provide completion items
   */
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[] | vscode.CompletionList | undefined> {
    try {
      const filePath = document.uri.fsPath;
      const lineText = document.lineAt(position.line).text;
      const textBeforeCursor = lineText.substring(0, position.character);

      // Detect framework
      const framework = await this.detectFramework(document);

      const completions: vscode.CompletionItem[] = [];

      // Provide test template snippets
      if (this.shouldProvideTestTemplates(textBeforeCursor)) {
        completions.push(...this.getTestTemplateCompletions(framework));
      }

      // Provide assertion method completions
      if (this.shouldProvideAssertions(textBeforeCursor)) {
        completions.push(...this.getAssertionCompletions(framework));
      }

      // Provide fixture completions
      if (this.shouldProvideFixtures(textBeforeCursor)) {
        completions.push(...this.getFixtureCompletions(framework));
      }

      // Provide test lifecycle hooks
      if (this.shouldProvideLifecycleHooks(textBeforeCursor)) {
        completions.push(...this.getLifecycleHookCompletions(framework));
      }

      // Provide mock/spy completions
      if (this.shouldProvideMocks(textBeforeCursor)) {
        completions.push(...this.getMockCompletions(framework));
      }

      return completions;
    } catch (error) {
      this.outputChannel.error(
        `Failed to provide completions: ${error instanceof Error ? error.message : String(error)}`
      );
      return undefined;
    }
  }

  /**
   * Resolve completion item (add additional details)
   */
  async resolveCompletionItem(
    item: vscode.CompletionItem,
    token: vscode.CancellationToken
  ): Promise<vscode.CompletionItem> {
    // Add documentation if not already present
    if (!item.documentation && item.detail) {
      item.documentation = new vscode.MarkdownString(item.detail);
    }
    return item;
  }

  /**
   * Detect test framework from document
   */
  private async detectFramework(document: vscode.TextDocument): Promise<string> {
    const filePath = document.uri.fsPath;

    // Check cache
    if (this.frameworkCache.has(filePath)) {
      return this.frameworkCache.get(filePath)!;
    }

    // Detect from imports
    const text = document.getText();

    if (text.includes('from jest') || text.includes("'jest'") || text.includes('"jest"')) {
      this.frameworkCache.set(filePath, 'jest');
      return 'jest';
    }

    if (text.includes('from mocha') || text.includes("'mocha'") || text.includes('"mocha"')) {
      this.frameworkCache.set(filePath, 'mocha');
      return 'mocha';
    }

    if (text.includes('import pytest') || text.includes('from pytest')) {
      this.frameworkCache.set(filePath, 'pytest');
      return 'pytest';
    }

    if (text.includes('from vitest') || text.includes("'vitest'") || text.includes('"vitest"')) {
      this.frameworkCache.set(filePath, 'vitest');
      return 'vitest';
    }

    // Default to jest for JS/TS, pytest for Python
    const defaultFramework = filePath.endsWith('.py') ? 'pytest' : 'jest';
    this.frameworkCache.set(filePath, defaultFramework);
    return defaultFramework;
  }

  /**
   * Check if should provide test templates
   */
  private shouldProvideTestTemplates(textBeforeCursor: string): boolean {
    return (
      textBeforeCursor.trim() === '' ||
      textBeforeCursor.includes('describe') ||
      textBeforeCursor.includes('test') ||
      textBeforeCursor.includes('it(') ||
      textBeforeCursor.includes('def test_')
    );
  }

  /**
   * Check if should provide assertions
   */
  private shouldProvideAssertions(textBeforeCursor: string): boolean {
    return (
      textBeforeCursor.includes('expect') ||
      textBeforeCursor.includes('assert') ||
      textBeforeCursor.includes('should')
    );
  }

  /**
   * Check if should provide fixtures
   */
  private shouldProvideFixtures(textBeforeCursor: string): boolean {
    return (
      textBeforeCursor.includes('beforeEach') ||
      textBeforeCursor.includes('beforeAll') ||
      textBeforeCursor.includes('setUp') ||
      textBeforeCursor.includes('fixture')
    );
  }

  /**
   * Check if should provide lifecycle hooks
   */
  private shouldProvideLifecycleHooks(textBeforeCursor: string): boolean {
    return (
      textBeforeCursor.trim() === '' ||
      textBeforeCursor.includes('before') ||
      textBeforeCursor.includes('after')
    );
  }

  /**
   * Check if should provide mocks
   */
  private shouldProvideMocks(textBeforeCursor: string): boolean {
    return (
      textBeforeCursor.includes('mock') ||
      textBeforeCursor.includes('spy') ||
      textBeforeCursor.includes('stub')
    );
  }

  /**
   * Get test template completions
   */
  private getTestTemplateCompletions(framework: string): vscode.CompletionItem[] {
    const completions: vscode.CompletionItem[] = [];

    if (framework === 'jest' || framework === 'vitest') {
      // describe block
      const describeItem = new vscode.CompletionItem('describe', vscode.CompletionItemKind.Snippet);
      describeItem.insertText = new vscode.SnippetString(
        "describe('${1:description}', () => {\n\t${0}\n});"
      );
      describeItem.documentation = new vscode.MarkdownString(
        'Create a test suite with describe block'
      );
      describeItem.detail = 'Test suite template';
      completions.push(describeItem);

      // test/it block
      const testItem = new vscode.CompletionItem('test', vscode.CompletionItemKind.Snippet);
      testItem.insertText = new vscode.SnippetString(
        "test('${1:should do something}', () => {\n\t${0}\n});"
      );
      testItem.documentation = new vscode.MarkdownString('Create a test case');
      testItem.detail = 'Test case template';
      completions.push(testItem);

      const itItem = new vscode.CompletionItem('it', vscode.CompletionItemKind.Snippet);
      itItem.insertText = new vscode.SnippetString(
        "it('${1:should do something}', () => {\n\t${0}\n});"
      );
      itItem.documentation = new vscode.MarkdownString('Create a test case (alias for test)');
      itItem.detail = 'Test case template';
      completions.push(itItem);

      // async test
      const asyncTestItem = new vscode.CompletionItem(
        'test-async',
        vscode.CompletionItemKind.Snippet
      );
      asyncTestItem.insertText = new vscode.SnippetString(
        "test('${1:should do something}', async () => {\n\t${0}\n});"
      );
      asyncTestItem.documentation = new vscode.MarkdownString('Create an async test case');
      asyncTestItem.detail = 'Async test case template';
      completions.push(asyncTestItem);
    } else if (framework === 'mocha') {
      // describe block
      const describeItem = new vscode.CompletionItem('describe', vscode.CompletionItemKind.Snippet);
      describeItem.insertText = new vscode.SnippetString(
        "describe('${1:description}', function() {\n\t${0}\n});"
      );
      describeItem.documentation = new vscode.MarkdownString(
        'Create a test suite with describe block'
      );
      describeItem.detail = 'Test suite template';
      completions.push(describeItem);

      // it block
      const itItem = new vscode.CompletionItem('it', vscode.CompletionItemKind.Snippet);
      itItem.insertText = new vscode.SnippetString(
        "it('${1:should do something}', function() {\n\t${0}\n});"
      );
      itItem.documentation = new vscode.MarkdownString('Create a test case');
      itItem.detail = 'Test case template';
      completions.push(itItem);
    } else if (framework === 'pytest') {
      // test function
      const testFuncItem = new vscode.CompletionItem(
        'test_function',
        vscode.CompletionItemKind.Snippet
      );
      testFuncItem.insertText = new vscode.SnippetString(
        'def test_${1:something}():\n\t"""${2:Test description}"""\n\t${0}\n\tassert True'
      );
      testFuncItem.documentation = new vscode.MarkdownString('Create a test function');
      testFuncItem.detail = 'Test function template';
      completions.push(testFuncItem);

      // test class
      const testClassItem = new vscode.CompletionItem(
        'test_class',
        vscode.CompletionItemKind.Snippet
      );
      testClassItem.insertText = new vscode.SnippetString(
        'class Test${1:ClassName}:\n\t"""${2:Test class description}"""\n\n\tdef test_${3:something}(self):\n\t\t"""${4:Test description}"""\n\t\t${0}\n\t\tassert True'
      );
      testClassItem.documentation = new vscode.MarkdownString('Create a test class');
      testClassItem.detail = 'Test class template';
      completions.push(testClassItem);
    }

    return completions;
  }

  /**
   * Get assertion completions
   */
  private getAssertionCompletions(framework: string): vscode.CompletionItem[] {
    const completions: vscode.CompletionItem[] = [];

    if (framework === 'jest' || framework === 'vitest') {
      const assertions = [
        { name: 'toBe', snippet: 'toBe(${1:expected})', doc: 'Exact equality (===)' },
        { name: 'toEqual', snippet: 'toEqual(${1:expected})', doc: 'Deep equality' },
        {
          name: 'toStrictEqual',
          snippet: 'toStrictEqual(${1:expected})',
          doc: 'Strict deep equality',
        },
        { name: 'toBeTruthy', snippet: 'toBeTruthy()', doc: 'Value is truthy' },
        { name: 'toBeFalsy', snippet: 'toBeFalsy()', doc: 'Value is falsy' },
        { name: 'toBeNull', snippet: 'toBeNull()', doc: 'Value is null' },
        { name: 'toBeUndefined', snippet: 'toBeUndefined()', doc: 'Value is undefined' },
        { name: 'toBeDefined', snippet: 'toBeDefined()', doc: 'Value is defined' },
        {
          name: 'toBeGreaterThan',
          snippet: 'toBeGreaterThan(${1:number})',
          doc: 'Value is greater than',
        },
        { name: 'toBeLessThan', snippet: 'toBeLessThan(${1:number})', doc: 'Value is less than' },
        { name: 'toContain', snippet: 'toContain(${1:item})', doc: 'Array/string contains item' },
        { name: 'toMatch', snippet: 'toMatch(${1:pattern})', doc: 'String matches pattern' },
        { name: 'toThrow', snippet: 'toThrow(${1:error})', doc: 'Function throws error' },
        {
          name: 'toHaveBeenCalled',
          snippet: 'toHaveBeenCalled()',
          doc: 'Mock function was called',
        },
        {
          name: 'toHaveBeenCalledWith',
          snippet: 'toHaveBeenCalledWith(${1:args})',
          doc: 'Mock function was called with args',
        },
      ];

      for (const assertion of assertions) {
        const item = new vscode.CompletionItem(assertion.name, vscode.CompletionItemKind.Method);
        item.insertText = new vscode.SnippetString(assertion.snippet);
        item.documentation = new vscode.MarkdownString(assertion.doc);
        item.detail = 'Jest/Vitest assertion';
        completions.push(item);
      }
    } else if (framework === 'pytest') {
      const assertions = [
        { name: 'assert_equal', snippet: 'assert ${1:actual} == ${2:expected}', doc: 'Equality' },
        {
          name: 'assert_not_equal',
          snippet: 'assert ${1:actual} != ${2:expected}',
          doc: 'Inequality',
        },
        { name: 'assert_true', snippet: 'assert ${1:condition}', doc: 'Condition is true' },
        { name: 'assert_false', snippet: 'assert not ${1:condition}', doc: 'Condition is false' },
        {
          name: 'assert_in',
          snippet: 'assert ${1:item} in ${2:container}',
          doc: 'Item in container',
        },
        {
          name: 'assert_not_in',
          snippet: 'assert ${1:item} not in ${2:container}',
          doc: 'Item not in container',
        },
        {
          name: 'assert_is',
          snippet: 'assert ${1:actual} is ${2:expected}',
          doc: 'Identity check',
        },
        {
          name: 'assert_is_not',
          snippet: 'assert ${1:actual} is not ${2:expected}',
          doc: 'Not identity check',
        },
        {
          name: 'assert_raises',
          snippet: 'with pytest.raises(${1:Exception}):\n\t${0}',
          doc: 'Raises exception',
        },
      ];

      for (const assertion of assertions) {
        const item = new vscode.CompletionItem(assertion.name, vscode.CompletionItemKind.Method);
        item.insertText = new vscode.SnippetString(assertion.snippet);
        item.documentation = new vscode.MarkdownString(assertion.doc);
        item.detail = 'Pytest assertion';
        completions.push(item);
      }
    }

    return completions;
  }

  /**
   * Get fixture completions
   */
  private getFixtureCompletions(framework: string): vscode.CompletionItem[] {
    const completions: vscode.CompletionItem[] = [];

    if (framework === 'jest' || framework === 'vitest') {
      const fixtures = [
        {
          name: 'beforeEach',
          snippet: 'beforeEach(() => {\n\t${0}\n});',
          doc: 'Run before each test',
        },
        {
          name: 'afterEach',
          snippet: 'afterEach(() => {\n\t${0}\n});',
          doc: 'Run after each test',
        },
        {
          name: 'beforeAll',
          snippet: 'beforeAll(() => {\n\t${0}\n});',
          doc: 'Run once before all tests',
        },
        {
          name: 'afterAll',
          snippet: 'afterAll(() => {\n\t${0}\n});',
          doc: 'Run once after all tests',
        },
      ];

      for (const fixture of fixtures) {
        const item = new vscode.CompletionItem(fixture.name, vscode.CompletionItemKind.Function);
        item.insertText = new vscode.SnippetString(fixture.snippet);
        item.documentation = new vscode.MarkdownString(fixture.doc);
        item.detail = 'Test lifecycle hook';
        completions.push(item);
      }
    } else if (framework === 'pytest') {
      const fixtureItem = new vscode.CompletionItem('fixture', vscode.CompletionItemKind.Function);
      fixtureItem.insertText = new vscode.SnippetString(
        '@pytest.fixture\ndef ${1:fixture_name}():\n\t"""${2:Fixture description}"""\n\t${0}\n\treturn ${3:value}'
      );
      fixtureItem.documentation = new vscode.MarkdownString('Create a pytest fixture');
      fixtureItem.detail = 'Pytest fixture';
      completions.push(fixtureItem);

      const fixtureWithScopeItem = new vscode.CompletionItem(
        'fixture-scope',
        vscode.CompletionItemKind.Function
      );
      fixtureWithScopeItem.insertText = new vscode.SnippetString(
        '@pytest.fixture(scope="${1|function,class,module,session|}")\ndef ${2:fixture_name}():\n\t"""${3:Fixture description}"""\n\t${0}\n\treturn ${4:value}'
      );
      fixtureWithScopeItem.documentation = new vscode.MarkdownString(
        'Create a pytest fixture with scope'
      );
      fixtureWithScopeItem.detail = 'Pytest fixture with scope';
      completions.push(fixtureWithScopeItem);
    }

    return completions;
  }

  /**
   * Get lifecycle hook completions
   */
  private getLifecycleHookCompletions(framework: string): vscode.CompletionItem[] {
    const completions: vscode.CompletionItem[] = [];

    if (framework === 'mocha') {
      const hooks = [
        {
          name: 'before',
          snippet: 'before(function() {\n\t${0}\n});',
          doc: 'Run once before tests',
        },
        { name: 'after', snippet: 'after(function() {\n\t${0}\n});', doc: 'Run once after tests' },
        {
          name: 'beforeEach',
          snippet: 'beforeEach(function() {\n\t${0}\n});',
          doc: 'Run before each test',
        },
        {
          name: 'afterEach',
          snippet: 'afterEach(function() {\n\t${0}\n});',
          doc: 'Run after each test',
        },
      ];

      for (const hook of hooks) {
        const item = new vscode.CompletionItem(hook.name, vscode.CompletionItemKind.Function);
        item.insertText = new vscode.SnippetString(hook.snippet);
        item.documentation = new vscode.MarkdownString(hook.doc);
        item.detail = 'Mocha lifecycle hook';
        completions.push(item);
      }
    }

    return completions;
  }

  /**
   * Get mock/spy completions
   */
  private getMockCompletions(framework: string): vscode.CompletionItem[] {
    const completions: vscode.CompletionItem[] = [];

    if (framework === 'jest' || framework === 'vitest') {
      const mocks = [
        { name: 'jest.fn', snippet: 'jest.fn(${1:implementation})', doc: 'Create a mock function' },
        {
          name: 'jest.spyOn',
          snippet: 'jest.spyOn(${1:object}, "${2:method}")',
          doc: 'Spy on a method',
        },
        { name: 'jest.mock', snippet: 'jest.mock("${1:module}")', doc: 'Mock a module' },
        {
          name: 'mockReturnValue',
          snippet: 'mockReturnValue(${1:value})',
          doc: 'Set return value for mock',
        },
        {
          name: 'mockResolvedValue',
          snippet: 'mockResolvedValue(${1:value})',
          doc: 'Set resolved value for async mock',
        },
        {
          name: 'mockRejectedValue',
          snippet: 'mockRejectedValue(${1:error})',
          doc: 'Set rejected value for async mock',
        },
        {
          name: 'mockImplementation',
          snippet: 'mockImplementation((${1:args}) => {\n\t${0}\n})',
          doc: 'Set implementation for mock',
        },
      ];

      for (const mock of mocks) {
        const item = new vscode.CompletionItem(mock.name, vscode.CompletionItemKind.Function);
        item.insertText = new vscode.SnippetString(mock.snippet);
        item.documentation = new vscode.MarkdownString(mock.doc);
        item.detail = 'Jest/Vitest mock';
        completions.push(item);
      }
    } else if (framework === 'pytest') {
      const mocks = [
        {
          name: 'monkeypatch',
          snippet: 'monkeypatch.setattr(${1:target}, "${2:name}", ${3:value})',
          doc: 'Monkeypatch an attribute',
        },
        {
          name: 'mocker.patch',
          snippet: 'mocker.patch("${1:target}", return_value=${2:value})',
          doc: 'Patch a target',
        },
        {
          name: 'mocker.spy',
          snippet: 'mocker.spy(${1:object}, "${2:method}")',
          doc: 'Spy on a method',
        },
      ];

      for (const mock of mocks) {
        const item = new vscode.CompletionItem(mock.name, vscode.CompletionItemKind.Function);
        item.insertText = new vscode.SnippetString(mock.snippet);
        item.documentation = new vscode.MarkdownString(mock.doc);
        item.detail = 'Pytest mock';
        completions.push(item);
      }
    }

    return completions;
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.frameworkCache.clear();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.clearCaches();
  }
}
