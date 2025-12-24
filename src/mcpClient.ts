/**
 * MCPTestingClient - MCP client for testing server
 *
 * Extends BaseMCPClient to provide testing-specific functionality
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  BaseMCPClient,
  LogOutputChannel,
  MCPClientConfig,
} from '@ai-capabilities-suite/mcp-client-base';

/**
 * Test run options
 */
export interface TestRunOptions {
  framework?: string;
  testPath?: string;
  pattern?: string;
  watch?: boolean;
  coverage?: boolean;
  parallel?: boolean;
  maxWorkers?: number;
  timeout?: number;
  env?: Record<string, string>;
}

/**
 * Test result
 */
export interface TestResult {
  id: string;
  name: string;
  fullName: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending' | 'running';
  duration: number;
  error?: {
    message: string;
    stack: string;
    expected?: any;
    actual?: any;
    diff?: string;
  };
  file: string;
  line: number;
  suite: string[];
  tags: string[];
  timestamp: string;
}

/**
 * Coverage report
 */
export interface CoverageReport {
  overall: {
    lines: { total: number; covered: number; percentage: number };
    branches: { total: number; covered: number; percentage: number };
    functions: { total: number; covered: number; percentage: number };
    statements: { total: number; covered: number; percentage: number };
  };
  files: Record<string, any>;
  timestamp: string;
}

/**
 * Generated test
 */
export interface GeneratedTest {
  name: string;
  code: string;
  framework: string;
  type: 'unit' | 'property' | 'integration';
  targetFunction: string;
  targetFile: string;
  description: string;
}

/**
 * MCPTestingClient
 *
 * Client for communicating with the MCP Testing Server
 */
export class MCPTestingClient extends BaseMCPClient {
  private settingsManager?: any;
  private errorHandler?: any;

  // Event emitters
  private readonly _onTestStarted = new vscode.EventEmitter<TestResult>();
  private readonly _onTestCompleted = new vscode.EventEmitter<TestResult>();
  private readonly _onCoverageUpdated = new vscode.EventEmitter<CoverageReport>();

  public readonly onTestStarted = this._onTestStarted.event;
  public readonly onTestCompleted = this._onTestCompleted.event;
  public readonly onCoverageUpdated = this._onCoverageUpdated.event;

  constructor(
    outputChannel: LogOutputChannel,
    settingsManager?: any,
    errorHandler?: any,
    config?: Partial<MCPClientConfig>
  ) {
    super('mcp-testing', outputChannel, config);
    this.settingsManager = settingsManager;
    this.errorHandler = errorHandler;
  }

  /**
   * Get the command to spawn the MCP testing server
   */
  protected getServerCommand(): { command: string; args: string[] } {
    // Get server path from settings or use default
    const serverPath = this.settingsManager?.getSettings()?.server?.serverPath || '';

    let command: string;
    let args: string[] = [];

    if (serverPath && fs.existsSync(serverPath)) {
      // Use custom server path
      command = serverPath;
    } else {
      // Try to find server in workspace
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const localServerPath = path.join(
          workspaceRoot,
          'packages',
          'mcp-testing',
          'dist',
          'index.js'
        );

        if (fs.existsSync(localServerPath)) {
          command = 'node';
          args = [localServerPath];
        } else {
          // Fall back to npx
          command = 'npx';
          args = ['@ai-capabilities-suite/mcp-testing'];
        }
      } else {
        // No workspace, use npx
        command = 'npx';
        args = ['@ai-capabilities-suite/mcp-testing'];
      }
    }

    this.log('info', `Using server command: ${command} ${args.join(' ')}`);
    return { command, args };
  }

  /**
   * Get environment variables for the server
   */
  protected getServerEnv(): Record<string, string> {
    const env = { ...process.env };

    // Add workspace root
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      env.WORKSPACE_ROOT = workspaceFolders[0].uri.fsPath;
    }

    // Add log level from settings
    const logLevel = this.settingsManager?.getSettings()?.server?.logLevel || 'info';
    env.LOG_LEVEL = logLevel;

    return env as Record<string, string>;
  }

  /**
   * Called when server is ready
   */
  protected async onServerReady(): Promise<void> {
    this.log('info', 'MCP Testing server is ready');

    // List available tools
    try {
      const tools = await this.listTools();
      this.log('info', `Available tools: ${tools.length}`);
    } catch (error) {
      this.log(
        'warn',
        `Failed to list tools: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ========== Tool Methods ==========

  /**
   * List available tools
   */
  async listTools(): Promise<any[]> {
    const result = (await this.sendRequest('tools/list', {})) as {
      tools: any[];
    };
    return result.tools || [];
  }

  /**
   * Run tests
   */
  async runTests(options: TestRunOptions): Promise<any> {
    // Add framework if not provided
    const framework = options.framework || this.detectFramework();
    const projectPath = this.getWorkspaceRoot();

    const runOptions = {
      ...options,
      framework,
      projectPath,
    };

    this.outputChannel.info(
      `Running tests with framework: ${framework}, projectPath: ${projectPath}`
    );

    const result = (await this.callTool('test_run', runOptions)) as {
      content: Array<{ type: string; text: string }>;
    };

    // Parse result
    const textContent = result.content.find((c) => c.type === 'text');
    if (!textContent) {
      throw new Error('No text content in response');
    }

    const response = JSON.parse(textContent.text);
    this.outputChannel.info(`Test run response status: ${response.status}`);

    // Handle the response format from the MCP server
    if (response.status === 'success' && response.data) {
      const tests = response.data.results || [];

      // Emit events for each test
      for (const test of tests) {
        if (test.status === 'running') {
          this._onTestStarted.fire(test);
        } else {
          this._onTestCompleted.fire(test);
        }
      }

      return response;
    } else if (response.status === 'error') {
      this.outputChannel.error(`Test run error: ${response.error?.message || 'Unknown error'}`);
      return response;
    }

    return response;
  }

  /**
   * Stop running tests
   */
  async stopTests(runId: string): Promise<void> {
    await this.callTool('test_stop', { runId });
  }

  /**
   * List all tests
   */
  async listTests(framework?: string): Promise<TestResult[]> {
    // Get framework from parameter or try to detect it
    const testFramework = framework || this.detectFramework();

    this.outputChannel.info(
      `Calling test_list with framework: ${testFramework}, projectPath: ${this.getWorkspaceRoot()}`
    );

    const result = (await this.callTool('test_list', {
      framework: testFramework,
      projectPath: this.getWorkspaceRoot(),
    })) as {
      content: Array<{ type: string; text: string }>;
    };

    const textContent = result.content.find((c) => c.type === 'text');
    if (!textContent) {
      throw new Error('No text content in response');
    }

    const response = JSON.parse(textContent.text);

    // Handle both response formats
    if (response.status === 'success' && response.data) {
      this.outputChannel.info(`Found ${response.data.tests?.length || 0} tests`);
      return response.data.tests || [];
    } else if (response.tests) {
      this.outputChannel.info(`Found ${response.tests.length} tests`);
      return response.tests;
    } else {
      this.outputChannel.warn(`Unexpected response format from test_list`);
      return [];
    }
  }

  /**
   * Detect test framework from workspace
   */
  private detectFramework(): string {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      return 'jest'; // Default fallback
    }

    const fs = require('fs');
    const path = require('path');

    // Check for framework-specific config files
    const frameworkIndicators = [
      { file: 'jest.config.js', framework: 'jest' },
      { file: 'jest.config.ts', framework: 'jest' },
      { file: 'jest.config.json', framework: 'jest' },
      { file: 'vitest.config.js', framework: 'vitest' },
      { file: 'vitest.config.ts', framework: 'vitest' },
      { file: '.mocharc.json', framework: 'mocha' },
      { file: '.mocharc.js', framework: 'mocha' },
      { file: 'pytest.ini', framework: 'pytest' },
      { file: 'setup.cfg', framework: 'pytest' },
    ];

    for (const { file, framework } of frameworkIndicators) {
      if (fs.existsSync(path.join(workspaceRoot, file))) {
        this.outputChannel.info(`Detected test framework: ${framework} (found ${file})`);
        return framework;
      }
    }

    // Check package.json for test script or dependencies
    const packageJsonPath = path.join(workspaceRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const deps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        if (deps.vitest) {
          this.outputChannel.info('Detected test framework: vitest (from package.json)');
          return 'vitest';
        }
        if (deps.jest || deps['@jest/core']) {
          this.outputChannel.info('Detected test framework: jest (from package.json)');
          return 'jest';
        }
        if (deps.mocha) {
          this.outputChannel.info('Detected test framework: mocha (from package.json)');
          return 'mocha';
        }
      } catch (error) {
        this.outputChannel.warn(`Failed to parse package.json: ${error}`);
      }
    }

    this.outputChannel.info('No test framework detected, using default: jest');
    return 'jest';
  }

  /**
   * Get workspace root path
   */
  private getWorkspaceRoot(): string | undefined {
    const workspaceFolders = require('vscode').workspace.workspaceFolders;
    return workspaceFolders && workspaceFolders.length > 0
      ? workspaceFolders[0].uri.fsPath
      : undefined;
  }

  /**
   * Search tests
   */
  async searchTests(query: string): Promise<TestResult[]> {
    const result = (await this.callTool('test_search', { query })) as {
      content: Array<{ type: string; text: string }>;
    };

    const textContent = result.content.find((c) => c.type === 'text');
    if (!textContent) {
      throw new Error('No text content in response');
    }

    const data = JSON.parse(textContent.text);
    return data.tests || [];
  }

  /**
   * Analyze coverage
   */
  async analyzeCoverage(testResults: TestResult[]): Promise<CoverageReport> {
    const result = (await this.callTool('test_coverage_analyze', {
      testResults,
    })) as {
      content: Array<{ type: string; text: string }>;
    };

    const textContent = result.content.find((c) => c.type === 'text');
    if (!textContent) {
      throw new Error('No text content in response');
    }

    const coverage = JSON.parse(textContent.text);
    this._onCoverageUpdated.fire(coverage);
    return coverage;
  }

  /**
   * Get coverage gaps
   */
  async getCoverageGaps(): Promise<any[]> {
    const result = (await this.callTool('test_coverage_gaps', {})) as {
      content: Array<{ type: string; text: string }>;
    };

    const textContent = result.content.find((c) => c.type === 'text');
    if (!textContent) {
      throw new Error('No text content in response');
    }

    const data = JSON.parse(textContent.text);
    return data.gaps || [];
  }

  /**
   * Generate tests
   */
  async generateTests(filePath: string): Promise<GeneratedTest[]> {
    const result = (await this.callTool('test_generate_from_code', {
      filePath,
    })) as {
      content: Array<{ type: string; text: string }>;
    };

    const textContent = result.content.find((c) => c.type === 'text');
    if (!textContent) {
      throw new Error('No text content in response');
    }

    const data = JSON.parse(textContent.text);
    return data.tests || [];
  }

  /**
   * Debug test
   */
  async debugTest(testId: string): Promise<void> {
    await this.callTool('test_debug', { testId });
  }

  /**
   * Analyze test failure
   */
  async analyzeFailure(testId: string): Promise<any> {
    const result = (await this.callTool('test_analyze_failure', {
      testId,
    })) as {
      content: Array<{ type: string; text: string }>;
    };

    const textContent = result.content.find((c) => c.type === 'text');
    if (!textContent) {
      throw new Error('No text content in response');
    }

    return JSON.parse(textContent.text);
  }

  /**
   * Detect flaky tests
   */
  async detectFlakyTests(options?: { iterations?: number }): Promise<any[]> {
    const result = (await this.callTool('test_detect_flaky', options || {})) as {
      content: Array<{ type: string; text: string }>;
    };

    const textContent = result.content.find((c) => c.type === 'text');
    if (!textContent) {
      throw new Error('No text content in response');
    }

    const data = JSON.parse(textContent.text);
    return data.flakyTests || [];
  }

  /**
   * Run mutation testing
   */
  async runMutationTesting(options?: { filePath?: string }): Promise<any> {
    const result = (await this.callTool('test_mutation_run', options || {})) as {
      content: Array<{ type: string; text: string }>;
    };

    const textContent = result.content.find((c) => c.type === 'text');
    if (!textContent) {
      throw new Error('No text content in response');
    }

    return JSON.parse(textContent.text);
  }

  /**
   * Analyze test impact
   */
  async analyzeImpact(changes?: any[]): Promise<any> {
    const result = (await this.callTool('test_impact_analyze', {
      changes: changes || [],
    })) as {
      content: Array<{ type: string; text: string }>;
    };

    const textContent = result.content.find((c) => c.type === 'text');
    if (!textContent) {
      throw new Error('No text content in response');
    }

    return JSON.parse(textContent.text);
  }

  /**
   * Benchmark test performance
   */
  async benchmarkPerformance(): Promise<any> {
    const result = (await this.callTool('test_performance_benchmark', {})) as {
      content: Array<{ type: string; text: string }>;
    };

    const textContent = result.content.find((c) => c.type === 'text');
    if (!textContent) {
      throw new Error('No text content in response');
    }

    return JSON.parse(textContent.text);
  }

  /**
   * Get test configuration
   */
  async getConfig(): Promise<any> {
    const result = (await this.callTool('test_get_config', {})) as {
      content: Array<{ type: string; text: string }>;
    };

    const textContent = result.content.find((c) => c.type === 'text');
    if (!textContent) {
      throw new Error('No text content in response');
    }

    return JSON.parse(textContent.text);
  }

  /**
   * Set test configuration
   */
  async setConfig(config: any): Promise<void> {
    await this.callTool('test_set_config', { config });
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this._onTestStarted.dispose();
    this._onTestCompleted.dispose();
    this._onCoverageUpdated.dispose();
    this.stop();
  }
}
