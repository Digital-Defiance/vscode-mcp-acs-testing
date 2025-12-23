/**
 * Test Debug Configuration Provider
 *
 * Provides debug configurations for running tests with debugging support
 */

import * as vscode from 'vscode';
import { MCPTestingClient } from './mcpClient';

/**
 * Test Debug Configuration Provider
 *
 * Creates debug configurations for tests and integrates with mcp-debugger-server
 */
export class TestDebugConfigurationProvider
  implements vscode.DebugConfigurationProvider, vscode.Disposable
{
  constructor(
    private readonly mcpClient: MCPTestingClient,
    private readonly outputChannel: vscode.LogOutputChannel
  ) {}

  /**
   * Provide debug configurations
   */
  public async provideDebugConfigurations(
    folder: vscode.WorkspaceFolder | undefined
  ): Promise<vscode.DebugConfiguration[]> {
    const configs: vscode.DebugConfiguration[] = [];

    // Detect test framework
    const framework = await this.detectFramework(folder);

    if (!framework) {
      return configs;
    }

    // Create framework-specific debug configurations
    switch (framework) {
      case 'jest':
        configs.push(...this.createJestDebugConfigs(folder));
        break;
      case 'mocha':
        configs.push(...this.createMochaDebugConfigs(folder));
        break;
      case 'vitest':
        configs.push(...this.createVitestDebugConfigs(folder));
        break;
      case 'pytest':
        configs.push(...this.createPytestDebugConfigs(folder));
        break;
    }

    return configs;
  }

  /**
   * Resolve debug configuration
   */
  public async resolveDebugConfiguration(
    folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
    token?: vscode.CancellationToken
  ): Promise<vscode.DebugConfiguration | undefined> {
    // If no configuration is provided, create a default one
    if (!config.type && !config.request && !config.name) {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor to debug');
        return undefined;
      }

      // Detect framework
      const framework = await this.detectFramework(folder);
      if (!framework) {
        vscode.window.showErrorMessage('Could not detect test framework');
        return undefined;
      }

      // Create default configuration based on framework
      config = this.createDefaultDebugConfig(framework, editor.document.uri.fsPath, folder);
    }

    // Ensure required fields are set
    if (!config.type) {
      config.type = 'node';
    }

    if (!config.request) {
      config.request = 'launch';
    }

    // Add MCP debugger integration
    if (config.mcpDebugger !== false) {
      await this.integrateMCPDebugger(config);
    }

    return config;
  }

  /**
   * Resolve debug configuration with substituted variables
   */
  public async resolveDebugConfigurationWithSubstitutedVariables(
    folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
    token?: vscode.CancellationToken
  ): Promise<vscode.DebugConfiguration | undefined> {
    // Perform any final variable substitutions
    return config;
  }

  /**
   * Detect test framework
   */
  private async detectFramework(
    folder: vscode.WorkspaceFolder | undefined
  ): Promise<string | undefined> {
    if (!folder) {
      return undefined;
    }

    try {
      // Try to detect framework from package.json
      const packageJsonUri = vscode.Uri.joinPath(folder.uri, 'package.json');
      const packageJsonContent = await vscode.workspace.fs.readFile(packageJsonUri);
      const packageJson = JSON.parse(packageJsonContent.toString());

      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      if (dependencies.jest) {
        return 'jest';
      }
      if (dependencies.mocha) {
        return 'mocha';
      }
      if (dependencies.vitest) {
        return 'vitest';
      }
      if (dependencies.pytest) {
        return 'pytest';
      }
    } catch (error) {
      this.outputChannel.error(`Failed to detect framework: ${error}`);
    }

    return undefined;
  }

  /**
   * Create Jest debug configurations
   */
  private createJestDebugConfigs(
    folder: vscode.WorkspaceFolder | undefined
  ): vscode.DebugConfiguration[] {
    const configs: vscode.DebugConfiguration[] = [];

    // Debug all tests
    configs.push({
      type: 'node',
      request: 'launch',
      name: 'Jest: Debug All Tests',
      program: '${workspaceFolder}/node_modules/.bin/jest',
      args: ['--runInBand', '--no-cache', '--watchAll=false'],
      console: 'integratedTerminal',
      internalConsoleOptions: 'neverOpen',
      disableOptimisticBPs: true,
      windows: {
        program: '${workspaceFolder}/node_modules/jest/bin/jest',
      },
    });

    // Debug current file
    configs.push({
      type: 'node',
      request: 'launch',
      name: 'Jest: Debug Current File',
      program: '${workspaceFolder}/node_modules/.bin/jest',
      args: ['${fileBasenameNoExtension}', '--runInBand', '--no-cache', '--watchAll=false'],
      console: 'integratedTerminal',
      internalConsoleOptions: 'neverOpen',
      disableOptimisticBPs: true,
      windows: {
        program: '${workspaceFolder}/node_modules/jest/bin/jest',
      },
    });

    // Debug with coverage
    configs.push({
      type: 'node',
      request: 'launch',
      name: 'Jest: Debug with Coverage',
      program: '${workspaceFolder}/node_modules/.bin/jest',
      args: ['--runInBand', '--no-cache', '--watchAll=false', '--coverage'],
      console: 'integratedTerminal',
      internalConsoleOptions: 'neverOpen',
      disableOptimisticBPs: true,
      windows: {
        program: '${workspaceFolder}/node_modules/jest/bin/jest',
      },
    });

    return configs;
  }

  /**
   * Create Mocha debug configurations
   */
  private createMochaDebugConfigs(
    folder: vscode.WorkspaceFolder | undefined
  ): vscode.DebugConfiguration[] {
    const configs: vscode.DebugConfiguration[] = [];

    // Debug all tests
    configs.push({
      type: 'node',
      request: 'launch',
      name: 'Mocha: Debug All Tests',
      program: '${workspaceFolder}/node_modules/.bin/mocha',
      args: ['--timeout', '999999', '--colors', '${workspaceFolder}/test/**/*.test.js'],
      console: 'integratedTerminal',
      internalConsoleOptions: 'neverOpen',
    });

    // Debug current file
    configs.push({
      type: 'node',
      request: 'launch',
      name: 'Mocha: Debug Current File',
      program: '${workspaceFolder}/node_modules/.bin/mocha',
      args: ['--timeout', '999999', '--colors', '${file}'],
      console: 'integratedTerminal',
      internalConsoleOptions: 'neverOpen',
    });

    return configs;
  }

  /**
   * Create Vitest debug configurations
   */
  private createVitestDebugConfigs(
    folder: vscode.WorkspaceFolder | undefined
  ): vscode.DebugConfiguration[] {
    const configs: vscode.DebugConfiguration[] = [];

    // Debug all tests
    configs.push({
      type: 'node',
      request: 'launch',
      name: 'Vitest: Debug All Tests',
      program: '${workspaceFolder}/node_modules/.bin/vitest',
      args: ['--run', '--no-coverage'],
      console: 'integratedTerminal',
      internalConsoleOptions: 'neverOpen',
    });

    // Debug current file
    configs.push({
      type: 'node',
      request: 'launch',
      name: 'Vitest: Debug Current File',
      program: '${workspaceFolder}/node_modules/.bin/vitest',
      args: ['--run', '--no-coverage', '${file}'],
      console: 'integratedTerminal',
      internalConsoleOptions: 'neverOpen',
    });

    return configs;
  }

  /**
   * Create Pytest debug configurations
   */
  private createPytestDebugConfigs(
    folder: vscode.WorkspaceFolder | undefined
  ): vscode.DebugConfiguration[] {
    const configs: vscode.DebugConfiguration[] = [];

    // Debug all tests
    configs.push({
      type: 'python',
      request: 'launch',
      name: 'Pytest: Debug All Tests',
      module: 'pytest',
      args: ['-v'],
      console: 'integratedTerminal',
      justMyCode: false,
    });

    // Debug current file
    configs.push({
      type: 'python',
      request: 'launch',
      name: 'Pytest: Debug Current File',
      module: 'pytest',
      args: ['-v', '${file}'],
      console: 'integratedTerminal',
      justMyCode: false,
    });

    return configs;
  }

  /**
   * Create default debug configuration
   */
  private createDefaultDebugConfig(
    framework: string,
    filePath: string,
    folder: vscode.WorkspaceFolder | undefined
  ): vscode.DebugConfiguration {
    switch (framework) {
      case 'jest':
        return {
          type: 'node',
          request: 'launch',
          name: 'Jest: Debug Current Test',
          program: '${workspaceFolder}/node_modules/.bin/jest',
          args: ['${fileBasenameNoExtension}', '--runInBand', '--no-cache', '--watchAll=false'],
          console: 'integratedTerminal',
          internalConsoleOptions: 'neverOpen',
          disableOptimisticBPs: true,
          windows: {
            program: '${workspaceFolder}/node_modules/jest/bin/jest',
          },
        };

      case 'mocha':
        return {
          type: 'node',
          request: 'launch',
          name: 'Mocha: Debug Current Test',
          program: '${workspaceFolder}/node_modules/.bin/mocha',
          args: ['--timeout', '999999', '--colors', '${file}'],
          console: 'integratedTerminal',
          internalConsoleOptions: 'neverOpen',
        };

      case 'vitest':
        return {
          type: 'node',
          request: 'launch',
          name: 'Vitest: Debug Current Test',
          program: '${workspaceFolder}/node_modules/.bin/vitest',
          args: ['--run', '--no-coverage', '${file}'],
          console: 'integratedTerminal',
          internalConsoleOptions: 'neverOpen',
        };

      case 'pytest':
        return {
          type: 'python',
          request: 'launch',
          name: 'Pytest: Debug Current Test',
          module: 'pytest',
          args: ['-v', '${file}'],
          console: 'integratedTerminal',
          justMyCode: false,
        };

      default:
        return {
          type: 'node',
          request: 'launch',
          name: 'Debug Test',
          program: '${file}',
          console: 'integratedTerminal',
        };
    }
  }

  /**
   * Integrate with MCP debugger server
   */
  private async integrateMCPDebugger(config: vscode.DebugConfiguration): Promise<void> {
    try {
      // Add MCP debugger integration
      // This will be called when a test fails and debugging is requested
      config.postDebugTask = {
        type: 'mcp-testing',
        command: 'notifyDebuggerServer',
      };

      // Store debug session info for MCP debugger integration
      config.env = config.env || {};
      config.env.MCP_DEBUGGER_ENABLED = 'true';

      this.outputChannel.info('MCP debugger integration enabled for debug session');
    } catch (error) {
      this.outputChannel.error(`Failed to integrate MCP debugger: ${error}`);
    }
  }

  /**
   * Handle debug session start
   */
  public async onDebugSessionStart(session: vscode.DebugSession): Promise<void> {
    this.outputChannel.info(`Debug session started: ${session.name}`);

    // Notify MCP client about debug session
    try {
      // Get test information from the debug configuration
      const config = session.configuration;

      if (config.type === 'node' || config.type === 'python') {
        // Extract test file path
        const testFile = config.args?.find(
          (arg: string) => arg.includes('.test.') || arg.includes('_test.')
        );

        if (testFile) {
          this.outputChannel.info(`Debugging test file: ${testFile}`);

          // Notify MCP debugger server
          // This would integrate with mcp-debugger-server to provide
          // enhanced debugging capabilities
        }
      }
    } catch (error) {
      this.outputChannel.error(`Failed to handle debug session start: ${error}`);
    }
  }

  /**
   * Handle debug session stop
   */
  public async onDebugSessionStop(session: vscode.DebugSession): Promise<void> {
    this.outputChannel.info(`Debug session stopped: ${session.name}`);
  }

  /**
   * Dispose the provider
   */
  public dispose(): void {
    // Cleanup if needed
  }
}
