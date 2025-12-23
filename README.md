# MCP ACS Testing Manager

Comprehensive testing capabilities for AI agents with MCP integration. Run tests, analyze coverage, generate tests, debug failures, and manage the complete testing lifecycle.

## Features

- **Test Execution**: Run tests across multiple frameworks (Jest, Mocha, Pytest, Vitest)
- **Coverage Analysis**: Analyze test coverage with visual decorations
- **Test Generation**: AI-powered test generation from code
- **Debugging Integration**: Debug failing tests with mcp-debugger-server
- **Visual Regression**: Screenshot comparison with mcp-screenshot
- **Flaky Test Detection**: Identify and fix unreliable tests
- **Mutation Testing**: Verify test suite effectiveness
- **Impact Analysis**: Run only affected tests
- **Performance Benchmarking**: Identify and optimize slow tests

## Requirements

- VS Code 1.105.0 or higher
- Node.js 18+ (for JavaScript/TypeScript projects)
- Python 3.8+ (for Python projects)

## Extension Settings

This extension contributes the following settings:

- `mcp-testing.server.autoStart`: Automatically start MCP server when VS Code opens
- `mcp-testing.test.defaultFramework`: Default test framework to use
- `mcp-testing.coverage.enabled`: Enable coverage analysis
- `mcp-testing.coverage.showInEditor`: Show coverage decorations in editor

## Known Issues

None at this time.

## Release Notes

### 0.1.0

Initial release of MCP ACS Testing Manager.

## License

MIT
