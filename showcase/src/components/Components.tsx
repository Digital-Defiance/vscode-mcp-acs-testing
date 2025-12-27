import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import "./Components.css";

interface Feature {
  title: string;
  description: string;
  icon: string;
  tech: string[];
  highlights: string[];
  category: "Core" | "Interfaces" | "Security" | "Errors" | "Builders";
}

const features: Feature[] = [
  {
    title: "Multi-Framework Support",
    icon: "🧪",
    description:
      "Run tests across Jest, Mocha, Pytest, and Vitest. Unified interface for all major testing frameworks with automatic detection and configuration.",
    tech: ["Jest", "Mocha", "Pytest", "Vitest"],
    category: "Core",
    highlights: [
      "Automatic framework detection from project configuration",
      "Unified test execution interface across all frameworks",
      "Run individual tests, test suites, or entire projects",
      "Support for JavaScript, TypeScript, and Python tests",
      "Real-time test results and progress updates",
    ],
  },
  {
    title: "Coverage Analysis",
    icon: "📊",
    description:
      "Analyze test coverage with visual decorations in the editor. See covered, uncovered, and partially covered lines at a glance.",
    tech: ["Coverage", "Visualization", "Metrics"],
    category: "Core",
    highlights: [
      "Visual coverage decorations in editor (green/red/yellow)",
      "Coverage metrics: lines, branches, functions, statements",
      "Coverage tree view showing file-by-file breakdown",
      "Coverage report webview with interactive charts",
      "Configurable coverage thresholds and warnings",
    ],
  },
  {
    title: "AI-Powered Test Generation",
    icon: "🤖",
    description:
      "Generate tests from your code using AI. Analyze functions, classes, and modules to create comprehensive test suites automatically.",
    tech: ["AI", "Code Generation", "MCP Protocol"],
    category: "Interfaces",
    highlights: [
      "Generate tests from selected code or entire files",
      "AI analyzes code structure and generates test cases",
      "Supports Jest, Mocha, and Pytest output formats",
      "Generates test setup, assertions, and mocks",
      "Integration with GitHub Copilot and MCP agents",
    ],
  },
  {
    title: "Debugging Integration",
    icon: "🐛",
    description:
      "Debug failing tests with mcp-debugger-server integration. Set breakpoints, inspect variables, and step through test code.",
    tech: ["Debugging", "Integration", "MCP"],
    category: "Interfaces",
    highlights: [
      "Launch debugger directly from test failures",
      "Integrated with mcp-debugger-server",
      "Set breakpoints in test and source code",
      "Inspect variables and call stack during test execution",
      "Debug configuration auto-generation",
    ],
  },
  {
    title: "Flaky Test Detection",
    icon: "🔍",
    description:
      "Identify and fix unreliable tests that sometimes pass and sometimes fail. Track flaky test history and patterns.",
    tech: ["Analysis", "Testing", "Reliability"],
    category: "Core",
    highlights: [
      "Automatic flaky test detection across runs",
      "Flaky test tree view with failure rates",
      "Historical tracking of test reliability",
      "Pattern analysis for common flaky test causes",
      "Suggestions for fixing flaky tests",
    ],
  },
  {
    title: "Visual Regression Testing",
    icon: "📸",
    description:
      "Screenshot comparison with mcp-screenshot integration. Detect visual changes in UI components automatically.",
    tech: ["Screenshots", "Visual Testing", "MCP"],
    category: "Interfaces",
    highlights: [
      "Integrated with mcp-screenshot server",
      "Capture and compare UI screenshots",
      "Visual diff highlighting for changes",
      "Baseline management for expected screenshots",
      "Works with any framework supporting headless browsers",
    ],
  },
  {
    title: "Mutation Testing",
    icon: "🧬",
    description:
      "Verify test suite effectiveness by introducing mutations to your code. Ensure tests catch real bugs.",
    tech: ["Mutation Testing", "Quality", "Analysis"],
    category: "Core",
    highlights: [
      "Introduce code mutations (change operators, values, etc.)",
      "Verify that tests fail for each mutation",
      "Mutation testing webview with detailed results",
      "Identify untested code paths and weak tests",
      "Mutation score and coverage metrics",
    ],
  },
  {
    title: "Impact Analysis",
    icon: "⚡",
    description:
      "Run only tests affected by your code changes. Save time by skipping unrelated tests based on git diff analysis.",
    tech: ["Git", "Analysis", "Optimization"],
    category: "Core",
    highlights: [
      "Analyze git diff to find affected files",
      "Determine which tests cover changed code",
      "Run only relevant tests for faster feedback",
      "Impact analysis webview with dependency graph",
      "Configurable impact detection strategies",
    ],
  },
];

const Components = () => {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  return (
    <section className="components section" id="components" ref={ref}>
      <motion.div
        className="components-container"
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6 }}
      >
        <h2 className="section-title">
          Core <span className="gradient-text">Features</span> & Capabilities
        </h2>
        <p className="components-subtitle">
          Comprehensive testing lifecycle management for AI agents
        </p>

        <motion.div
          className="suite-intro"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h3>
            Complete <em>testing lifecycle</em> for <em>AI agents</em> with <em>multi-framework</em> support
          </h3>
          <p>
            <strong>
              MCP ACS Testing Manager brings comprehensive testing capabilities to AI agents
            </strong>{" "}
            with support for Jest, Mocha, Pytest, and Vitest. Run tests, analyze coverage,
            generate tests with AI, debug failures, detect flaky tests, and manage the complete
            testing lifecycle - all within VS Code with seamless{" "}
            <strong>GitHub Copilot integration</strong>.
          </p>
          <div className="problem-solution">
            <div className="problem">
              <h4>❌ The Challenge: AI Agents Need Comprehensive Testing</h4>
              <ul>
                <li>Running tests across multiple frameworks (Jest, Mocha, Pytest, Vitest)</li>
                <li>Analyzing code coverage and identifying untested code paths</li>
                <li>Generating tests automatically from existing code</li>
                <li>Debugging test failures with proper breakpoints and inspection</li>
                <li>Detecting and fixing flaky tests that intermittently fail</li>
              </ul>
              <p>
                <strong>Result:</strong> AI agents can't effectively manage the testing lifecycle.
              </p>
            </div>
            <div className="solution">
              <h4>✅ The Solution: Complete Testing Lifecycle Management</h4>
              <p>
                <strong>MCP ACS Testing Manager</strong> provides{" "}
                <strong>multi-framework support</strong> for Jest, Mocha, Pytest, and Vitest,{" "}
                <strong>coverage analysis</strong> with visual decorations,{" "}
                <strong>AI-powered test generation</strong> from code,
                and <strong>debugging integration</strong> with mcp-debugger-server.
              </p>
              <p>
                Built on <strong>Model Context Protocol</strong> with seamless{" "}
                <strong>GitHub Copilot integration</strong>, it enables AI agents to
                manage the complete testing lifecycle. Detect flaky tests, perform
                visual regression testing with screenshots, run mutation testing to
                verify test effectiveness, and use impact analysis to run only
                affected tests.
              </p>
            </div>
          </div>
          <div className="value-props">
            <div className="value-prop">
              <strong>🧪 Multi-Framework</strong>
              <p>
                Support for Jest, Mocha, Pytest, and Vitest with unified interface
              </p>
            </div>
            <div className="value-prop">
              <strong>📊 Coverage Analysis</strong>
              <p>
                Visual coverage decorations and detailed metrics in webview
              </p>
            </div>
            <div className="value-prop">
              <strong>🤖 AI-Powered</strong>
              <p>
                Generate tests from code using AI with GitHub Copilot integration
              </p>
            </div>
            <div className="value-prop">
              <strong>🐛 Debug Integration</strong>
              <p>
                Debug failing tests with mcp-debugger-server integration
              </p>
            </div>
          </div>
        </motion.div>

        <div className="components-grid">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="component-card card"
              initial={{ opacity: 0, y: 50 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: index * 0.1, duration: 0.6 }}
            >
              <div className="component-header">
                <div className="component-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <span
                  className={`component-badge ${feature.category.toLowerCase()}`}
                >
                  {feature.category}
                </span>
              </div>

              <p className="component-description">{feature.description}</p>

              <ul className="component-highlights">
                {feature.highlights.map((highlight, i) => (
                  <li key={i}>{highlight}</li>
                ))}
              </ul>

              <div className="component-tech">
                {feature.tech.map((tech) => (
                  <span key={tech} className="tech-badge">
                    {tech}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
};

export default Components;
