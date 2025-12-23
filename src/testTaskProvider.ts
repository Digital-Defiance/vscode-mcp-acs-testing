/**
 * Test Task Provider
 *
 * Provides VS Code tasks for running tests, coverage analysis, and test generation
 */

import * as vscode from 'vscode';
import { MCPTestingClient } from './mcpClient';

/**
 * Task types supported by the provider
 */
export enum TestTaskType {
  RUN_TESTS = 'run-tests',
  RUN_COVERAGE = 'run-coverage',
  GENERATE_TESTS = 'generate-tests',
  RUN_FLAKY_DETECTION = 'run-flaky-detection',
  RUN_MUTATION_TESTING = 'run-mutation-testing',
  RUN_IMPACT_ANALYSIS = 'run-impact-analysis',
  RUN_PERFORMANCE_BENCHMARK = 'run-performance-benchmark',
}

/**
 * Task definition for test tasks
 */
interface TestTaskDefinition extends vscode.TaskDefinition {
  type: 'mcp-testing';
  taskType: TestTaskType;
  testPath?: string;
  pattern?: string;
  framework?: string;
  watch?: boolean;
  parallel?: boolean;
  maxWorkers?: number;
  timeout?: number;
}

/**
 * Test Task Provider
 *
 * Provides VS Code tasks for test execution, coverage analysis, and test generation
 */
export class TestTaskProvider implements vscode.TaskProvider {
  private tasks: vscode.Task[] | undefined;

  constructor(
    private readonly mcpClient: MCPTestingClient,
    private readonly outputChannel: vscode.LogOutputChannel
  ) {}

  /**
   * Provide tasks
   */
  public async provideTasks(): Promise<vscode.Task[]> {
    if (this.tasks !== undefined) {
      return this.tasks;
    }

    this.tasks = [];

    // Get workspace folders
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return this.tasks;
    }

    const workspaceFolder = workspaceFolders[0];

    // Create run tests task
    this.tasks.push(this.createRunTestsTask(workspaceFolder));

    // Create run tests with coverage task
    this.tasks.push(this.createRunCoverageTask(workspaceFolder));

    // Create run tests in watch mode task
    this.tasks.push(this.createWatchTestsTask(workspaceFolder));

    // Create run tests in parallel task
    this.tasks.push(this.createParallelTestsTask(workspaceFolder));

    // Create generate tests task
    this.tasks.push(this.createGenerateTestsTask(workspaceFolder));

    // Create flaky detection task
    this.tasks.push(this.createFlakyDetectionTask(workspaceFolder));

    // Create mutation testing task
    this.tasks.push(this.createMutationTestingTask(workspaceFolder));

    // Create impact analysis task
    this.tasks.push(this.createImpactAnalysisTask(workspaceFolder));

    // Create performance benchmark task
    this.tasks.push(this.createPerformanceBenchmarkTask(workspaceFolder));

    return this.tasks;
  }

  /**
   * Resolve a task
   */
  public async resolveTask(task: vscode.Task): Promise<vscode.Task | undefined> {
    const definition = task.definition as TestTaskDefinition;

    if (definition.type !== 'mcp-testing') {
      return undefined;
    }

    // Create execution for the task
    const execution = new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
      return this.createPseudoterminal(definition);
    });

    return new vscode.Task(
      definition,
      task.scope ?? vscode.TaskScope.Workspace,
      task.name,
      'mcp-testing',
      execution,
      task.problemMatchers
    );
  }

  /**
   * Create run tests task
   */
  private createRunTestsTask(workspaceFolder: vscode.WorkspaceFolder): vscode.Task {
    const definition: TestTaskDefinition = {
      type: 'mcp-testing',
      taskType: TestTaskType.RUN_TESTS,
    };

    const execution = new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
      return this.createPseudoterminal(definition);
    });

    const task = new vscode.Task(
      definition,
      workspaceFolder,
      'Run Tests',
      'mcp-testing',
      execution,
      ['$mcp-testing']
    );

    task.group = vscode.TaskGroup.Test;
    task.presentationOptions = {
      reveal: vscode.TaskRevealKind.Always,
      panel: vscode.TaskPanelKind.Dedicated,
      clear: true,
    };

    return task;
  }

  /**
   * Create run coverage task
   */
  private createRunCoverageTask(workspaceFolder: vscode.WorkspaceFolder): vscode.Task {
    const definition: TestTaskDefinition = {
      type: 'mcp-testing',
      taskType: TestTaskType.RUN_COVERAGE,
    };

    const execution = new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
      return this.createPseudoterminal(definition);
    });

    const task = new vscode.Task(
      definition,
      workspaceFolder,
      'Run Tests with Coverage',
      'mcp-testing',
      execution,
      ['$mcp-testing']
    );

    task.group = vscode.TaskGroup.Test;
    task.presentationOptions = {
      reveal: vscode.TaskRevealKind.Always,
      panel: vscode.TaskPanelKind.Dedicated,
      clear: true,
    };

    return task;
  }

  /**
   * Create watch tests task
   */
  private createWatchTestsTask(workspaceFolder: vscode.WorkspaceFolder): vscode.Task {
    const definition: TestTaskDefinition = {
      type: 'mcp-testing',
      taskType: TestTaskType.RUN_TESTS,
      watch: true,
    };

    const execution = new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
      return this.createPseudoterminal(definition);
    });

    const task = new vscode.Task(
      definition,
      workspaceFolder,
      'Watch Tests',
      'mcp-testing',
      execution,
      ['$mcp-testing']
    );

    task.group = vscode.TaskGroup.Test;
    task.isBackground = true;
    task.presentationOptions = {
      reveal: vscode.TaskRevealKind.Always,
      panel: vscode.TaskPanelKind.Dedicated,
      clear: true,
    };

    return task;
  }

  /**
   * Create parallel tests task
   */
  private createParallelTestsTask(workspaceFolder: vscode.WorkspaceFolder): vscode.Task {
    const definition: TestTaskDefinition = {
      type: 'mcp-testing',
      taskType: TestTaskType.RUN_TESTS,
      parallel: true,
      maxWorkers: 4,
    };

    const execution = new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
      return this.createPseudoterminal(definition);
    });

    const task = new vscode.Task(
      definition,
      workspaceFolder,
      'Run Tests in Parallel',
      'mcp-testing',
      execution,
      ['$mcp-testing']
    );

    task.group = vscode.TaskGroup.Test;
    task.presentationOptions = {
      reveal: vscode.TaskRevealKind.Always,
      panel: vscode.TaskPanelKind.Dedicated,
      clear: true,
    };

    return task;
  }

  /**
   * Create generate tests task
   */
  private createGenerateTestsTask(workspaceFolder: vscode.WorkspaceFolder): vscode.Task {
    const definition: TestTaskDefinition = {
      type: 'mcp-testing',
      taskType: TestTaskType.GENERATE_TESTS,
    };

    const execution = new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
      return this.createPseudoterminal(definition);
    });

    const task = new vscode.Task(
      definition,
      workspaceFolder,
      'Generate Tests',
      'mcp-testing',
      execution
    );

    task.presentationOptions = {
      reveal: vscode.TaskRevealKind.Always,
      panel: vscode.TaskPanelKind.Dedicated,
      clear: true,
    };

    return task;
  }

  /**
   * Create flaky detection task
   */
  private createFlakyDetectionTask(workspaceFolder: vscode.WorkspaceFolder): vscode.Task {
    const definition: TestTaskDefinition = {
      type: 'mcp-testing',
      taskType: TestTaskType.RUN_FLAKY_DETECTION,
    };

    const execution = new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
      return this.createPseudoterminal(definition);
    });

    const task = new vscode.Task(
      definition,
      workspaceFolder,
      'Detect Flaky Tests',
      'mcp-testing',
      execution
    );

    task.presentationOptions = {
      reveal: vscode.TaskRevealKind.Always,
      panel: vscode.TaskPanelKind.Dedicated,
      clear: true,
    };

    return task;
  }

  /**
   * Create mutation testing task
   */
  private createMutationTestingTask(workspaceFolder: vscode.WorkspaceFolder): vscode.Task {
    const definition: TestTaskDefinition = {
      type: 'mcp-testing',
      taskType: TestTaskType.RUN_MUTATION_TESTING,
    };

    const execution = new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
      return this.createPseudoterminal(definition);
    });

    const task = new vscode.Task(
      definition,
      workspaceFolder,
      'Run Mutation Testing',
      'mcp-testing',
      execution
    );

    task.presentationOptions = {
      reveal: vscode.TaskRevealKind.Always,
      panel: vscode.TaskPanelKind.Dedicated,
      clear: true,
    };

    return task;
  }

  /**
   * Create impact analysis task
   */
  private createImpactAnalysisTask(workspaceFolder: vscode.WorkspaceFolder): vscode.Task {
    const definition: TestTaskDefinition = {
      type: 'mcp-testing',
      taskType: TestTaskType.RUN_IMPACT_ANALYSIS,
    };

    const execution = new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
      return this.createPseudoterminal(definition);
    });

    const task = new vscode.Task(
      definition,
      workspaceFolder,
      'Analyze Test Impact',
      'mcp-testing',
      execution
    );

    task.presentationOptions = {
      reveal: vscode.TaskRevealKind.Always,
      panel: vscode.TaskPanelKind.Dedicated,
      clear: true,
    };

    return task;
  }

  /**
   * Create performance benchmark task
   */
  private createPerformanceBenchmarkTask(workspaceFolder: vscode.WorkspaceFolder): vscode.Task {
    const definition: TestTaskDefinition = {
      type: 'mcp-testing',
      taskType: TestTaskType.RUN_PERFORMANCE_BENCHMARK,
    };

    const execution = new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
      return this.createPseudoterminal(definition);
    });

    const task = new vscode.Task(
      definition,
      workspaceFolder,
      'Benchmark Test Performance',
      'mcp-testing',
      execution
    );

    task.presentationOptions = {
      reveal: vscode.TaskRevealKind.Always,
      panel: vscode.TaskPanelKind.Dedicated,
      clear: true,
    };

    return task;
  }

  /**
   * Create pseudoterminal for task execution
   */
  private createPseudoterminal(definition: TestTaskDefinition): vscode.Pseudoterminal {
    return new TestTaskPseudoterminal(definition, this.mcpClient, this.outputChannel);
  }

  /**
   * Dispose the provider
   */
  public dispose(): void {
    this.tasks = undefined;
  }
}

/**
 * Pseudoterminal for test task execution
 */
class TestTaskPseudoterminal implements vscode.Pseudoterminal {
  private writeEmitter = new vscode.EventEmitter<string>();
  private closeEmitter = new vscode.EventEmitter<number>();

  public readonly onDidWrite = this.writeEmitter.event;
  public readonly onDidClose = this.closeEmitter.event;

  constructor(
    private readonly definition: TestTaskDefinition,
    private readonly mcpClient: MCPTestingClient,
    private readonly outputChannel: vscode.LogOutputChannel
  ) {}

  /**
   * Open the terminal
   */
  public async open(): Promise<void> {
    this.writeLine(`\x1b[1;34m[MCP Testing]\x1b[0m Starting task: ${this.definition.taskType}`);

    try {
      switch (this.definition.taskType) {
        case TestTaskType.RUN_TESTS:
          await this.runTests();
          break;
        case TestTaskType.RUN_COVERAGE:
          await this.runCoverage();
          break;
        case TestTaskType.GENERATE_TESTS:
          await this.generateTests();
          break;
        case TestTaskType.RUN_FLAKY_DETECTION:
          await this.runFlakyDetection();
          break;
        case TestTaskType.RUN_MUTATION_TESTING:
          await this.runMutationTesting();
          break;
        case TestTaskType.RUN_IMPACT_ANALYSIS:
          await this.runImpactAnalysis();
          break;
        case TestTaskType.RUN_PERFORMANCE_BENCHMARK:
          await this.runPerformanceBenchmark();
          break;
        default:
          this.writeLine(`\x1b[1;31m[Error]\x1b[0m Unknown task type: ${this.definition.taskType}`);
          this.closeEmitter.fire(1);
          return;
      }

      this.writeLine(`\x1b[1;32m[Success]\x1b[0m Task completed successfully`);
      this.closeEmitter.fire(0);
    } catch (error) {
      this.writeLine(
        `\x1b[1;31m[Error]\x1b[0m Task failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      this.closeEmitter.fire(1);
    }
  }

  /**
   * Close the terminal
   */
  public close(): void {
    // Cleanup if needed
  }

  /**
   * Run tests
   */
  private async runTests(): Promise<void> {
    this.writeLine('Running tests...');

    const options: any = {
      framework: this.definition.framework,
      testPath: this.definition.testPath,
      pattern: this.definition.pattern,
      watch: this.definition.watch,
      parallel: this.definition.parallel,
      maxWorkers: this.definition.maxWorkers,
      timeout: this.definition.timeout,
    };

    const results = await this.mcpClient.runTests(options);

    // Display results
    this.writeLine(`\nTest Results:`);
    this.writeLine(`  Total: ${results.length}`);
    this.writeLine(`  Passed: ${results.filter((r) => r.status === 'passed').length}`);
    this.writeLine(`  Failed: ${results.filter((r) => r.status === 'failed').length}`);
    this.writeLine(`  Skipped: ${results.filter((r) => r.status === 'skipped').length}`);

    // Display failed tests
    const failed = results.filter((r) => r.status === 'failed');
    if (failed.length > 0) {
      this.writeLine(`\nFailed Tests:`);
      for (const test of failed) {
        this.writeLine(`  \x1b[1;31m✗\x1b[0m ${test.name}`);
        if (test.error) {
          this.writeLine(`    ${test.error.message}`);
        }
      }
    }
  }

  /**
   * Run coverage
   */
  private async runCoverage(): Promise<void> {
    this.writeLine('Running tests with coverage...');

    const options: any = {
      framework: this.definition.framework,
      testPath: this.definition.testPath,
      pattern: this.definition.pattern,
      coverage: true,
    };

    const results = await this.mcpClient.runTests(options);
    const coverage = await this.mcpClient.analyzeCoverage(results);

    // Display coverage results
    this.writeLine(`\nCoverage Results:`);
    this.writeLine(`  Lines: ${coverage.overall.lines.percentage.toFixed(2)}%`);
    this.writeLine(`  Branches: ${coverage.overall.branches.percentage.toFixed(2)}%`);
    this.writeLine(`  Functions: ${coverage.overall.functions.percentage.toFixed(2)}%`);
    this.writeLine(`  Statements: ${coverage.overall.statements.percentage.toFixed(2)}%`);
  }

  /**
   * Generate tests
   */
  private async generateTests(): Promise<void> {
    this.writeLine('Generating tests...');

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw new Error('No active editor');
    }

    const tests = await this.mcpClient.generateTests(editor.document.uri.fsPath);

    this.writeLine(`\nGenerated ${tests.length} test(s):`);
    for (const test of tests) {
      this.writeLine(`  - ${test.name} (${test.type})`);
    }
  }

  /**
   * Run flaky detection
   */
  private async runFlakyDetection(): Promise<void> {
    this.writeLine('Detecting flaky tests...');

    const flakyTests = await this.mcpClient.detectFlakyTests({ iterations: 10 });

    this.writeLine(`\nFound ${flakyTests.length} flaky test(s):`);
    for (const test of flakyTests) {
      this.writeLine(
        `  - ${test.testName} (failure rate: ${(test.failureRate * 100).toFixed(1)}%)`
      );
    }
  }

  /**
   * Run mutation testing
   */
  private async runMutationTesting(): Promise<void> {
    this.writeLine('Running mutation testing...');

    const report = await this.mcpClient.runMutationTesting();

    this.writeLine(`\nMutation Testing Results:`);
    this.writeLine(`  Total Mutations: ${report.totalMutations}`);
    this.writeLine(`  Killed: ${report.killedMutations}`);
    this.writeLine(`  Survived: ${report.survivedMutations}`);
    this.writeLine(`  Mutation Score: ${(report.mutationScore * 100).toFixed(2)}%`);
  }

  /**
   * Run impact analysis
   */
  private async runImpactAnalysis(): Promise<void> {
    this.writeLine('Analyzing test impact...');

    const analysis = await this.mcpClient.analyzeImpact();

    this.writeLine(`\nImpact Analysis Results:`);
    this.writeLine(`  Total Tests: ${analysis.totalTests}`);
    this.writeLine(`  Affected Tests: ${analysis.affectedTests.length}`);
    this.writeLine(`  Affected Percentage: ${analysis.affectedPercentage.toFixed(2)}%`);
  }

  /**
   * Run performance benchmark
   */
  private async runPerformanceBenchmark(): Promise<void> {
    this.writeLine('Benchmarking test performance...');

    const report = await this.mcpClient.benchmarkPerformance();

    this.writeLine(`\nPerformance Benchmark Results:`);
    this.writeLine(`  Total Duration: ${report.totalDuration}ms`);
    this.writeLine(`  Average Duration: ${report.averageDuration}ms`);
    this.writeLine(`  Slow Tests: ${report.slowTests.length}`);

    if (report.slowTests.length > 0) {
      this.writeLine(`\nSlowest Tests:`);
      for (const test of report.slowTests.slice(0, 5)) {
        this.writeLine(`  - ${test.name}: ${test.duration}ms`);
      }
    }
  }

  /**
   * Write a line to the terminal
   */
  private writeLine(message: string): void {
    this.writeEmitter.fire(message + '\r\n');
  }
}
