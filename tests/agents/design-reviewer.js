/**
 * Agentic Design Review Agent
 *
 * Automated design quality checks for Figma components:
 * - Spacing consistency analysis
 * - Typography hierarchy validation
 * - Color contrast verification
 * - Component naming conventions
 * - Design system compliance scoring
 *
 * This agent can be run standalone or integrated into CI/CD pipelines.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Design Review Agent Configuration
 */
const REVIEW_CONFIG = {
  // Spacing rules
  spacing: {
    enforceGrid: true,
    gridBase: 8,
    validValues: [0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128],
    maxViolations: 0 // Strict: no violations allowed
  },

  // Typography rules
  typography: {
    enforceScale: true,
    validSizes: [12, 16, 20, 24, 32, 40, 48, 64],
    validWeights: [300, 400, 500, 600, 700, 800, 900],
    enforceLineHeight: true,
    maxViolations: 0
  },

  // Color contrast rules
  contrast: {
    enforceWCAG: true,
    minimumLevel: 'AA', // 'AA' or 'AAA'
    textSizes: {
      small: 16,
      large: 18
    },
    maxViolations: 0
  },

  // Naming conventions
  naming: {
    enforceConventions: true,
    patterns: {
      component: /^[A-Z][a-zA-Z0-9]*$/, // PascalCase
      layer: /^[a-z][a-zA-Z0-9]*$/, // camelCase
      variant: /^[a-z-]+$/ // kebab-case
    },
    maxViolations: 3 // Allow some flexibility for naming
  },

  // Scoring thresholds
  scoring: {
    excellent: 95,
    good: 85,
    acceptable: 75,
    needsImprovement: 60,
    failing: 0
  }
};

/**
 * Design Review Result
 */
class DesignReviewResult {
  constructor(componentName) {
    this.componentName = componentName;
    this.timestamp = new Date().toISOString();
    this.checks = {
      spacing: { passed: 0, failed: 0, violations: [] },
      typography: { passed: 0, failed: 0, violations: [] },
      contrast: { passed: 0, failed: 0, violations: [] },
      naming: { passed: 0, failed: 0, violations: [] }
    };
    this.score = 0;
    this.grade = '';
    this.recommendations = [];
  }

  addViolation(category, violation) {
    this.checks[category].failed++;
    this.checks[category].violations.push(violation);
  }

  addPass(category) {
    this.checks[category].passed++;
  }

  calculateScore() {
    const totalChecks = Object.values(this.checks)
      .reduce((sum, cat) => sum + cat.passed + cat.failed, 0);

    const totalPassed = Object.values(this.checks)
      .reduce((sum, cat) => sum + cat.passed, 0);

    this.score = totalChecks > 0 ? Math.round((totalPassed / totalChecks) * 100) : 0;

    // Determine grade
    if (this.score >= REVIEW_CONFIG.scoring.excellent) {
      this.grade = 'Excellent';
    } else if (this.score >= REVIEW_CONFIG.scoring.good) {
      this.grade = 'Good';
    } else if (this.score >= REVIEW_CONFIG.scoring.acceptable) {
      this.grade = 'Acceptable';
    } else if (this.score >= REVIEW_CONFIG.scoring.needsImprovement) {
      this.grade = 'Needs Improvement';
    } else {
      this.grade = 'Failing';
    }

    return this.score;
  }

  generateRecommendations() {
    this.recommendations = [];

    // Spacing recommendations
    if (this.checks.spacing.failed > 0) {
      this.recommendations.push({
        category: 'Spacing',
        priority: 'high',
        message: `Found ${this.checks.spacing.failed} spacing violations. Use 8pt grid values: ${REVIEW_CONFIG.spacing.validValues.join(', ')}px`,
        violations: this.checks.spacing.violations
      });
    }

    // Typography recommendations
    if (this.checks.typography.failed > 0) {
      this.recommendations.push({
        category: 'Typography',
        priority: 'high',
        message: `Found ${this.checks.typography.failed} typography violations. Use modular scale: ${REVIEW_CONFIG.typography.validSizes.join(', ')}px`,
        violations: this.checks.typography.violations
      });
    }

    // Contrast recommendations
    if (this.checks.contrast.failed > 0) {
      this.recommendations.push({
        category: 'Contrast',
        priority: 'critical',
        message: `Found ${this.checks.contrast.failed} contrast violations. Ensure all text meets WCAG ${REVIEW_CONFIG.contrast.minimumLevel} standards`,
        violations: this.checks.contrast.violations
      });
    }

    // Naming recommendations
    if (this.checks.naming.failed > 0) {
      this.recommendations.push({
        category: 'Naming',
        priority: 'medium',
        message: `Found ${this.checks.naming.failed} naming violations. Follow conventions: Components (PascalCase), Layers (camelCase), Variants (kebab-case)`,
        violations: this.checks.naming.violations
      });
    }

    return this.recommendations;
  }

  toJSON() {
    return {
      componentName: this.componentName,
      timestamp: this.timestamp,
      score: this.score,
      grade: this.grade,
      checks: this.checks,
      recommendations: this.recommendations
    };
  }

  toString() {
    let output = '\n═══════════════════════════════════════\n';
    output += `Design Review: ${this.componentName}\n`;
    output += '═══════════════════════════════════════\n\n';

    output += `Score: ${this.score}/100 (${this.grade})\n`;
    output += `Timestamp: ${new Date(this.timestamp).toLocaleString()}\n\n`;

    // Checks summary
    output += 'Checks Summary:\n';
    output += '───────────────────────────────────────\n';
    for (const [category, results] of Object.entries(this.checks)) {
      const total = results.passed + results.failed;
      const status = results.failed === 0 ? '✓' : '✗';
      output += `  ${status} ${category.padEnd(12)} ${results.passed}/${total} passed\n`;
    }
    output += '\n';

    // Recommendations
    if (this.recommendations.length > 0) {
      output += 'Recommendations:\n';
      output += '───────────────────────────────────────\n';
      for (const rec of this.recommendations) {
        const icon = rec.priority === 'critical' ? '🚨' :
                     rec.priority === 'high' ? '⚠️' : 'ℹ️';
        output += `${icon} ${rec.category} (${rec.priority})\n`;
        output += `   ${rec.message}\n`;

        if (rec.violations.length > 0 && rec.violations.length <= 5) {
          rec.violations.forEach(v => {
            output += `   - ${v}\n`;
          });
        } else if (rec.violations.length > 5) {
          rec.violations.slice(0, 3).forEach(v => {
            output += `   - ${v}\n`;
          });
          output += `   ... and ${rec.violations.length - 3} more\n`;
        }
        output += '\n';
      }
    } else {
      output += 'No issues found! This component follows design system guidelines.\n\n';
    }

    output += '═══════════════════════════════════════\n';
    return output;
  }
}

/**
 * Design Review Agent
 */
class DesignReviewAgent {
  constructor(config = REVIEW_CONFIG) {
    this.config = config;
  }

  /**
   * Reviews a Figma component for design system compliance
   */
  async reviewComponent(componentData) {
    const result = new DesignReviewResult(componentData.name);

    // Check spacing
    if (this.config.spacing.enforceGrid) {
      await this.checkSpacing(componentData, result);
    }

    // Check typography
    if (this.config.typography.enforceScale) {
      await this.checkTypography(componentData, result);
    }

    // Check contrast
    if (this.config.contrast.enforceWCAG) {
      await this.checkContrast(componentData, result);
    }

    // Check naming
    if (this.config.naming.enforceConventions) {
      this.checkNaming(componentData, result);
    }

    // Calculate score and generate recommendations
    result.calculateScore();
    result.generateRecommendations();

    return result;
  }

  /**
   * Checks spacing values against 8pt grid
   */
  async checkSpacing(componentData, result) {
    const spacingValues = this.extractSpacingValues(componentData);

    for (const spacing of spacingValues) {
      if (this.config.spacing.validValues.includes(spacing.value)) {
        result.addPass('spacing');
      } else {
        result.addViolation('spacing',
          `${spacing.property} uses ${spacing.value}px (not on 8pt grid) at ${spacing.location}`
        );
      }
    }
  }

  /**
   * Checks typography against modular scale
   */
  async checkTypography(componentData, result) {
    const textNodes = this.extractTextNodes(componentData);

    for (const node of textNodes) {
      // Check font size
      if (this.config.typography.validSizes.includes(node.fontSize)) {
        result.addPass('typography');
      } else {
        result.addViolation('typography',
          `Font size ${node.fontSize}px not in type scale at "${node.text}"`
        );
      }

      // Check font weight
      if (this.config.typography.validWeights.includes(node.fontWeight)) {
        result.addPass('typography');
      } else {
        result.addViolation('typography',
          `Font weight ${node.fontWeight} not standard at "${node.text}"`
        );
      }

      // Check line height
      if (this.config.typography.enforceLineHeight) {
        const expectedLineHeight = this.calculateRecommendedLineHeight(node.fontSize);
        const actualLineHeight = node.lineHeight || node.fontSize * 1.5;

        if (Math.abs(actualLineHeight - expectedLineHeight) <= 2) {
          result.addPass('typography');
        } else {
          result.addViolation('typography',
            `Line height ${actualLineHeight}px should be ~${expectedLineHeight}px at "${node.text}"`
          );
        }
      }
    }
  }

  /**
   * Checks color contrast against WCAG standards
   */
  async checkContrast(componentData, result) {
    const textNodes = this.extractTextNodes(componentData);

    for (const node of textNodes) {
      if (!node.foreground || !node.background) {
        continue;
      }

      const contrastRatio = this.calculateContrastRatio(node.foreground, node.background);
      const isLargeText = node.fontSize >= this.config.contrast.textSizes.large;

      const requiredRatio = this.config.contrast.minimumLevel === 'AAA'
        ? (isLargeText ? 4.5 : 7.0)
        : (isLargeText ? 3.0 : 4.5);

      if (contrastRatio >= requiredRatio) {
        result.addPass('contrast');
      } else {
        result.addViolation('contrast',
          `Contrast ratio ${contrastRatio.toFixed(2)}:1 < ${requiredRatio}:1 (WCAG ${this.config.contrast.minimumLevel}) at "${node.text}"`
        );
      }
    }
  }

  /**
   * Checks naming conventions
   */
  checkNaming(componentData, result) {
    // Check component name
    if (this.config.naming.patterns.component.test(componentData.name)) {
      result.addPass('naming');
    } else {
      result.addViolation('naming',
        `Component name "${componentData.name}" should be PascalCase`
      );
    }

    // Check layer names
    const layers = this.extractLayers(componentData);
    for (const layer of layers) {
      if (this.config.naming.patterns.layer.test(layer.name)) {
        result.addPass('naming');
      } else {
        result.addViolation('naming',
          `Layer name "${layer.name}" should be camelCase`
        );
      }
    }

    // Check variant names (if any)
    if (componentData.variants) {
      for (const variant of componentData.variants) {
        if (this.config.naming.patterns.variant.test(variant.name)) {
          result.addPass('naming');
        } else {
          result.addViolation('naming',
            `Variant name "${variant.name}" should be kebab-case`
          );
        }
      }
    }
  }

  /**
   * Helper: Extract spacing values from component
   */
  extractSpacingValues(componentData) {
    const spacings = [];

    if (componentData.padding) {
      spacings.push({
        property: 'padding',
        value: componentData.padding,
        location: 'component root'
      });
    }

    if (componentData.gap) {
      spacings.push({
        property: 'gap',
        value: componentData.gap,
        location: 'component root'
      });
    }

    // Extract from children
    if (componentData.children) {
      for (const child of componentData.children) {
        if (child.margin) {
          spacings.push({
            property: 'margin',
            value: child.margin,
            location: child.name || 'child element'
          });
        }
      }
    }

    return spacings;
  }

  /**
   * Helper: Extract text nodes from component
   */
  extractTextNodes(componentData) {
    const textNodes = [];

    if (componentData.type === 'TEXT') {
      textNodes.push({
        text: componentData.characters || componentData.name,
        fontSize: componentData.fontSize || 16,
        fontWeight: componentData.fontWeight || 400,
        lineHeight: componentData.lineHeight,
        foreground: componentData.fills?.[0]?.color,
        background: componentData.background || '#FFFFFF'
      });
    }

    if (componentData.children) {
      for (const child of componentData.children) {
        textNodes.push(...this.extractTextNodes(child));
      }
    }

    return textNodes;
  }

  /**
   * Helper: Extract layers from component
   */
  extractLayers(componentData) {
    const layers = [];

    if (componentData.name) {
      layers.push({ name: componentData.name, type: componentData.type });
    }

    if (componentData.children) {
      for (const child of componentData.children) {
        layers.push(...this.extractLayers(child));
      }
    }

    return layers;
  }

  /**
   * Helper: Calculate recommended line height
   */
  calculateRecommendedLineHeight(fontSize) {
    return fontSize <= 20 ? Math.round(fontSize * 1.5) : Math.round(fontSize * 1.2);
  }

  /**
   * Helper: Calculate contrast ratio (simplified)
   */
  calculateContrastRatio(color1, color2) {
    // In production, use the actual contrast calculation from color.ts
    // This is a simplified version for demonstration
    const lum1 = this.getRelativeLuminance(color1);
    const lum2 = this.getRelativeLuminance(color2);

    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Helper: Get relative luminance
   */
  getRelativeLuminance(color) {
    // Simplified - assumes color is hex string
    if (typeof color === 'string') {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;

      const rs = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
      const gs = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
      const bs = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    // Assume RGB object { r, g, b }
    const r = (color.r || 0) / 255;
    const g = (color.g || 0) / 255;
    const b = (color.b || 0) / 255;

    const rs = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    const gs = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    const bs = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * Reviews multiple components and generates summary report
   */
  async reviewProject(components) {
    const results = [];

    for (const component of components) {
      const result = await this.reviewComponent(component);
      results.push(result);
    }

    return this.generateProjectReport(results);
  }

  /**
   * Generates project-level report
   */
  generateProjectReport(results) {
    const totalScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;

    const report = {
      projectScore: Math.round(totalScore),
      componentsReviewed: results.length,
      componentResults: results,
      summary: {
        excellent: results.filter(r => r.score >= REVIEW_CONFIG.scoring.excellent).length,
        good: results.filter(r => r.score >= REVIEW_CONFIG.scoring.good && r.score < REVIEW_CONFIG.scoring.excellent).length,
        acceptable: results.filter(r => r.score >= REVIEW_CONFIG.scoring.acceptable && r.score < REVIEW_CONFIG.scoring.good).length,
        needsWork: results.filter(r => r.score < REVIEW_CONFIG.scoring.acceptable).length
      }
    };

    return report;
  }
}

/**
 * Example: Review test components
 */
async function runDesignReview() {
  console.log('\n═══════════════════════════════════════');
  console.log('Agentic Design Review Agent');
  console.log('═══════════════════════════════════════\n');

  const agent = new DesignReviewAgent();

  // Example component data (would come from Figma plugin)
  const testComponents = [
    {
      name: 'ButtonPrimary',
      type: 'COMPONENT',
      padding: 16,
      gap: 8,
      children: [
        {
          name: 'buttonLabel',
          type: 'TEXT',
          fontSize: 16,
          fontWeight: 600,
          lineHeight: 24,
          characters: 'Click Me',
          fills: [{ color: '#FFFFFF' }],
          background: '#0066CC'
        }
      ]
    },
    {
      name: 'login_form', // Bad naming (should be LoginForm)
      type: 'COMPONENT',
      padding: 20, // Bad spacing (should be 16 or 24)
      gap: 12, // Bad spacing (should be 8 or 16)
      children: [
        {
          name: 'Title',
          type: 'TEXT',
          fontSize: 28, // Bad typography (should be 24 or 32)
          fontWeight: 700,
          lineHeight: 36,
          characters: 'Login',
          fills: [{ color: '#333333' }],
          background: '#FFFFFF'
        },
        {
          name: 'helper-text',
          type: 'TEXT',
          fontSize: 14, // Bad typography (should be 12 or 16)
          fontWeight: 400,
          lineHeight: 20,
          characters: 'Enter your credentials',
          fills: [{ color: '#CCCCCC' }], // Bad contrast
          background: '#FFFFFF'
        }
      ]
    }
  ];

  // Review each component
  for (const component of testComponents) {
    const result = await agent.reviewComponent(component);
    console.log(result.toString());
  }

  // Generate project report
  const projectReport = await agent.reviewProject(testComponents);

  console.log('\n═══════════════════════════════════════');
  console.log('Project Summary');
  console.log('═══════════════════════════════════════\n');
  console.log(`Overall Project Score: ${projectReport.projectScore}/100`);
  console.log(`Components Reviewed: ${projectReport.componentsReviewed}`);
  console.log(`\nBreakdown:`);
  console.log(`  ✓ Excellent: ${projectReport.summary.excellent}`);
  console.log(`  ✓ Good: ${projectReport.summary.good}`);
  console.log(`  ⚠ Acceptable: ${projectReport.summary.acceptable}`);
  console.log(`  ✗ Needs Work: ${projectReport.summary.needsWork}`);
  console.log('═══════════════════════════════════════\n');

  return projectReport.projectScore >= REVIEW_CONFIG.scoring.acceptable;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDesignReview()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Design review failed:', error);
      process.exit(1);
    });
}

export { DesignReviewAgent, DesignReviewResult, REVIEW_CONFIG, runDesignReview };
