/**
 * Iterative Refinement Loop
 *
 * Provides design validation and iterative improvement with:
 * - Design quality validation
 * - Automatic correction suggestions
 * - Iterative improvement algorithm
 * - Convergence detection
 * - Quality scoring
 */

import { z } from 'zod';

/**
 * Validation rule types
 */
export const validationRuleTypeSchema = z.enum([
  'spacing',
  'typography',
  'contrast',
  'alignment',
  'hierarchy',
  'consistency',
  'accessibility'
]);

export type ValidationRuleType = z.infer<typeof validationRuleTypeSchema>;

/**
 * Validation severity levels
 */
export const severitySchema = z.enum(['error', 'warning', 'info']);
export type Severity = z.infer<typeof severitySchema>;

/**
 * Validation issue
 */
export const validationIssueSchema = z.object({
  id: z.string().describe('Unique identifier for the issue'),
  type: validationRuleTypeSchema.describe('Type of validation rule'),
  severity: severitySchema.describe('Severity level'),
  message: z.string().describe('Human-readable description of the issue'),
  nodeId: z.string().optional().describe('Affected node ID'),
  currentValue: z.unknown().optional().describe('Current value that caused the issue'),
  expectedValue: z.unknown().optional().describe('Expected or suggested value'),
  autoFixable: z.boolean().default(false).describe('Whether this issue can be automatically fixed')
});

export type ValidationIssue = z.infer<typeof validationIssueSchema>;

/**
 * Correction action
 */
export const correctionActionSchema = z.object({
  issueId: z.string().describe('ID of the issue being corrected'),
  action: z.string().describe('Type of correction action'),
  nodeId: z.string().optional().describe('Node to apply correction to'),
  parameters: z.record(z.unknown()).describe('Action parameters')
});

export type CorrectionAction = z.infer<typeof correctionActionSchema>;

/**
 * Design state for validation
 */
export interface DesignState {
  nodes: DesignNode[];
  metadata?: Record<string, unknown>;
}

/**
 * Design node structure
 */
export interface DesignNode {
  id: string;
  type: 'FRAME' | 'TEXT' | 'COMPONENT' | 'INSTANCE';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fills?: Array<{ color: string }>;
  fontSize?: number;
  lineHeight?: number;
  spacing?: number;
  children?: DesignNode[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  issues: ValidationIssue[];
  score: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

/**
 * Refinement iteration result
 */
export interface RefinementIteration {
  iteration: number;
  validationResult: ValidationResult;
  corrections: CorrectionAction[];
  improved: boolean;
  converged: boolean;
}

/**
 * Refinement loop configuration
 */
export const refinementConfigSchema = z.object({
  maxIterations: z
    .number()
    .int()
    .positive()
    .default(3)
    .describe('Maximum number of refinement iterations'),
  convergenceThreshold: z
    .number()
    .min(0)
    .max(100)
    .default(95)
    .describe('Quality score threshold for convergence'),
  autoFix: z.boolean().default(true).describe('Automatically apply corrections'),
  enabledRules: z
    .array(validationRuleTypeSchema)
    .optional()
    .describe('Enabled validation rule types')
});

export type RefinementConfig = z.infer<typeof refinementConfigSchema>;

/**
 * Refinement loop result
 */
export interface RefinementResult {
  iterations: RefinementIteration[];
  finalScore: number;
  converged: boolean;
  totalCorrections: number;
  improvementPercentage: number;
}

/**
 * Calculate design quality score (0-100)
 */
export function calculateQualityScore(validation: ValidationResult): number {
  const errorWeight = 10;
  const warningWeight = 3;
  const infoWeight = 1;

  const totalDeductions =
    validation.errorCount * errorWeight +
    validation.warningCount * warningWeight +
    validation.infoCount * infoWeight;

  // Start at 100 and deduct points for issues
  const score = Math.max(0, 100 - totalDeductions);

  return Math.round(score * 10) / 10; // Round to 1 decimal place
}

/**
 * Validate spacing against 8pt grid
 */
function validateSpacing(nodes: DesignNode[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const validSpacing = [0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128];

  for (const node of nodes) {
    if (node.spacing !== undefined && !validSpacing.includes(node.spacing)) {
      // Find nearest valid value
      const nearest = validSpacing.reduce((prev, curr) =>
        Math.abs(curr - node.spacing!) < Math.abs(prev - node.spacing!) ? curr : prev
      );

      issues.push({
        id: `spacing-${node.id}`,
        type: 'spacing',
        severity: 'warning',
        message: `Spacing ${node.spacing}px does not conform to 8pt grid`,
        nodeId: node.id,
        currentValue: node.spacing,
        expectedValue: nearest,
        autoFixable: true
      });
    }

    // Recursively validate children
    if (node.children) {
      issues.push(...validateSpacing(node.children));
    }
  }

  return issues;
}

/**
 * Validate typography scale
 */
function validateTypography(nodes: DesignNode[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const validFontSizes = [12, 16, 20, 24, 32, 40, 48, 64];

  for (const node of nodes) {
    if (node.type === 'TEXT' && node.fontSize !== undefined) {
      if (!validFontSizes.includes(node.fontSize)) {
        // Find nearest valid value
        const nearest = validFontSizes.reduce((prev, curr) =>
          Math.abs(curr - node.fontSize!) < Math.abs(prev - node.fontSize!) ? curr : prev
        );

        issues.push({
          id: `typography-${node.id}`,
          type: 'typography',
          severity: 'warning',
          message: `Font size ${node.fontSize}px does not conform to type scale`,
          nodeId: node.id,
          currentValue: node.fontSize,
          expectedValue: nearest,
          autoFixable: true
        });
      }

      // Validate line height
      if (node.lineHeight !== undefined) {
        const recommendedLineHeight = node.fontSize * 1.5;
        const deviation = Math.abs(node.lineHeight - recommendedLineHeight);

        if (deviation > node.fontSize * 0.2) {
          issues.push({
            id: `lineheight-${node.id}`,
            type: 'typography',
            severity: 'info',
            message: `Line height may be too ${node.lineHeight < recommendedLineHeight ? 'tight' : 'loose'}`,
            nodeId: node.id,
            currentValue: node.lineHeight,
            expectedValue: recommendedLineHeight,
            autoFixable: true
          });
        }
      }
    }

    // Recursively validate children
    if (node.children) {
      issues.push(...validateTypography(node.children));
    }
  }

  return issues;
}

/**
 * Validate alignment
 */
function validateAlignment(nodes: DesignNode[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check if nodes are aligned on pixel boundaries
  for (const node of nodes) {
    if (node.x % 1 !== 0 || node.y % 1 !== 0) {
      issues.push({
        id: `alignment-${node.id}`,
        type: 'alignment',
        severity: 'info',
        message: `Element not aligned to pixel grid (x: ${node.x}, y: ${node.y})`,
        nodeId: node.id,
        currentValue: { x: node.x, y: node.y },
        expectedValue: { x: Math.round(node.x), y: Math.round(node.y) },
        autoFixable: true
      });
    }

    // Recursively validate children
    if (node.children) {
      issues.push(...validateAlignment(node.children));
    }
  }

  return issues;
}

/**
 * Validate design hierarchy
 */
function validateHierarchy(nodes: DesignNode[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const textNodes = nodes.filter((node) => node.type === 'TEXT');

  if (textNodes.length > 0) {
    const fontSizes = textNodes.map((node) => node.fontSize ?? 16);
    const uniqueSizes = [...new Set(fontSizes)].sort((a, b) => b - a);

    // Check if there's a clear hierarchy (at least 2 different sizes)
    if (uniqueSizes.length === 1 && textNodes.length > 2) {
      issues.push({
        id: 'hierarchy-font-sizes',
        type: 'hierarchy',
        severity: 'warning',
        message:
          'All text elements use the same font size - consider establishing visual hierarchy',
        autoFixable: false
      });
    }

    // Check if size differences are meaningful (at least 4px)
    for (let i = 0; i < uniqueSizes.length - 1; i++) {
      if (uniqueSizes[i] - uniqueSizes[i + 1] < 4) {
        issues.push({
          id: `hierarchy-size-difference-${i}`,
          type: 'hierarchy',
          severity: 'info',
          message: `Small difference between font sizes (${uniqueSizes[i]}px vs ${uniqueSizes[i + 1]}px)`,
          autoFixable: false
        });
      }
    }
  }

  return issues;
}

/**
 * Validate design state
 */
export function validateDesign(
  state: DesignState,
  enabledRules?: ValidationRuleType[]
): ValidationResult {
  const allRules: ValidationRuleType[] = enabledRules ?? [
    'spacing',
    'typography',
    'alignment',
    'hierarchy'
  ];

  const allIssues: ValidationIssue[] = [];

  // Run enabled validation rules
  if (allRules.includes('spacing')) {
    allIssues.push(...validateSpacing(state.nodes));
  }

  if (allRules.includes('typography')) {
    allIssues.push(...validateTypography(state.nodes));
  }

  if (allRules.includes('alignment')) {
    allIssues.push(...validateAlignment(state.nodes));
  }

  if (allRules.includes('hierarchy')) {
    allIssues.push(...validateHierarchy(state.nodes));
  }

  // Count issues by severity
  const errorCount = allIssues.filter((i) => i.severity === 'error').length;
  const warningCount = allIssues.filter((i) => i.severity === 'warning').length;
  const infoCount = allIssues.filter((i) => i.severity === 'info').length;

  const result: ValidationResult = {
    issues: allIssues,
    score: 0,
    errorCount,
    warningCount,
    infoCount
  };

  result.score = calculateQualityScore(result);

  return result;
}

/**
 * Generate correction actions for validation issues
 */
export function generateCorrections(issues: ValidationIssue[]): CorrectionAction[] {
  const corrections: CorrectionAction[] = [];

  for (const issue of issues) {
    if (!issue.autoFixable || !issue.nodeId) {
      continue;
    }

    switch (issue.type) {
      case 'spacing':
        corrections.push({
          issueId: issue.id,
          action: 'update_spacing',
          nodeId: issue.nodeId,
          parameters: {
            spacing: issue.expectedValue
          }
        });
        break;

      case 'typography':
        if (issue.id.startsWith('typography-')) {
          corrections.push({
            issueId: issue.id,
            action: 'update_font_size',
            nodeId: issue.nodeId,
            parameters: {
              fontSize: issue.expectedValue
            }
          });
        } else if (issue.id.startsWith('lineheight-')) {
          corrections.push({
            issueId: issue.id,
            action: 'update_line_height',
            nodeId: issue.nodeId,
            parameters: {
              lineHeight: issue.expectedValue
            }
          });
        }
        break;

      case 'alignment':
        corrections.push({
          issueId: issue.id,
          action: 'align_to_pixel_grid',
          nodeId: issue.nodeId,
          parameters: issue.expectedValue as Record<string, unknown>
        });
        break;
    }
  }

  return corrections;
}

/**
 * Apply corrections to design state
 */
export function applyCorrections(state: DesignState, corrections: CorrectionAction[]): DesignState {
  // Create a deep copy of the state
  const newState: DesignState = JSON.parse(JSON.stringify(state));

  // Apply each correction
  for (const correction of corrections) {
    if (!correction.nodeId) {continue;}

    // Find the node to update
    const node = findNodeById(newState.nodes, correction.nodeId);
    if (!node) {continue;}

    switch (correction.action) {
      case 'update_spacing':
        node.spacing = correction.parameters.spacing as number;
        break;

      case 'update_font_size':
        node.fontSize = correction.parameters.fontSize as number;
        break;

      case 'update_line_height':
        node.lineHeight = correction.parameters.lineHeight as number;
        break;

      case 'align_to_pixel_grid':
        node.x = (correction.parameters.x as number) || node.x;
        node.y = (correction.parameters.y as number) || node.y;
        break;
    }
  }

  return newState;
}

/**
 * Helper to find node by ID
 */
function findNodeById(nodes: DesignNode[], id: string): DesignNode | undefined {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) {return found;}
    }
  }
  return undefined;
}

/**
 * Run iterative refinement loop
 */
export function runRefinementLoop(
  initialState: DesignState,
  config?: Partial<RefinementConfig>
): RefinementResult {
  const validatedConfig = refinementConfigSchema.parse(config ?? {});
  const iterations: RefinementIteration[] = [];

  let currentState = initialState;
  let previousScore = 0;

  for (let i = 0; i < validatedConfig.maxIterations; i++) {
    // Validate current state
    const validation = validateDesign(currentState, validatedConfig.enabledRules);

    // Generate corrections
    const corrections = validatedConfig.autoFix ? generateCorrections(validation.issues) : [];

    // Check convergence
    const converged = validation.score >= validatedConfig.convergenceThreshold;
    const improved = validation.score > previousScore || i === 0;

    iterations.push({
      iteration: i + 1,
      validationResult: validation,
      corrections,
      improved,
      converged
    });

    // Stop if converged or no improvement
    if (converged) {
      break;
    }

    if (!improved && i > 0) {
      // No improvement, stop iterating
      break;
    }

    // Apply corrections for next iteration
    if (validatedConfig.autoFix && corrections.length > 0) {
      currentState = applyCorrections(currentState, corrections);
    }

    previousScore = validation.score;

    // Stop if no more issues can be auto-fixed
    const autoFixableIssues = validation.issues.filter((i) => i.autoFixable);
    if (autoFixableIssues.length === 0) {
      break;
    }
  }

  const firstScore = iterations[0]?.validationResult.score ?? 0;
  const finalScore = iterations[iterations.length - 1]?.validationResult.score ?? 0;
  const converged = finalScore >= validatedConfig.convergenceThreshold;
  const totalCorrections = iterations.reduce((sum, iter) => sum + iter.corrections.length, 0);
  const improvementPercentage = firstScore > 0 ? ((finalScore - firstScore) / firstScore) * 100 : 0;

  return {
    iterations,
    finalScore,
    converged,
    totalCorrections,
    improvementPercentage
  };
}
