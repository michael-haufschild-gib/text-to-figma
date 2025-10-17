/**
 * Few-Shot System Prompt for Text-to-Figma (Primitive-First Approach)
 *
 * Provides LLMs with concrete examples of complete workflows for creating
 * common UI components by COMPOSING them from raw Figma primitives.
 *
 * PHILOSOPHY: Show how to build components from primitives, not pre-made abstractions.
 */

/**
 * Individual few-shot example
 */
export interface FewShotExample {
  title: string;
  userRequest: string;
  reasoning: string;
  toolSequence: Array<{
    step: number;
    tool: string;
    purpose: string;
    input: Record<string, unknown>;
    expectedResult: string;
  }>;
  validationSteps: string[];
  errorHandling?: string[];
  finalResult: string;
  cssEquivalent: string;
}

/**
 * Example 1: Creating a Button Component
 *
 * Demonstrates:
 * - Container-first approach
 * - Style application order
 * - Contrast validation
 * - Basic composition
 */
export const EXAMPLE_BUTTON: FewShotExample = {
  title: 'Creating a Button Component',
  userRequest: 'Create a blue button with white text that says "Sign Up"',
  reasoning: `To create a button, we need:
1. A frame container for the button (like a <div>)
2. Text content inside the frame
3. Background color on the frame
4. Text color validation for accessibility
5. Proper padding and sizing`,
  toolSequence: [
    {
      step: 1,
      tool: 'validate_design_tokens',
      purpose: 'Validate spacing and typography before creating anything',
      input: {
        spacing: [16, 32],
        typography: [{ fontSize: 16, name: 'button-text' }]
      },
      expectedResult: 'All values valid: 16px, 32px on 8pt grid; fontSize 16 in type scale'
    },
    {
      step: 2,
      tool: 'create_frame',
      purpose: 'Create the button container (like a <div> with flexbox)',
      input: {
        name: 'sign-up-button',
        layoutMode: 'HORIZONTAL',
        padding: 16,
        itemSpacing: 0
      },
      expectedResult: 'frameId: "frame-123", cssEquivalent: display: flex; flex-direction: row; padding: 16px;'
    },
    {
      step: 3,
      tool: 'set_fills',
      purpose: 'Set button background color (like CSS background-color)',
      input: {
        nodeId: 'frame-123',
        color: '#0066FF'
      },
      expectedResult: 'Applied color: #0066FF (blue)'
    },
    {
      step: 4,
      tool: 'create_text',
      purpose: 'Add button text content',
      input: {
        content: 'Sign Up',
        fontSize: 16,
        fontWeight: 600,
        color: '#FFFFFF',
        parentId: 'frame-123'
      },
      expectedResult: 'textId: "text-456", cssEquivalent: font-size: 16px; font-weight: semibold (600); color: #FFFFFF;'
    },
    {
      step: 5,
      tool: 'validate_contrast',
      purpose: 'Ensure white text on blue background meets WCAG AA',
      input: {
        foreground: '#FFFFFF',
        background: '#0066FF'
      },
      expectedResult: 'Contrast ratio: 5.8:1 - PASS (AA Normal: 4.5:1, AA Large: 3.0:1)'
    }
  ],
  validationSteps: [
    'Validate spacing values are on 8pt grid',
    'Validate font size is in type scale',
    'Validate text contrast meets WCAG AA (4.5:1 for normal text)'
  ],
  errorHandling: [
    'If spacing is invalid, use validate_spacing to get nearest valid value',
    'If contrast fails, suggest darker background or lighter text',
    'If font size is invalid, use validate_typography to get nearest value'
  ],
  finalResult: 'Created button with proper spacing (16px padding), typography (16px semibold), and accessible contrast (5.8:1)',
  cssEquivalent: `.sign-up-button {
  display: flex;
  flex-direction: row;
  padding: 16px;
  background-color: #0066FF;
  color: #FFFFFF;
  font-size: 16px;
  font-weight: 600;
}`
};

/**
 * Example 2: Building a Card with Image, Title, Body Text
 *
 * Demonstrates:
 * - Nested container hierarchy
 * - Multiple text styles
 * - Vertical layout with spacing
 * - Component composition
 */
export const EXAMPLE_CARD: FewShotExample = {
  title: 'Building a Card Component',
  userRequest: 'Create a card with an image placeholder, a title "Product Name", and description text',
  reasoning: `A card component requires:
1. Outer container frame (card wrapper)
2. Image placeholder frame (fixed height)
3. Content container for text
4. Title text (larger, bold)
5. Description text (smaller, regular weight)
6. Proper spacing between elements`,
  toolSequence: [
    {
      step: 1,
      tool: 'validate_design_tokens',
      purpose: 'Validate all spacing and typography values',
      input: {
        spacing: [16, 24],
        typography: [
          { fontSize: 24, name: 'title' },
          { fontSize: 16, name: 'description' }
        ]
      },
      expectedResult: 'All values valid'
    },
    {
      step: 2,
      tool: 'create_frame',
      purpose: 'Create card container (outer wrapper)',
      input: {
        name: 'product-card',
        layoutMode: 'VERTICAL',
        itemSpacing: 0,
        padding: 0,
        width: 320
      },
      expectedResult: 'frameId: "card-frame", CSS: display: flex; flex-direction: column; width: 320px;'
    },
    {
      step: 3,
      tool: 'set_fills',
      purpose: 'Set card background to white',
      input: {
        nodeId: 'card-frame',
        color: '#FFFFFF'
      },
      expectedResult: 'Applied white background'
    },
    {
      step: 4,
      tool: 'create_frame',
      purpose: 'Create image placeholder frame',
      input: {
        name: 'image-placeholder',
        layoutMode: 'NONE',
        width: 320,
        height: 200,
        parentId: 'card-frame'
      },
      expectedResult: 'frameId: "image-frame", CSS: width: 320px; height: 200px;'
    },
    {
      step: 5,
      tool: 'set_fills',
      purpose: 'Set image placeholder color (gray)',
      input: {
        nodeId: 'image-frame',
        color: '#E5E5E5'
      },
      expectedResult: 'Applied gray background for placeholder'
    },
    {
      step: 6,
      tool: 'create_frame',
      purpose: 'Create content container for text',
      input: {
        name: 'card-content',
        layoutMode: 'VERTICAL',
        itemSpacing: 16,
        padding: 24,
        parentId: 'card-frame'
      },
      expectedResult: 'frameId: "content-frame", CSS: display: flex; flex-direction: column; gap: 16px; padding: 24px;'
    },
    {
      step: 7,
      tool: 'create_text',
      purpose: 'Add card title',
      input: {
        content: 'Product Name',
        fontSize: 24,
        fontWeight: 600,
        color: '#000000',
        parentId: 'content-frame'
      },
      expectedResult: 'textId: "title-text", CSS: font-size: 24px; font-weight: 600; color: #000000;'
    },
    {
      step: 8,
      tool: 'create_text',
      purpose: 'Add card description',
      input: {
        content: 'This is a description of the product with key features and benefits.',
        fontSize: 16,
        fontWeight: 400,
        color: '#666666',
        parentId: 'content-frame'
      },
      expectedResult: 'textId: "desc-text", CSS: font-size: 16px; font-weight: 400; color: #666666;'
    },
    {
      step: 9,
      tool: 'validate_contrast',
      purpose: 'Validate title text contrast',
      input: {
        foreground: '#000000',
        background: '#FFFFFF'
      },
      expectedResult: 'Contrast ratio: 21:1 - PASS AAA (exceeds 7.0:1)'
    },
    {
      step: 10,
      tool: 'validate_contrast',
      purpose: 'Validate description text contrast',
      input: {
        foreground: '#666666',
        background: '#FFFFFF'
      },
      expectedResult: 'Contrast ratio: 5.7:1 - PASS AA (exceeds 4.5:1)'
    }
  ],
  validationSteps: [
    'Validate spacing: 16px (gap), 24px (padding)',
    'Validate typography: 24px (title), 16px (description)',
    'Validate contrast: black on white (21:1), gray on white (5.7:1)'
  ],
  errorHandling: [
    'If description color #666666 fails contrast, suggest darker gray like #595959',
    'If spacing values are invalid, round to nearest 8pt grid value'
  ],
  finalResult: 'Created card with image placeholder (320x200), title (24px semibold), description (16px regular), proper spacing, and accessible contrast',
  cssEquivalent: `.product-card {
  display: flex;
  flex-direction: column;
  width: 320px;
  background-color: #FFFFFF;
}

.image-placeholder {
  width: 320px;
  height: 200px;
  background-color: #E5E5E5;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
}`
};

/**
 * Example 3: Creating a Form with Inputs and Labels
 *
 * Demonstrates:
 * - Form field grouping
 * - Label-input pairs
 * - Consistent spacing
 * - Field state representation
 */
export const EXAMPLE_FORM: FewShotExample = {
  title: 'Creating a Form with Inputs and Labels',
  userRequest: 'Create a login form with email and password fields, each with a label',
  reasoning: `A form requires:
1. Form container (outer wrapper)
2. Field groups (label + input pairs)
3. Labels with consistent typography
4. Input fields with proper sizing
5. Consistent spacing between fields`,
  toolSequence: [
    {
      step: 1,
      tool: 'validate_design_tokens',
      purpose: 'Validate all spacing and typography',
      input: {
        spacing: [8, 24, 32],
        typography: [
          { fontSize: 16, name: 'label' },
          { fontSize: 16, name: 'input' }
        ]
      },
      expectedResult: 'All values valid: 8px, 24px, 32px on grid; fontSize 16 in scale'
    },
    {
      step: 2,
      tool: 'create_frame',
      purpose: 'Create form container',
      input: {
        name: 'login-form',
        layoutMode: 'VERTICAL',
        itemSpacing: 24,
        padding: 32,
        width: 400
      },
      expectedResult: 'frameId: "form-container", CSS: display: flex; flex-direction: column; gap: 24px; padding: 32px; width: 400px;'
    },
    {
      step: 3,
      tool: 'create_frame',
      purpose: 'Create email field group',
      input: {
        name: 'email-field-group',
        layoutMode: 'VERTICAL',
        itemSpacing: 8,
        padding: 0,
        parentId: 'form-container'
      },
      expectedResult: 'frameId: "email-group", CSS: display: flex; flex-direction: column; gap: 8px;'
    },
    {
      step: 4,
      tool: 'create_text',
      purpose: 'Add email label',
      input: {
        content: 'Email',
        fontSize: 16,
        fontWeight: 600,
        color: '#000000',
        parentId: 'email-group'
      },
      expectedResult: 'textId: "email-label", CSS: font-size: 16px; font-weight: 600; color: #000000;'
    },
    {
      step: 5,
      tool: 'create_frame',
      purpose: 'Create email input field',
      input: {
        name: 'email-input',
        layoutMode: 'HORIZONTAL',
        padding: 16,
        width: 400,
        height: 48,
        parentId: 'email-group'
      },
      expectedResult: 'frameId: "email-input", CSS: display: flex; padding: 16px; width: 400px; height: 48px;'
    },
    {
      step: 6,
      tool: 'set_fills',
      purpose: 'Set input background color',
      input: {
        nodeId: 'email-input',
        color: '#F5F5F5'
      },
      expectedResult: 'Applied light gray background'
    },
    {
      step: 7,
      tool: 'create_text',
      purpose: 'Add input placeholder text',
      input: {
        content: 'you@example.com',
        fontSize: 16,
        fontWeight: 400,
        color: '#999999',
        parentId: 'email-input'
      },
      expectedResult: 'textId: "email-placeholder", CSS: font-size: 16px; color: #999999;'
    },
    {
      step: 8,
      tool: 'create_frame',
      purpose: 'Create password field group',
      input: {
        name: 'password-field-group',
        layoutMode: 'VERTICAL',
        itemSpacing: 8,
        padding: 0,
        parentId: 'form-container'
      },
      expectedResult: 'frameId: "password-group", CSS: display: flex; flex-direction: column; gap: 8px;'
    },
    {
      step: 9,
      tool: 'create_text',
      purpose: 'Add password label',
      input: {
        content: 'Password',
        fontSize: 16,
        fontWeight: 600,
        color: '#000000',
        parentId: 'password-group'
      },
      expectedResult: 'textId: "password-label", CSS: font-size: 16px; font-weight: 600; color: #000000;'
    },
    {
      step: 10,
      tool: 'create_frame',
      purpose: 'Create password input field',
      input: {
        name: 'password-input',
        layoutMode: 'HORIZONTAL',
        padding: 16,
        width: 400,
        height: 48,
        parentId: 'password-group'
      },
      expectedResult: 'frameId: "password-input", CSS: display: flex; padding: 16px; width: 400px; height: 48px;'
    },
    {
      step: 11,
      tool: 'set_fills',
      purpose: 'Set input background color',
      input: {
        nodeId: 'password-input',
        color: '#F5F5F5'
      },
      expectedResult: 'Applied light gray background'
    },
    {
      step: 12,
      tool: 'create_text',
      purpose: 'Add input placeholder text',
      input: {
        content: '••••••••',
        fontSize: 16,
        fontWeight: 400,
        color: '#999999',
        parentId: 'password-input'
      },
      expectedResult: 'textId: "password-placeholder", CSS: font-size: 16px; color: #999999;'
    },
    {
      step: 13,
      tool: 'validate_contrast',
      purpose: 'Validate label text contrast',
      input: {
        foreground: '#000000',
        background: '#FFFFFF'
      },
      expectedResult: 'Contrast ratio: 21:1 - PASS AAA'
    },
    {
      step: 14,
      tool: 'validate_contrast',
      purpose: 'Validate placeholder text contrast',
      input: {
        foreground: '#999999',
        background: '#F5F5F5'
      },
      expectedResult: 'Contrast ratio: 2.8:1 - FAIL AA (placeholders can have lower contrast)'
    }
  ],
  validationSteps: [
    'Validate spacing: 8px (label-input gap), 24px (field gap), 32px (form padding)',
    'Validate typography: 16px for all text',
    'Validate contrast: labels must pass AA, placeholders can have lower contrast'
  ],
  errorHandling: [
    'If placeholder contrast fails, inform user that placeholders are allowed lower contrast per WCAG',
    'If field spacing is inconsistent, use consistent 8px gap for label-input pairs'
  ],
  finalResult: 'Created login form with two field groups (email, password), each with label and input, consistent spacing (8px within fields, 24px between fields), and proper contrast for labels',
  cssEquivalent: `.login-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 32px;
  width: 400px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 16px;
  font-weight: 600;
  color: #000000;
}

.field-input {
  display: flex;
  padding: 16px;
  width: 400px;
  height: 48px;
  background-color: #F5F5F5;
}`
};

/**
 * Example 4: Building a Navigation Bar
 *
 * Demonstrates:
 * - Horizontal layout
 * - Multiple text elements
 * - Spacing between items
 * - Container sizing
 */
export const EXAMPLE_NAVBAR: FewShotExample = {
  title: 'Building a Navigation Bar',
  userRequest: 'Create a horizontal navigation bar with logo and three menu items: Home, About, Contact',
  reasoning: `A navigation bar requires:
1. Horizontal container (navbar wrapper)
2. Logo section
3. Menu items arranged horizontally
4. Proper spacing between items
5. Background color and sizing`,
  toolSequence: [
    {
      step: 1,
      tool: 'validate_design_tokens',
      purpose: 'Validate spacing and typography',
      input: {
        spacing: [16, 24, 32],
        typography: [
          { fontSize: 20, name: 'logo' },
          { fontSize: 16, name: 'menu-item' }
        ]
      },
      expectedResult: 'All values valid'
    },
    {
      step: 2,
      tool: 'create_frame',
      purpose: 'Create navbar container',
      input: {
        name: 'navbar',
        layoutMode: 'HORIZONTAL',
        itemSpacing: 32,
        padding: 24,
        width: 1200,
        height: 80
      },
      expectedResult: 'frameId: "navbar-container", CSS: display: flex; flex-direction: row; gap: 32px; padding: 24px; width: 1200px; height: 80px;'
    },
    {
      step: 3,
      tool: 'set_fills',
      purpose: 'Set navbar background color',
      input: {
        nodeId: 'navbar-container',
        color: '#1A1A1A'
      },
      expectedResult: 'Applied dark gray background'
    },
    {
      step: 4,
      tool: 'create_text',
      purpose: 'Add logo text',
      input: {
        content: 'LOGO',
        fontSize: 20,
        fontWeight: 700,
        color: '#FFFFFF',
        parentId: 'navbar-container'
      },
      expectedResult: 'textId: "logo-text", CSS: font-size: 20px; font-weight: 700; color: #FFFFFF;'
    },
    {
      step: 5,
      tool: 'create_frame',
      purpose: 'Create menu container',
      input: {
        name: 'menu',
        layoutMode: 'HORIZONTAL',
        itemSpacing: 32,
        padding: 0,
        parentId: 'navbar-container'
      },
      expectedResult: 'frameId: "menu-container", CSS: display: flex; flex-direction: row; gap: 32px;'
    },
    {
      step: 6,
      tool: 'create_text',
      purpose: 'Add Home menu item',
      input: {
        content: 'Home',
        fontSize: 16,
        fontWeight: 500,
        color: '#FFFFFF',
        parentId: 'menu-container'
      },
      expectedResult: 'textId: "menu-home", CSS: font-size: 16px; font-weight: 500; color: #FFFFFF;'
    },
    {
      step: 7,
      tool: 'create_text',
      purpose: 'Add About menu item',
      input: {
        content: 'About',
        fontSize: 16,
        fontWeight: 500,
        color: '#FFFFFF',
        parentId: 'menu-container'
      },
      expectedResult: 'textId: "menu-about", CSS: font-size: 16px; font-weight: 500; color: #FFFFFF;'
    },
    {
      step: 8,
      tool: 'create_text',
      purpose: 'Add Contact menu item',
      input: {
        content: 'Contact',
        fontSize: 16,
        fontWeight: 500,
        color: '#FFFFFF',
        parentId: 'menu-container'
      },
      expectedResult: 'textId: "menu-contact", CSS: font-size: 16px; font-weight: 500; color: #FFFFFF;'
    },
    {
      step: 9,
      tool: 'validate_contrast',
      purpose: 'Validate white text on dark background',
      input: {
        foreground: '#FFFFFF',
        background: '#1A1A1A'
      },
      expectedResult: 'Contrast ratio: 15.3:1 - PASS AAA (exceeds 7.0:1)'
    }
  ],
  validationSteps: [
    'Validate spacing: 32px (between menu items and sections), 24px (navbar padding)',
    'Validate typography: 20px (logo), 16px (menu items)',
    'Validate contrast: white text on dark gray (15.3:1)'
  ],
  errorHandling: [
    'If spacing between menu items is too tight, suggest minimum 24px',
    'If background is too light, warn about contrast issues'
  ],
  finalResult: 'Created navigation bar with logo (20px bold) and three menu items (16px medium), proper spacing (32px gaps), and excellent contrast (15.3:1)',
  cssEquivalent: `.navbar {
  display: flex;
  flex-direction: row;
  gap: 32px;
  padding: 24px;
  width: 1200px;
  height: 80px;
  background-color: #1A1A1A;
}

.logo {
  font-size: 20px;
  font-weight: 700;
  color: #FFFFFF;
}

.menu {
  display: flex;
  flex-direction: row;
  gap: 32px;
}

.menu-item {
  font-size: 16px;
  font-weight: 500;
  color: #FFFFFF;
}`
};

/**
 * All few-shot examples
 */
export const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  EXAMPLE_BUTTON,
  EXAMPLE_CARD,
  EXAMPLE_FORM,
  EXAMPLE_NAVBAR
];

/**
 * Common patterns extracted from examples
 */
export const COMMON_PATTERNS = {
  containerFirst: `Container-First Approach:
Always create container frames before adding content. This matches how HTML works - you create the <div> before adding children.

Pattern:
1. Create outer frame (container)
2. Set container properties (layout, spacing, sizing)
3. Apply container styles (fills, effects)
4. Create child elements (text, nested frames)
5. Validate final result

Example: Creating a button
→ create_frame (button container)
→ set_fills (button background)
→ create_text (button label, parentId: button frame)
→ validate_contrast (text vs background)`,

  styleApplicationOrder: `Style Application Order:
Apply styles in a consistent order to avoid conflicts and ensure predictable results.

Order:
1. Structure (create frames/text)
2. Layout (set layoutMode, itemSpacing, padding)
3. Fills (set background colors)
4. Typography (font size, weight, color)
5. Effects (shadows, borders - if supported)

Example: Styling a card
→ create_frame (structure)
→ set_layout_properties (layout)
→ set_fills (background)
→ create_text (typography)
→ validate (accessibility)`,

  componentComposition: `Component Composition:
Build complex components by combining simple pieces, then optionally componentize.

Pattern:
1. Build individual pieces (buttons, inputs, labels)
2. Combine into larger structures (forms, cards, navbars)
3. Group related elements (field groups, menu groups)
4. Optionally convert to reusable components

Example: Building a form
→ Create form container
→ Create field group 1 (label + input)
→ Create field group 2 (label + input)
→ Create submit button
→ Group into complete form`,

  validationWorkflow: `Validation Workflow:
Always validate design tokens before creating nodes to catch errors early.

Workflow:
1. Parse user request → extract values
2. Validate all values BEFORE creating nodes:
   - validate_spacing (for padding, gaps)
   - validate_typography (for font sizes)
   - validate_contrast (for text colors)
3. Use suggested values if validation fails
4. Create nodes with validated values
5. Verify final result

Example: User requests "20px gap"
→ validate_spacing({ value: 20 })
→ Result: "Not on grid. Suggested: 16"
→ create_frame({ itemSpacing: 16 })
✓ Created with valid value`
};

/**
 * Formats a single example for the prompt
 */
function formatExample(example: FewShotExample): string {
  const toolSteps = example.toolSequence.map(step =>
    `  ${step.step}. ${step.tool}
     Purpose: ${step.purpose}
     Input: ${JSON.stringify(step.input, null, 2).split('\n').map((line, i) => i === 0 ? line : `     ${line}`).join('\n')}
     Result: ${step.expectedResult}`
  ).join('\n\n');

  const validations = example.validationSteps.map(v => `  - ${v}`).join('\n');

  const errors = example.errorHandling
    ? `\nError Handling:\n${example.errorHandling.map(e => `  - ${e}`).join('\n')}`
    : '';

  return `### ${example.title}

User Request: "${example.userRequest}"

Reasoning:
${example.reasoning}

Tool Sequence:
${toolSteps}

Validation Steps:
${validations}${errors}

Final Result:
${example.finalResult}

CSS Equivalent:
\`\`\`css
${example.cssEquivalent}
\`\`\`
`;
}

/**
 * Formats common patterns for the prompt
 */
function formatPatterns(): string {
  return Object.entries(COMMON_PATTERNS)
    .map(([_name, pattern]) => pattern)
    .join('\n\n---\n\n');
}

/**
 * Generates the complete few-shot system prompt
 */
export function getFewShotPrompt(): string {
  const examples = FEW_SHOT_EXAMPLES.map(formatExample).join('\n\n---\n\n');
  const patterns = formatPatterns();

  return `# Text-to-Figma Few-Shot Examples (Primitive Composition)

This guide provides concrete examples of complete workflows for creating common UI components by COMPOSING them from Figma primitives.

**CRITICAL**: These examples show how to BUILD components from raw primitives (frames, text, fills, effects), NOT how to use pre-made components. There are no "create_button" or "create_card" tools - you must compose everything from basic building blocks.

**Philosophy**: Just like Figma itself has no "draw button" functionality, this tool exposes raw primitives. Study these examples to learn composition patterns.

## Complete Workflow Examples (Primitive Composition)

${examples}

## Common Patterns

${patterns}

## Key Takeaways

1. **Compose from primitives**: No pre-made components exist - build everything from frames, text, fills, and effects
2. **Always validate first**: Use validate_design_tokens before creating nodes
3. **Container-first**: Create frames (rectangles) before adding content
4. **Consistent order**: Structure → Layout → Fills → Content → Effects → Validation
5. **Handle errors**: Suggest corrections when values are invalid
6. **Show CSS equivalents**: Help users understand with web development analogies
7. **Verify accessibility**: Always validate text contrast for WCAG compliance
8. **Think in layers**: Compose complex UI by layering primitive shapes and text

## Applying These Patterns

When you receive a request:

1. **Identify the pattern**: Is it a button? Card? Form? Navigation?
2. **Extract values**: Pull out spacing, typography, colors from the request
3. **Validate tokens**: Check all values against design system constraints
4. **Follow the sequence**: Use the tool sequence from the matching example
5. **Handle errors**: If validation fails, suggest nearest valid values
6. **Verify result**: Validate accessibility and explain the final design

Remember: Think in HTML/CSS terms, validate constraints, and explain your decisions using web development analogies.`;
}

/**
 * Gets just the examples (without patterns) for reference
 */
export function getFewShotExamples(): FewShotExample[] {
  return FEW_SHOT_EXAMPLES;
}

/**
 * Gets a specific example by title
 */
export function getFewShotExample(title: string): FewShotExample | undefined {
  return FEW_SHOT_EXAMPLES.find(ex => ex.title === title);
}

/**
 * Gets a condensed version for token-limited contexts
 */
export function getCondensedFewShotPrompt(): string {
  return `# Text-to-Figma Quick Examples

## Button: Container → Style → Content → Validate
create_frame → set_fills → create_text → validate_contrast

## Card: Container → Image → Content → Text → Validate
create_frame (card) → create_frame (image) → create_frame (content) → create_text (title/desc) → validate_contrast

## Form: Container → Field Groups → Labels/Inputs → Validate
create_frame (form) → create_frame (field-group) → create_text (label) → create_frame (input) → validate_contrast

## Navbar: Container → Logo → Menu → Items → Validate
create_frame (navbar) → create_text (logo) → create_frame (menu) → create_text (items) → validate_contrast

## Pattern: Always Validate First
validate_design_tokens → create nodes → validate_contrast → done`;
}
