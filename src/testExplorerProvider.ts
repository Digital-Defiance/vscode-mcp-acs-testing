/**
 * TestExplorerProvider - VS Code Test Explorer integration
 *
 * Provides Test Explorer tree view using VS Code Testing API
 */

import * as vscode from 'vscode';
import { MCPTestingClient, TestResult, TestRunOptions } from './mcpClient';

/**
 * Test item data stored in test items
 */
interface TestItemData {
  type: 'file' | 'suite' | 'test';
  testId?: string;
  filePath?: string;
  suitePath?: string[];
}

/**
 * TestExplorerProvider
 *
 * Implements VS Code TestController for Test Explorer integration
 */
export class TestExplorerProvider {
  private readonly controller: vscode.TestController;
  private readonly testData = new WeakMap<vscode.TestItem, TestItemData>();
  private readonly testItemsById = new Map<string, vscode.TestItem>();
  private discoveryInProgress = false;
  private runProfile?: vscode.TestRunProfile;
  private debugProfile?: vscode.TestRunProfile;
  private coverageProfile?: vscode.TestRunProfile;

  constructor(
    private readonly mcpClient: MCPTestingClient,
    private readonly outputChannel: vscode.LogOutputChannel
  ) {
    // Create test controller
    this.controller = vscode.tests.createTestController('mcp-testing-controller', 'MCP Testing');

    // Set up test run handler
    this.controller.resolveHandler = this.resolveHandler.bind(this);

    // Create test run profiles
    this.createRunProfiles();

    // Listen to test events from MCP client
    this.setupEventListeners();

    // Initial discovery
    this.discoverTests();
  }

  /**
   * Create test run profiles (Run, Debug, Coverage)
   */
  private createRunProfiles(): void {
    // Run profile
    this.runProfile = this.controller.createRunProfile(
      'Run Tests',
      vscode.TestRunProfileKind.Run,
      this.runTests.bind(this),
      true
    );

    // Debug profile
    this.debugProfile = this.controller.createRunProfile(
      'Debug Tests',
      vscode.TestRunProfileKind.Debug,
      this.debugTests.bind(this),
      false
    );

    // Coverage profile
    this.coverageProfile = this.controller.createRunProfile(
      'Run with Coverage',
      vscode.TestRunProfileKind.Coverage,
      this.runTestsWithCoverage.bind(this),
      false
    );
  }

  /**
   * Setup event listeners for test events
   */
  private setupEventListeners(): void {
    // Listen to test started events
    this.mcpClient.onTestStarted((test) => {
      const testItem = this.testItemsById.get(test.id);
      if (testItem) {
        // Update test item state to running
        this.outputChannel.info(`Test started: ${test.name}`);
      }
    });

    // Listen to test completed events
    this.mcpClient.onTestCompleted((test) => {
      const testItem = this.testItemsById.get(test.id);
      if (testItem) {
        // Update test item state based on result
        this.outputChannel.info(`Test completed: ${test.name} - ${test.status}`);
      }
    });
  }

  /**
   * Resolve handler for lazy loading test items
   */
  private async resolveHandler(item: vscode.TestItem | undefined): Promise<void> {
    if (!item) {
      // Root level - discover all tests
      await this.discoverTests();
    } else {
      // Resolve children of a specific item
      const data = this.testData.get(item);
      if (data?.type === 'file') {
        // File item - children are already loaded during discovery
        return;
      }
    }
  }

  /**
   * Discover tests from MCP Server
   */
  async discoverTests(): Promise<void> {
    if (this.discoveryInProgress) {
      return;
    }

    this.discoveryInProgress = true;
    this.outputChannel.info('Discovering tests...');

    try {
      // Get all tests from MCP server
      const tests = await this.mcpClient.listTests();
      this.outputChannel.info(`Discovered ${tests.length} tests`);

      // Clear existing test items
      this.controller.items.replace([]);
      this.testItemsById.clear();

      // Group tests by file
      const testsByFile = new Map<string, TestResult[]>();
      for (const test of tests) {
        if (!testsByFile.has(test.file)) {
          testsByFile.set(test.file, []);
        }
        testsByFile.get(test.file)!.push(test);
      }

      // Create test items hierarchy
      for (const [filePath, fileTests] of testsByFile) {
        this.createFileTestItem(filePath, fileTests);
      }

      this.outputChannel.info('Test discovery completed');
    } catch (error) {
      this.outputChannel.error(
        `Failed to discover tests: ${error instanceof Error ? error.message : String(error)}`
      );
      vscode.window.showErrorMessage(`Failed to discover tests: ${error}`);
    } finally {
      this.discoveryInProgress = false;
    }
  }

  /**
   * Create test item for a file and its tests
   */
  private createFileTestItem(filePath: string, tests: TestResult[]): void {
    // Create file test item
    const fileUri = vscode.Uri.file(filePath);
    const fileName = filePath.split('/').pop() || filePath;
    const fileItem = this.controller.createTestItem(`file:${filePath}`, fileName, fileUri);

    // Store file data
    this.testData.set(fileItem, {
      type: 'file',
      filePath,
    });

    // Group tests by suite
    const testsBySuite = new Map<string, TestResult[]>();
    for (const test of tests) {
      const suiteKey = test.suite.join('/') || '__root__';
      if (!testsBySuite.has(suiteKey)) {
        testsBySuite.set(suiteKey, []);
      }
      testsBySuite.get(suiteKey)!.push(test);
    }

    // Create suite and test items
    for (const [suiteKey, suiteTests] of testsBySuite) {
      if (suiteKey === '__root__') {
        // Tests without suite - add directly to file
        for (const test of suiteTests) {
          this.createTestItem(fileItem, test);
        }
      } else {
        // Create suite item
        const suite = suiteTests[0].suite;
        const suiteItem = this.createSuiteItem(fileItem, suite, filePath);

        // Add tests to suite
        for (const test of suiteTests) {
          this.createTestItem(suiteItem, test);
        }
      }
    }

    // Add file item to controller
    this.controller.items.add(fileItem);
  }

  /**
   * Create suite test item
   */
  private createSuiteItem(
    parent: vscode.TestItem,
    suitePath: string[],
    filePath: string
  ): vscode.TestItem {
    const suiteId = `suite:${filePath}:${suitePath.join('/')}`;
    const suiteName = suitePath[suitePath.length - 1];

    const suiteItem = this.controller.createTestItem(suiteId, suiteName, vscode.Uri.file(filePath));

    // Store suite data
    this.testData.set(suiteItem, {
      type: 'suite',
      filePath,
      suitePath,
    });

    parent.children.add(suiteItem);
    return suiteItem;
  }

  /**
   * Create test item
   */
  private createTestItem(parent: vscode.TestItem, test: TestResult): void {
    const testItem = this.controller.createTestItem(test.id, test.name, vscode.Uri.file(test.file));

    // Set test range if line number is available
    if (test.line > 0) {
      testItem.range = new vscode.Range(
        new vscode.Position(test.line - 1, 0),
        new vscode.Position(test.line - 1, 0)
      );
    }

    // Store test data
    this.testData.set(testItem, {
      type: 'test',
      testId: test.id,
      filePath: test.file,
      suitePath: test.suite,
    });

    // Store in map for quick lookup
    this.testItemsById.set(test.id, testItem);

    parent.children.add(testItem);
  }

  /**
   * Run tests
   */
  private async runTests(
    request: vscode.TestRunRequest,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    const run = this.controller.createTestRun(request);

    try {
      // Get tests to run
      const testsToRun = this.getTestsToRun(request);

      // Mark tests as enqueued
      for (const test of testsToRun) {
        run.enqueued(test);
      }

      // Run each test
      for (const test of testsToRun) {
        if (cancellation.isCancellationRequested) {
          run.skipped(test);
          continue;
        }

        await this.runSingleTest(test, run, false);
      }
    } catch (error) {
      this.outputChannel.error(
        `Test run failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      run.end();
    }
  }

  /**
   * Debug tests
   */
  private async debugTests(
    request: vscode.TestRunRequest,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    const run = this.controller.createTestRun(request);

    try {
      // Get tests to run
      const testsToRun = this.getTestsToRun(request);

      // Debug each test
      for (const test of testsToRun) {
        if (cancellation.isCancellationRequested) {
          run.skipped(test);
          continue;
        }

        await this.runSingleTest(test, run, true);
      }
    } catch (error) {
      this.outputChannel.error(
        `Test debug failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      run.end();
    }
  }

  /**
   * Run tests with coverage
   */
  private async runTestsWithCoverage(
    request: vscode.TestRunRequest,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    const run = this.controller.createTestRun(request);

    try {
      // Get tests to run
      const testsToRun = this.getTestsToRun(request);

      // Mark tests as enqueued
      for (const test of testsToRun) {
        run.enqueued(test);
      }

      // Collect test IDs
      const testIds: string[] = [];
      for (const test of testsToRun) {
        const data = this.testData.get(test);
        if (data?.testId) {
          testIds.push(data.testId);
        }
      }

      // Run tests with coverage
      const options: TestRunOptions = {
        coverage: true,
      };

      const results = await this.mcpClient.runTests(options);

      // Update test results
      for (const result of results) {
        const testItem = this.testItemsById.get(result.id);
        if (testItem) {
          this.updateTestResult(testItem, result, run);
        }
      }

      // Analyze coverage
      await this.mcpClient.analyzeCoverage(results);
    } catch (error) {
      this.outputChannel.error(
        `Test run with coverage failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      run.end();
    }
  }

  /**
   * Run a single test
   */
  private async runSingleTest(
    testItem: vscode.TestItem,
    run: vscode.TestRun,
    debug: boolean
  ): Promise<void> {
    const data = this.testData.get(testItem);

    if (data?.type === 'test' && data.testId) {
      // Mark test as started
      run.started(testItem);

      try {
        if (debug) {
          // Debug the test
          await this.mcpClient.debugTest(data.testId);
          // For now, mark as passed since debugging is interactive
          run.passed(testItem);
        } else {
          // Run the test
          const options: TestRunOptions = {
            testPath: data.filePath,
          };

          const results = await this.mcpClient.runTests(options);

          // Find result for this test
          const result = results.find((r) => r.id === data.testId);
          if (result) {
            this.updateTestResult(testItem, result, run);
          } else {
            run.skipped(testItem);
          }
        }
      } catch (error) {
        run.failed(
          testItem,
          new vscode.TestMessage(
            `Test execution failed: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    } else if (data?.type === 'suite' || data?.type === 'file') {
      // Run all children
      const children: vscode.TestItem[] = [];
      testItem.children.forEach((child) => children.push(child));

      for (const child of children) {
        await this.runSingleTest(child, run, debug);
      }
    }
  }

  /**
   * Update test result in test run
   */
  private updateTestResult(
    testItem: vscode.TestItem,
    result: TestResult,
    run: vscode.TestRun
  ): void {
    const duration = result.duration;

    switch (result.status) {
      case 'passed':
        run.passed(testItem, duration);
        break;

      case 'failed':
        const message = new vscode.TestMessage(result.error?.message || 'Test failed');
        if (result.error?.stack) {
          message.stackTrace = result.error.stack.split('\n').map((line) => {
            // Parse stack trace line
            const match = line.match(/at .* \((.+):(\d+):(\d+)\)/);
            if (match) {
              const [, file, line, col] = match;
              return new vscode.TestMessageStackFrame(
                line,
                vscode.Uri.file(file),
                new vscode.Position(parseInt(line) - 1, parseInt(col) - 1)
              );
            }
            return new vscode.TestMessageStackFrame(line);
          });
        }

        // Set location if available
        if (result.line > 0) {
          message.location = new vscode.Location(
            vscode.Uri.file(result.file),
            new vscode.Position(result.line - 1, 0)
          );
        }

        run.failed(testItem, message, duration);
        break;

      case 'skipped':
        run.skipped(testItem);
        break;

      default:
        run.skipped(testItem);
        break;
    }
  }

  /**
   * Get tests to run from request
   */
  private getTestsToRun(request: vscode.TestRunRequest): vscode.TestItem[] {
    const tests: vscode.TestItem[] = [];

    if (request.include) {
      // Run specific tests
      for (const test of request.include) {
        this.collectTests(test, tests);
      }
    } else {
      // Run all tests
      this.controller.items.forEach((item) => {
        this.collectTests(item, tests);
      });
    }

    // Exclude tests if specified
    if (request.exclude) {
      const excludeIds = new Set<string>();
      for (const test of request.exclude) {
        this.collectTestIds(test, excludeIds);
      }

      return tests.filter((test) => !excludeIds.has(test.id));
    }

    return tests;
  }

  /**
   * Collect all test items recursively
   */
  private collectTests(item: vscode.TestItem, tests: vscode.TestItem[]): void {
    const data = this.testData.get(item);

    if (data?.type === 'test') {
      tests.push(item);
    } else {
      // Collect children
      item.children.forEach((child) => {
        this.collectTests(child, tests);
      });
    }
  }

  /**
   * Collect test IDs recursively
   */
  private collectTestIds(item: vscode.TestItem, ids: Set<string>): void {
    ids.add(item.id);
    item.children.forEach((child) => {
      this.collectTestIds(child, ids);
    });
  }

  /**
   * Refresh tests
   */
  async refreshTests(): Promise<void> {
    await this.discoverTests();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.controller.dispose();
  }
}
