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
  async runTests(options: TestRunOptions): Promise<TestResult[]> {
    const result = (await this.callTool('test_run', options)) as {
      content: Array<{ type: string; text: string }>;
    };

    // Parse result
    const textContent = result.content.find((c) => c.type === 'text');
    if (!textContent) {
      throw new Error('No text content in response');
    }

    const data = JSON.parse(textContent.text);
    const tests = data.tests || [];

    // Emit events for each test
    for (const test of tests) {
      if (test.status === 'running') {
        this._onTestStarted.fire(test);
      } else {
        this._onTestCompleted.fire(test);
      }
    }

    return tests;
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
  async listTests(): Promise<TestResult[]> {
    const result = (await this.callTool('test_list', {})) as {
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
