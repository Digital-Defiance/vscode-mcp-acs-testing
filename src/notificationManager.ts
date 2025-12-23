/**
 * Notification Manager for MCP ACS Testing Manager
 *
 * Manages notifications for test completion, errors, coverage threshold violations,
 * and other important events. Respects user preferences for notification display.
 */

import * as vscode from 'vscode';
import { MCPTestingClient } from './mcpClient';

/**
 * Notification type
 */
export enum NotificationType {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success',
}

/**
 * Notification options
 */
export interface NotificationOptions {
  /** Type of notification */
  type: NotificationType;
  /** Notification message */
  message: string;
  /** Optional detailed description */
  detail?: string;
  /** Actions to show in the notification */
  actions?: NotificationAction[];
  /** Whether to show even if notifications are disabled */
  forceShow?: boolean;
  /** Whether to log to output channel */
  log?: boolean;
}

/**
 * Notification action
 */
export interface NotificationAction {
  /** Action label */
  label: string;
  /** Command to execute when clicked */
  command?: string;
  /** Arguments to pass to the command */
  args?: any[];
  /** Callback to execute when clicked */
  callback?: () => void | Promise<void>;
}

/**
 * Notification manager for MCP ACS Testing Manager
 */
export class NotificationManager implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private notificationQueue: NotificationOptions[] = [];
  private isProcessingQueue = false;

  constructor(private mcpClient: MCPTestingClient, private outputChannel: vscode.LogOutputChannel) {
    this.outputChannel.info('NotificationManager initialized');
  }

  /**
   * Check if notifications are enabled in user settings
   */
  private areNotificationsEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('mcp-testing');
    return config.get<boolean>('ui.showNotifications', true);
  }

  /**
   * Show a notification
   */
  public async show(options: NotificationOptions): Promise<void> {
    // Log to output channel if requested
    if (options.log !== false) {
      const logMessage = options.detail ? `${options.message}: ${options.detail}` : options.message;

      switch (options.type) {
        case NotificationType.ERROR:
          this.outputChannel.error(logMessage);
          break;
        case NotificationType.WARNING:
          this.outputChannel.warn(logMessage);
          break;
        default:
          this.outputChannel.info(logMessage);
          break;
      }
    }

    // Check if notifications are enabled (unless forced)
    if (!options.forceShow && !this.areNotificationsEnabled()) {
      return;
    }

    // Add to queue
    this.notificationQueue.push(options);

    // Process queue if not already processing
    if (!this.isProcessingQueue) {
      await this.processQueue();
    }
  }

  /**
   * Process the notification queue
   */
  private async processQueue(): Promise<void> {
    this.isProcessingQueue = true;

    while (this.notificationQueue.length > 0) {
      const options = this.notificationQueue.shift();
      if (!options) {
        continue;
      }

      await this.showNotification(options);

      // Small delay between notifications to avoid overwhelming the user
      if (this.notificationQueue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Show a single notification
   */
  private async showNotification(options: NotificationOptions): Promise<void> {
    const message = options.detail ? `${options.message}\n${options.detail}` : options.message;
    const actionLabels = options.actions?.map((a) => a.label) || [];

    let selectedAction: string | undefined;

    switch (options.type) {
      case NotificationType.ERROR:
        selectedAction = await vscode.window.showErrorMessage(message, ...actionLabels);
        break;
      case NotificationType.WARNING:
        selectedAction = await vscode.window.showWarningMessage(message, ...actionLabels);
        break;
      case NotificationType.SUCCESS:
      case NotificationType.INFO:
      default:
        selectedAction = await vscode.window.showInformationMessage(message, ...actionLabels);
        break;
    }

    // Execute action if selected
    if (selectedAction && options.actions) {
      const action = options.actions.find((a) => a.label === selectedAction);
      if (action) {
        if (action.callback) {
          await action.callback();
        } else if (action.command) {
          await vscode.commands.executeCommand(action.command, ...(action.args || []));
        }
      }
    }
  }

  /**
   * Show test completion notification
   */
  public async showTestCompletion(
    passedCount: number,
    failedCount: number,
    duration: number
  ): Promise<void> {
    const totalCount = passedCount + failedCount;
    const durationSeconds = (duration / 1000).toFixed(1);

    if (failedCount === 0) {
      await this.show({
        type: NotificationType.SUCCESS,
        message: `All ${totalCount} tests passed in ${durationSeconds}s`,
        actions: [
          {
            label: 'View Results',
            command: 'mcp-testing.showTestResults',
          },
          {
            label: 'Show Coverage',
            command: 'mcp-testing.showCoverageReport',
          },
        ],
      });
    } else {
      await this.show({
        type: NotificationType.ERROR,
        message: `${failedCount} of ${totalCount} tests failed`,
        detail: `${passedCount} passed, ${failedCount} failed in ${durationSeconds}s`,
        actions: [
          {
            label: 'View Failures',
            command: 'mcp-testing.showTestResults',
          },
          {
            label: 'Rerun Failed',
            command: 'mcp-testing.rerunFailedTests',
          },
          {
            label: 'Debug First Failure',
            command: 'mcp-testing.debugTest',
          },
        ],
      });
    }
  }

  /**
   * Show error notification
   */
  public async showError(message: string, error?: Error): Promise<void> {
    await this.show({
      type: NotificationType.ERROR,
      message,
      detail: error?.message,
      actions: [
        {
          label: 'View Logs',
          callback: () => {
            this.outputChannel.show();
          },
        },
        {
          label: 'Restart Server',
          command: 'mcp-testing.restartServer',
        },
      ],
      forceShow: true, // Always show errors
    });
  }

  /**
   * Show coverage threshold violation notification
   */
  public async showCoverageThresholdViolation(
    metric: string,
    actual: number,
    threshold: number
  ): Promise<void> {
    await this.show({
      type: NotificationType.WARNING,
      message: `Coverage ${metric} is ${actual.toFixed(1)}%`,
      detail: `Below threshold of ${threshold}%`,
      actions: [
        {
          label: 'View Coverage',
          command: 'mcp-testing.showCoverageReport',
        },
        {
          label: 'Generate Tests',
          command: 'mcp-testing.generateTests',
        },
        {
          label: 'Show Gaps',
          command: 'mcp-testing.navigateToUncovered',
        },
      ],
    });
  }

  /**
   * Show flaky test detected notification
   */
  public async showFlakyTestDetected(testName: string, failureRate: number): Promise<void> {
    await this.show({
      type: NotificationType.WARNING,
      message: `Flaky test detected: ${testName}`,
      detail: `Failure rate: ${(failureRate * 100).toFixed(1)}%`,
      actions: [
        {
          label: 'Analyze',
          command: 'mcp-testing.analyzeFlakyTest',
        },
        {
          label: 'View All Flaky Tests',
          callback: async () => {
            await vscode.commands.executeCommand('mcp-testing-flaky.focus');
          },
        },
      ],
    });
  }

  /**
   * Show test generation complete notification
   */
  public async showTestGenerationComplete(testCount: number): Promise<void> {
    await this.show({
      type: NotificationType.SUCCESS,
      message: `Generated ${testCount} test${testCount === 1 ? '' : 's'}`,
      actions: [
        {
          label: 'View Tests',
          command: 'mcp-testing.showTestGeneration',
        },
        {
          label: 'Run Tests',
          command: 'mcp-testing.runTests',
        },
      ],
    });
  }

  /**
   * Show mutation testing complete notification
   */
  public async showMutationTestingComplete(
    mutationScore: number,
    survivedCount: number
  ): Promise<void> {
    const type =
      mutationScore >= 80
        ? NotificationType.SUCCESS
        : mutationScore >= 60
        ? NotificationType.WARNING
        : NotificationType.ERROR;

    await this.show({
      type,
      message: `Mutation score: ${mutationScore.toFixed(1)}%`,
      detail:
        survivedCount > 0
          ? `${survivedCount} mutation${survivedCount === 1 ? '' : 's'} survived`
          : 'All mutations killed',
      actions: [
        {
          label: 'View Report',
          command: 'mcp-testing.showMutationTesting',
        },
        ...(survivedCount > 0
          ? [
              {
                label: 'Generate Tests',
                command: 'mcp-testing.generateTests',
              },
            ]
          : []),
      ],
    });
  }

  /**
   * Show server connection error notification
   */
  public async showServerConnectionError(): Promise<void> {
    await this.show({
      type: NotificationType.ERROR,
      message: 'Failed to connect to MCP Testing Server',
      detail: 'Some features may be unavailable',
      actions: [
        {
          label: 'Restart Server',
          command: 'mcp-testing.restartServer',
        },
        {
          label: 'View Logs',
          callback: () => {
            this.outputChannel.show();
          },
        },
        {
          label: 'Open Settings',
          command: 'mcp-testing.openSettings',
        },
      ],
      forceShow: true, // Always show connection errors
    });
  }

  /**
   * Show info notification
   */
  public async showInfo(message: string, detail?: string): Promise<void> {
    await this.show({
      type: NotificationType.INFO,
      message,
      detail,
    });
  }

  /**
   * Show warning notification
   */
  public async showWarning(message: string, detail?: string): Promise<void> {
    await this.show({
      type: NotificationType.WARNING,
      message,
      detail,
    });
  }

  /**
   * Show success notification
   */
  public async showSuccess(message: string, detail?: string): Promise<void> {
    await this.show({
      type: NotificationType.SUCCESS,
      message,
      detail,
    });
  }

  /**
   * Clear all pending notifications
   */
  public clearQueue(): void {
    this.notificationQueue = [];
    this.outputChannel.debug('Notification queue cleared');
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    this.clearQueue();

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];

    this.outputChannel.info('NotificationManager disposed');
  }
}
