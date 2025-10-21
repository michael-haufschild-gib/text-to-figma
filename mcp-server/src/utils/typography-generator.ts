/**
 * Modular Typography Scale Generator
 *
 * Generates type scales using modular ratios for harmonious font sizing.
 * Calculates optimal line heights for each size based on typographic best practices.
 */

/**
 * Common modular scale ratios
 */
export const MODULAR_RATIOS = {
  minorSecond: 1.067, // 15:16
  majorSecond: 1.125, // 8:9
  minorThird: 1.2, // 5:6
  majorThird: 1.25, // 4:5
  perfectFourth: 1.333, // 3:4
  augmentedFourth: 1.414, // 1:√2
  perfectFifth: 1.5, // 2:3
  goldenRatio: 1.618, // 1:φ
  majorSixth: 1.667, // 3:5
  minorSeventh: 1.778, // 9:16
  majorSeventh: 1.875, // 8:15
  octave: 2.0 // 1:2
} as const;

export type ModularRatioName = keyof typeof MODULAR_RATIOS;
export type ModularRatio = (typeof MODULAR_RATIOS)[ModularRatioName];

/**
 * Font size and line height pair
 */
export interface TypeScaleStep {
  name: string;
  fontSize: number;
  lineHeight: number;
  lineHeightRatio: number;
}

/**
 * Complete typography scale
 */
export interface TypographyScale {
  baseSize: number;
  ratio: number;
  ratioName: string;
  steps: TypeScaleStep[];
}

/**
 * Design token format for typography
 */
export interface TypographyToken {
  name: string;
  value: {
    fontSize: string;
    lineHeight: string;
  };
}

/**
 * Standard type scale level names
 */
const TYPE_SCALE_NAMES = [
  'xs', // Extra small
  'sm', // Small
  'base', // Base/body
  'lg', // Large
  'xl', // Extra large
  '2xl', // 2x extra large
  '3xl', // 3x extra large
  '4xl', // 4x extra large
  '5xl', // 5x extra large
  '6xl' // 6x extra large
] as const;

/**
 * Calculates optimal line height based on font size
 * Uses a sliding scale:
 * - Smaller text needs more line height for readability (1.5-1.75)
 * - Larger text needs less line height to avoid awkward spacing (1.1-1.3)
 */
function calculateOptimalLineHeight(fontSize: number): number {
  if (fontSize <= 12) {
    return 1.75; // Very small text needs generous line height
  } else if (fontSize <= 16) {
    return 1.5; // Body text optimal range
  } else if (fontSize <= 24) {
    return 1.4; // Slightly larger text
  } else if (fontSize <= 32) {
    return 1.3; // Heading text
  } else if (fontSize <= 48) {
    return 1.2; // Large headings
  } else {
    return 1.1; // Display text
  }
}

/**
 * Rounds to nearest quarter pixel for better rendering
 */
function roundToQuarter(value: number): number {
  return Math.round(value * 4) / 4;
}

/**
 * Generates a modular typography scale
 * @param baseSize - Base font size in pixels (typically 16)
 * @param ratio - Modular ratio to use
 * @param steps - Number of steps above and below base (default 5 each)
 */
export function generateTypographyScale(
  baseSize: number,
  ratio: number,
  steps: number = 5
): TypographyScale {
  const scaleSteps: TypeScaleStep[] = [];
  const totalSteps = steps * 2 + 1; // Steps below + base + steps above

  // Find the ratio name
  let ratioName = 'custom';
  for (const [name, value] of Object.entries(MODULAR_RATIOS)) {
    if (Math.abs(value - ratio) < 0.001) {
      ratioName = name;
      break;
    }
  }

  // Generate steps from smallest to largest
  for (let i = 0; i < totalSteps; i++) {
    const power = i - steps; // Negative for smaller, positive for larger
    const fontSize = roundToQuarter(baseSize * Math.pow(ratio, power));
    const lineHeightRatio = calculateOptimalLineHeight(fontSize);
    const lineHeight = roundToQuarter(fontSize * lineHeightRatio);

    const nameIndex = Math.min(i, TYPE_SCALE_NAMES.length - 1);
    const name = TYPE_SCALE_NAMES[nameIndex];

    scaleSteps.push({
      name,
      fontSize,
      lineHeight,
      lineHeightRatio
    });
  }

  return {
    baseSize,
    ratio,
    ratioName,
    steps: scaleSteps
  };
}

/**
 * Generates a typography scale from a ratio name
 */
export function generateTypographyScaleFromRatio(
  baseSize: number,
  ratioName: ModularRatioName,
  steps: number = 5
): TypographyScale {
  const ratio = MODULAR_RATIOS[ratioName];
  return generateTypographyScale(baseSize, ratio, steps);
}

/**
 * Converts typography scale to design tokens format
 */
export function scaleToDesignTokens(scale: TypographyScale): TypographyToken[] {
  return scale.steps.map((step) => ({
    name: `font-size-${step.name}`,
    value: {
      fontSize: `${step.fontSize}px`,
      lineHeight: `${step.lineHeight}px`
    }
  }));
}

/**
 * Converts typography scale to CSS custom properties
 */
export function scaleToCssVariables(scale: TypographyScale): string {
  let css = ':root {\n';
  css += `  /* Typography Scale: ${scale.ratioName} (${scale.ratio}) */\n`;
  css += `  /* Base size: ${scale.baseSize}px */\n\n`;

  scale.steps.forEach((step) => {
    css += `  --font-size-${step.name}: ${step.fontSize}px;\n`;
    css += `  --line-height-${step.name}: ${step.lineHeight}px;\n`;
    css += `  /* Ratio: ${step.lineHeightRatio.toFixed(2)} */\n\n`;
  });

  css += '}';
  return css;
}

/**
 * Converts typography scale to Tailwind config format
 */
export function scaleToTailwindConfig(scale: TypographyScale): string {
  let config = 'module.exports = {\n';
  config += '  theme: {\n';
  config += '    fontSize: {\n';

  scale.steps.forEach((step, index) => {
    const comma = index < scale.steps.length - 1 ? ',' : '';
    config += `      '${step.name}': ['${step.fontSize}px', {\n`;
    config += `        lineHeight: '${step.lineHeight}px',\n`;
    config += `      }]${comma}\n`;
  });

  config += '    },\n';
  config += '  },\n';
  config += '};\n';
  return config;
}

/**
 * Generates a harmonious type scale with commonly used sizes
 */
export function generatePresetScale(preset: 'web' | 'mobile' | 'print'): TypographyScale {
  switch (preset) {
    case 'web':
      // Perfect fourth (1.333) is ideal for web interfaces
      return generateTypographyScaleFromRatio(16, 'perfectFourth', 5);

    case 'mobile':
      // Major third (1.25) for more compact mobile layouts
      return generateTypographyScaleFromRatio(16, 'majorThird', 4);

    case 'print':
      // Golden ratio (1.618) for elegant print designs
      return generateTypographyScaleFromRatio(16, 'goldenRatio', 5);

    default:
      return generateTypographyScaleFromRatio(16, 'perfectFourth', 5);
  }
}

/**
 * Finds the closest scale step to a given font size
 */
export function findClosestScaleStep(targetSize: number, scale: TypographyScale): TypeScaleStep {
  let closest = scale.steps[0];
  let minDiff = Math.abs(targetSize - closest.fontSize);

  for (const step of scale.steps) {
    const diff = Math.abs(targetSize - step.fontSize);
    if (diff < minDiff) {
      minDiff = diff;
      closest = step;
    }
  }

  return closest;
}

/**
 * Validates if a font size fits within a modular scale
 */
export function validateFontSizeInScale(
  fontSize: number,
  scale: TypographyScale,
  tolerance: number = 1
): { valid: boolean; closest: TypeScaleStep; difference: number } {
  const closest = findClosestScaleStep(fontSize, scale);
  const difference = Math.abs(fontSize - closest.fontSize);
  const valid = difference <= tolerance;

  return { valid, closest, difference };
}
