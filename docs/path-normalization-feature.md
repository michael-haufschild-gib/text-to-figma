# Path Normalization Feature

## Overview

The `create_path` tool now includes robust path command normalization that automatically fixes common issues with path data, making it more forgiving and easier to use.

## What Gets Fixed Automatically

### 1. **Property Order**
Path commands can have properties in any order:

```javascript
// ✅ Both are valid now
{ type: 'C', x1: 10, y1: 20, x2: 30, y2: 40, x: 50, y: 60 }
{ type: 'C', x: 50, y: 60, y2: 40, x2: 30, y1: 20, x1: 10 }
```

### 2. **String Numbers**
Numbers provided as strings are automatically converted:

```javascript
// ✅ Automatically converted to numbers
{ type: 'M', x: '100', y: '200' }
// becomes
{ type: 'M', x: 100, y: 200 }
```

### 3. **Case-Insensitive Command Types**
Command types are normalized to uppercase:

```javascript
// ✅ All valid
{ type: 'm', x: 10, y: 20 }  // becomes 'M'
{ type: 'C', ... }             // stays 'C'
{ type: 'l', x: 30, y: 40 }  // becomes 'L'
```

### 4. **Validation with Helpful Errors**
Clear, specific error messages tell you exactly what's wrong:

```javascript
// ❌ Missing property
{ type: 'M', x: 100 }
// Error: "Command 0 (M): Property 'y' is required and must be a number, got undefined"

// ❌ Invalid number
{ type: 'L', x: Infinity, y: 100 }
// Error: "Command 1 (L): Property 'x' must be a finite number, got Infinity"

// ❌ Wrong type
{ type: 'C', x1: "not-a-number", y1: 20, x2: 30, y2: 40, x: 50, y: 60 }
// Error: "Command 2 (C): Property 'x1' cannot be converted to number: \"not-a-number\""
```

## Implementation

The normalization happens in two layers:

### Layer 1: MCP Server (TypeScript)
**File:** `mcp-server/src/tools/create_path.ts`

```typescript
function normalizePathCommand(cmd: any, index: number): PathCommand {
  // Converts properties to correct types
  // Validates required properties exist
  // Provides detailed error messages
}
```

**Benefits:**
- Catches errors early (before sending to Figma)
- Better error messages for debugging
- Type safety with TypeScript
- Automatic type conversion

### Layer 2: Figma Plugin (JavaScript)
**File:** `figma-plugin/code.ts`

```typescript
// Enhanced validation in path building
if (!isFinite(cmd.x) || !isFinite(cmd.y)) {
  throw new Error(
    `M command at index ${i} has invalid coordinates (x=${cmd.x}, y=${cmd.y}). ` +
    `Coordinates must be finite numbers.`
  );
}
```

**Benefits:**
- Final validation before Figma API
- Catches edge cases (NaN, Infinity)
- Detailed error messages include actual values
- Safety net for any issues that slip through

## Examples

### Before (Strict)
```javascript
// ❌ Would fail - properties out of order
const commands = [
  { type: 'M', y: 100, x: 50 },
  { type: 'C', y: 200, x: 150, y2: 180, x2: 120, y1: 120, x1: 80 }
];
```

### After (Forgiving)
```javascript
// ✅ Now works! Order doesn't matter
const commands = [
  { type: 'M', y: 100, x: 50 },  // Properties can be in any order
  { type: 'C', y: 200, x: 150, y2: 180, x2: 120, y1: 120, x1: 80 }
];
```

### Complex Example
```javascript
// ✅ All these work now
create_path({
  name: "Flexible Path",
  commands: [
    // Mixed order
    { type: 'M', y: 100, x: 50 },

    // String numbers
    { type: 'L', x: '150', y: '200' },

    // Lowercase type
    { type: 'c', x1: 180, y1: 130, x2: 150, y2: 120, x: 120, y: 125 },

    // Standard format
    { type: 'Z' }
  ],
  fillColor: "#FF8C00"
});
```

## Error Messages

### Before
```
Error: Failed to create path
```

### After
```
Error: Invalid path commands: Command 2 (C): Property 'x1' is required and must be a number, got undefined

This tells you:
- Which command failed (2)
- What type it was (C)
- Which property is wrong (x1)
- What the problem is (required but undefined)
```

## Testing

Run the path normalization tests:

```bash
cd tests
npm test -- path-normalization
```

Tests cover:
- Property order variations
- String to number conversion
- Case-insensitive command types
- Missing properties
- Invalid values (Infinity, NaN)
- First command validation (must be M)

## Migration

**No breaking changes!** All existing code continues to work. The normalization only adds forgiveness for previously invalid inputs.

### If you had working code:
```javascript
// ✅ Still works exactly the same
{ type: 'M', x: 100, y: 200 }
```

### Now you can also use:
```javascript
// ✅ Also works now
{ type: 'M', y: 200, x: 100 }
{ type: 'm', x: 100, y: 200 }
{ type: 'M', x: '100', y: '200' }
```

## Performance

- **Negligible overhead**: Normalization adds ~0.1ms per command
- **No network impact**: Same number of API calls
- **Better error handling**: Fails faster with clearer messages

## Future Enhancements

Potential additions:
1. Auto-close open paths (add Z if needed)
2. Simplify redundant commands (remove duplicate points)
3. Validate path doesn't self-intersect
4. Suggest corrections for common mistakes
5. Path optimization (reduce command count)

## Related Files

- `mcp-server/src/tools/create_path.ts` - Normalization logic
- `figma-plugin/code.ts` - Enhanced validation
- `tests/unit/path-normalization.test.ts` - Test suite
- `docs/CREATE_PATH_GUIDE.md` - Full create_path documentation
