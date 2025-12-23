/**
 * Settings Manager
 *
 * Manages extension configuration settings with validation and change handling
 */

import * as vscode from 'vscode';

/**
 * Type-safe configuration interface
 */
export interface MCPTestingConfiguration {
  // Server settings
  server: {
    serverPath: string;
    autoStart: boolean;
    timeout: number;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    retryAttempts: number;
    retryDelay: number;
  };

  // Test settings
  test: {
    defaultFramework: 'jest' | 'mocha' | 'pytest' | 'vitest' | 'jasmine' | 'ava' | 'auto';
    defaultTimeout: number;
    maxParallelTests: number;
    autoRun: boolean;
    autoRunDelay: number;
    watchMode: boolean;
    runOnSave: boolean;
    clearConsoleOnRun: boolean;
    showInlineResults: boolean;
    testPathPatterns: string[];
    testPathIgnorePatterns: string[];
  };

  // Coverage settings
  coverage: {
    enabled: boolean;
    showInEditor: boolean;
    showGutterIcons: boolean;
    showLineHighlights: boolean;
    heatMapMode: boolean;
    thresholds: {
      lines: number;
      branches: number;
      functions: number;
      statements: number;
    };
    reportFormats: Array<'json' | 'html' | 'lcov' | 'cobertura' | 'text'>;
    outputDirectory: string;
    collectFrom: string[];
    excludePatterns: string[];
    trackTrends: boolean;
    trendHistorySize: number;
  };

  // Test generation settings
  testGeneration: {
    enabled: boolean;
    autoSuggest: boolean;
    includeEdgeCases: boolean;
    includePropertyTests: boolean;
    followProjectPatterns: boolean;
    testFileLocation: 'adjacent' | 'testDirectory' | 'ask';
    testDirectory: string;
  };

  // Debugging settings
  debugging: {
    enabled: boolean;
    autoStartDebugger: boolean;
    breakOnFailure: boolean;
    showVariables: boolean;
    showCallStack: boolean;
    suggestRootCauses: boolean;
  };

  // Flaky test settings
  flaky: {
    detectionEnabled: boolean;
    detectionIterations: number;
    failureRateThreshold: number;
    autoAnalyze: boolean;
    suggestFixes: boolean;
    trackHistory: boolean;
  };

  // Mutation testing settings
  mutation: {
    enabled: boolean;
    mutationTypes: Array<
      | 'arithmetic_operator'
      | 'relational_operator'
      | 'logical_operator'
      | 'unary_operator'
      | 'assignment_operator'
      | 'return_value'
      | 'conditional'
      | 'literal'
    >;
    scoreThreshold: number;
    timeout: number;
  };

  // Impact analysis settings
  impact: {
    enabled: boolean;
    useGitDiff: boolean;
    useCoverageData: boolean;
    useImportAnalysis: boolean;
    runAffectedOnly: boolean;
  };

  // Performance settings
  performance: {
    enabled: boolean;
    slowTestThreshold: number;
    trackTrends: boolean;
    detectRegressions: boolean;
    regressionThreshold: number;
    suggestOptimizations: boolean;
  };

  // Visual regression settings
  visualRegression: {
    enabled: boolean;
    threshold: number;
    baselineDirectory: string;
    diffDirectory: string;
    updateBaselines: boolean;
  };

  // Security settings
  security: {
    enableAuditLog: boolean;
    auditLogPath: string;
    allowedFrameworks: string[];
    maxCpuPercent: number;
    maxMemoryMB: number;
    blockShellCommands: boolean;
  };

  // UI settings
  ui: {
    showNotifications: boolean;
    notificationLevel: 'all' | 'failures' | 'none';
    autoRefreshInterval: number;
    showStatusBar: boolean;
    statusBarPosition: 'left' | 'right';
    showCodeLens: boolean;
    codeLensPosition: 'above' | 'inline';
    showDiagnostics: boolean;
    diagnosticSeverity: {
      testFailure: 'error' | 'warning' | 'information';
      coverageGap: 'error' | 'warning' | 'information';
      flakyTest: 'error' | 'warning' | 'information';
    };
    treeViewGrouping: 'file' | 'suite' | 'tag' | 'status';
    treeViewSorting: 'name' | 'duration' | 'status' | 'recent';
    webviewTheme: 'auto' | 'light' | 'dark';
    showWelcomeMessage: boolean;
  };

  // Advanced settings
  advanced: {
    cacheEnabled: boolean;
    cacheTTL: number;
    enableExperimentalFeatures: boolean;
    telemetryEnabled: boolean;
    debugMode: boolean;
  };
}

/**
 * Settings Manager class
 */
export class SettingsManager {
  private static instance: SettingsManager | undefined;
  private configuration: MCPTestingConfiguration;
  private changeEmitter = new vscode.EventEmitter<MCPTestingConfiguration>();
  private disposables: vscode.Disposable[] = [];

  /**
   * Event fired when configuration changes
   */
  public readonly onDidChangeConfiguration = this.changeEmitter.event;

  private constructor(private outputChannel: vscode.LogOutputChannel) {
    this.configuration = this.loadConfiguration();

    // Watch for configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('mcp-testing')) {
          this.handleConfigurationChange(e);
        }
      })
    );

    this.disposables.push(this.changeEmitter);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(outputChannel: vscode.LogOutputChannel): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager(outputChannel);
    }
    return SettingsManager.instance;
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): Readonly<MCPTestingConfiguration> {
    return this.configuration;
  }

  /**
   * Get a specific configuration value
   */
  public get<K extends keyof MCPTestingConfiguration>(
    section: K
  ): Readonly<MCPTestingConfiguration[K]> {
    return this.configuration[section];
  }

  /**
   * Get a nested configuration value
   */
  public getValue<
    K extends keyof MCPTestingConfiguration,
    T extends keyof MCPTestingConfiguration[K]
  >(section: K, key: T): MCPTestingConfiguration[K][T] {
    return this.configuration[section][key];
  }

  /**
   * Update a configuration value
   */
  public async updateValue<
    K extends keyof MCPTestingConfiguration,
    T extends keyof MCPTestingConfiguration[K]
  >(
    section: K,
    key: T,
    value: MCPTestingConfiguration[K][T],
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration('mcp-testing');
    const configKey = `${String(section)}.${String(key)}`;

    try {
      await config.update(configKey, value, target);
      this.outputChannel.info(`Updated configuration: ${configKey} = ${JSON.stringify(value)}`);
    } catch (error) {
      this.outputChannel.error(
        `Failed to update configuration ${configKey}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  /**
   * Reset configuration to defaults
   */
  public async resetToDefaults(
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration('mcp-testing');
    const keys = Object.keys(config);

    for (const key of keys) {
      try {
        await config.update(key, undefined, target);
      } catch (error) {
        this.outputChannel.error(
          `Failed to reset configuration ${key}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    this.outputChannel.info('Configuration reset to defaults');
  }

  /**
   * Validate configuration values
   */
  public validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate server settings
    if (this.configuration.server.timeout < 1000 || this.configuration.server.timeout > 300000) {
      errors.push('Server timeout must be between 1000 and 300000 ms');
    }

    if (
      this.configuration.server.retryAttempts < 0 ||
      this.configuration.server.retryAttempts > 10
    ) {
      errors.push('Server retry attempts must be between 0 and 10');
    }

    // Validate test settings
    if (
      this.configuration.test.defaultTimeout < 100 ||
      this.configuration.test.defaultTimeout > 300000
    ) {
      errors.push('Test timeout must be between 100 and 300000 ms');
    }

    if (
      this.configuration.test.maxParallelTests < 1 ||
      this.configuration.test.maxParallelTests > 32
    ) {
      errors.push('Max parallel tests must be between 1 and 32');
    }

    // Validate coverage thresholds
    const { thresholds } = this.configuration.coverage;
    if (
      thresholds.lines < 0 ||
      thresholds.lines > 100 ||
      thresholds.branches < 0 ||
      thresholds.branches > 100 ||
      thresholds.functions < 0 ||
      thresholds.functions > 100 ||
      thresholds.statements < 0 ||
      thresholds.statements > 100
    ) {
      errors.push('Coverage thresholds must be between 0 and 100');
    }

    // Validate flaky detection settings
    if (
      this.configuration.flaky.detectionIterations < 2 ||
      this.configuration.flaky.detectionIterations > 100
    ) {
      errors.push('Flaky detection iterations must be between 2 and 100');
    }

    if (
      this.configuration.flaky.failureRateThreshold < 0 ||
      this.configuration.flaky.failureRateThreshold > 1
    ) {
      errors.push('Flaky failure rate threshold must be between 0 and 1');
    }

    // Validate mutation testing settings
    if (
      this.configuration.mutation.scoreThreshold < 0 ||
      this.configuration.mutation.scoreThreshold > 100
    ) {
      errors.push('Mutation score threshold must be between 0 and 100');
    }

    // Validate performance settings
    if (
      this.configuration.performance.slowTestThreshold < 100 ||
      this.configuration.performance.slowTestThreshold > 60000
    ) {
      errors.push('Slow test threshold must be between 100 and 60000 ms');
    }

    if (
      this.configuration.performance.regressionThreshold < 1.0 ||
      this.configuration.performance.regressionThreshold > 10.0
    ) {
      errors.push('Performance regression threshold must be between 1.0 and 10.0');
    }

    // Validate visual regression settings
    if (
      this.configuration.visualRegression.threshold < 0 ||
      this.configuration.visualRegression.threshold > 1
    ) {
      errors.push('Visual regression threshold must be between 0 and 1');
    }

    // Validate security settings
    if (
      this.configuration.security.maxCpuPercent < 10 ||
      this.configuration.security.maxCpuPercent > 100
    ) {
      errors.push('Max CPU percent must be between 10 and 100');
    }

    if (
      this.configuration.security.maxMemoryMB < 128 ||
      this.configuration.security.maxMemoryMB > 16384
    ) {
      errors.push('Max memory must be between 128 and 16384 MB');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Load configuration from workspace settings
   */
  private loadConfiguration(): MCPTestingConfiguration {
    const config = vscode.workspace.getConfiguration('mcp-testing');

    return {
      server: {
        serverPath: config.get('server.serverPath', ''),
        autoStart: config.get('server.autoStart', true),
        timeout: config.get('server.timeout', 30000),
        logLevel: config.get('server.logLevel', 'info'),
        retryAttempts: config.get('server.retryAttempts', 3),
        retryDelay: config.get('server.retryDelay', 1000),
      },
      test: {
        defaultFramework: config.get('test.defaultFramework', 'auto'),
        defaultTimeout: config.get('test.defaultTimeout', 5000),
        maxParallelTests: config.get('test.maxParallelTests', 4),
        autoRun: config.get('test.autoRun', false),
        autoRunDelay: config.get('test.autoRunDelay', 1000),
        watchMode: config.get('test.watchMode', false),
        runOnSave: config.get('test.runOnSave', false),
        clearConsoleOnRun: config.get('test.clearConsoleOnRun', true),
        showInlineResults: config.get('test.showInlineResults', true),
        testPathPatterns: config.get('test.testPathPatterns', [
          '**/*.test.{js,ts,jsx,tsx}',
          '**/*.spec.{js,ts,jsx,tsx}',
          '**/test_*.py',
          '**/*_test.py',
        ]),
        testPathIgnorePatterns: config.get('test.testPathIgnorePatterns', [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.venv/**',
          '**/venv/**',
        ]),
      },
      coverage: {
        enabled: config.get('coverage.enabled', true),
        showInEditor: config.get('coverage.showInEditor', true),
        showGutterIcons: config.get('coverage.showGutterIcons', true),
        showLineHighlights: config.get('coverage.showLineHighlights', false),
        heatMapMode: config.get('coverage.heatMapMode', false),
        thresholds: config.get('coverage.thresholds', {
          lines: 80,
          branches: 75,
          functions: 85,
          statements: 80,
        }),
        reportFormats: config.get('coverage.reportFormats', ['json', 'html']),
        outputDirectory: config.get('coverage.outputDirectory', 'coverage'),
        collectFrom: config.get('coverage.collectFrom', [
          'src/**/*.{js,ts,jsx,tsx}',
          'lib/**/*.py',
        ]),
        excludePatterns: config.get('coverage.excludePatterns', [
          '**/*.test.{js,ts,jsx,tsx}',
          '**/*.spec.{js,ts,jsx,tsx}',
          '**/test_*.py',
          '**/*_test.py',
          '**/node_modules/**',
        ]),
        trackTrends: config.get('coverage.trackTrends', true),
        trendHistorySize: config.get('coverage.trendHistorySize', 30),
      },
      testGeneration: {
        enabled: config.get('testGeneration.enabled', true),
        autoSuggest: config.get('testGeneration.autoSuggest', true),
        includeEdgeCases: config.get('testGeneration.includeEdgeCases', true),
        includePropertyTests: config.get('testGeneration.includePropertyTests', true),
        followProjectPatterns: config.get('testGeneration.followProjectPatterns', true),
        testFileLocation: config.get('testGeneration.testFileLocation', 'adjacent'),
        testDirectory: config.get('testGeneration.testDirectory', 'test'),
      },
      debugging: {
        enabled: config.get('debugging.enabled', true),
        autoStartDebugger: config.get('debugging.autoStartDebugger', false),
        breakOnFailure: config.get('debugging.breakOnFailure', true),
        showVariables: config.get('debugging.showVariables', true),
        showCallStack: config.get('debugging.showCallStack', true),
        suggestRootCauses: config.get('debugging.suggestRootCauses', true),
      },
      flaky: {
        detectionEnabled: config.get('flaky.detectionEnabled', true),
        detectionIterations: config.get('flaky.detectionIterations', 10),
        failureRateThreshold: config.get('flaky.failureRateThreshold', 0.1),
        autoAnalyze: config.get('flaky.autoAnalyze', true),
        suggestFixes: config.get('flaky.suggestFixes', true),
        trackHistory: config.get('flaky.trackHistory', true),
      },
      mutation: {
        enabled: config.get('mutation.enabled', false),
        mutationTypes: config.get('mutation.mutationTypes', [
          'arithmetic_operator',
          'relational_operator',
          'logical_operator',
          'conditional',
        ]),
        scoreThreshold: config.get('mutation.scoreThreshold', 80),
        timeout: config.get('mutation.timeout', 10000),
      },
      impact: {
        enabled: config.get('impact.enabled', true),
        useGitDiff: config.get('impact.useGitDiff', true),
        useCoverageData: config.get('impact.useCoverageData', true),
        useImportAnalysis: config.get('impact.useImportAnalysis', true),
        runAffectedOnly: config.get('impact.runAffectedOnly', false),
      },
      performance: {
        enabled: config.get('performance.enabled', true),
        slowTestThreshold: config.get('performance.slowTestThreshold', 1000),
        trackTrends: config.get('performance.trackTrends', true),
        detectRegressions: config.get('performance.detectRegressions', true),
        regressionThreshold: config.get('performance.regressionThreshold', 1.5),
        suggestOptimizations: config.get('performance.suggestOptimizations', true),
      },
      visualRegression: {
        enabled: config.get('visualRegression.enabled', false),
        threshold: config.get('visualRegression.threshold', 0.1),
        baselineDirectory: config.get(
          'visualRegression.baselineDirectory',
          '__screenshots__/baseline'
        ),
        diffDirectory: config.get('visualRegression.diffDirectory', '__screenshots__/diff'),
        updateBaselines: config.get('visualRegression.updateBaselines', false),
      },
      security: {
        enableAuditLog: config.get('security.enableAuditLog', true),
        auditLogPath: config.get('security.auditLogPath', '.mcp-testing/audit.log'),
        allowedFrameworks: config.get('security.allowedFrameworks', [
          'jest',
          'mocha',
          'pytest',
          'vitest',
          'jasmine',
          'ava',
        ]),
        maxCpuPercent: config.get('security.maxCpuPercent', 80),
        maxMemoryMB: config.get('security.maxMemoryMB', 2048),
        blockShellCommands: config.get('security.blockShellCommands', true),
      },
      ui: {
        showNotifications: config.get('ui.showNotifications', true),
        notificationLevel: config.get('ui.notificationLevel', 'failures'),
        autoRefreshInterval: config.get('ui.autoRefreshInterval', 5000),
        showStatusBar: config.get('ui.showStatusBar', true),
        statusBarPosition: config.get('ui.statusBarPosition', 'left'),
        showCodeLens: config.get('ui.showCodeLens', true),
        codeLensPosition: config.get('ui.codeLensPosition', 'above'),
        showDiagnostics: config.get('ui.showDiagnostics', true),
        diagnosticSeverity: config.get('ui.diagnosticSeverity', {
          testFailure: 'error',
          coverageGap: 'warning',
          flakyTest: 'warning',
        }),
        treeViewGrouping: config.get('ui.treeViewGrouping', 'file'),
        treeViewSorting: config.get('ui.treeViewSorting', 'name'),
        webviewTheme: config.get('ui.webviewTheme', 'auto'),
        showWelcomeMessage: config.get('ui.showWelcomeMessage', true),
      },
      advanced: {
        cacheEnabled: config.get('advanced.cacheEnabled', true),
        cacheTTL: config.get('advanced.cacheTTL', 300000),
        enableExperimentalFeatures: config.get('advanced.enableExperimentalFeatures', false),
        telemetryEnabled: config.get('advanced.telemetryEnabled', true),
        debugMode: config.get('advanced.debugMode', false),
      },
    };
  }

  /**
   * Handle configuration changes
   */
  private handleConfigurationChange(e: vscode.ConfigurationChangeEvent): void {
    this.outputChannel.info('Configuration changed, reloading...');

    const oldConfig = this.configuration;
    this.configuration = this.loadConfiguration();

    // Validate new configuration
    const validation = this.validateConfiguration();
    if (!validation.valid) {
      this.outputChannel.warn(`Configuration validation warnings: ${validation.errors.join(', ')}`);
      vscode.window.showWarningMessage(
        `MCP Testing configuration has validation warnings: ${validation.errors.join(', ')}`
      );
    }

    // Check for critical changes that require restart
    const requiresRestart =
      oldConfig.server.serverPath !== this.configuration.server.serverPath ||
      oldConfig.server.autoStart !== this.configuration.server.autoStart ||
      oldConfig.server.timeout !== this.configuration.server.timeout;

    if (requiresRestart) {
      this.outputChannel.warn('Configuration changes require server restart');
      vscode.window
        .showWarningMessage(
          'MCP Testing configuration changes require a server restart.',
          'Restart Now',
          'Later'
        )
        .then((choice) => {
          if (choice === 'Restart Now') {
            vscode.commands.executeCommand('mcp-testing.restartServer');
          }
        });
    }

    // Emit change event
    this.changeEmitter.fire(this.configuration);
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    SettingsManager.instance = undefined;
  }
}
