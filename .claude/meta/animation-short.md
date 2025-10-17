## Animation Principles in Digital Design

Follow these principles:

**Principle 1: Use Squash and Stretch**
Use elastic feedback animations that communicate interaction responsiveness.

**Implementation Examples:**

- Button hover states that subtly scale to indicate interactivity
- Form field highlights that expand and contract to show focus states
- Loading indicators that demonstrate system activity through rhythmic scaling

**Principle 2: Create Anticipation**
Use preparatory animations that signal upcoming state changes.

**Implementation Examples:**

- Menu icons that rotate before navigation panel opens
- Form submit buttons that briefly compress before processing state
- Card hover previews that lift slightly before expanding

**Principle 3: Use Sequences for Staging**
Make the visual hierarchy easy to understand through animated sequences.

**Implementation Examples:**

- Sequential form field validation feedback
- Staggered card animations during content loading
- Progressive disclosure of navigation options

**Principle 4: Decide - Straight Ahead or Pose-to-Pose**
Decide between fluid motion and keyframe-based transitions.

**Straight Ahead (Fluid):** Continuous scrolling animations, particle effects
**Pose-to-Pose (Keyframe):** State transitions, modal appearances, navigation changes

**Principle 5: Follow Through and Overlap Actions**
Let elements continue moving after the primary action to create natural, believable motion.

**Implementation Examples:**

- Cards that slightly overshoot their final position before settling
- Menu items that animate in sequence rather than simultaneously
- Form elements that have subtle elastic behavior after reaching their target state
- Notification badges that bounce slightly after appearing

**User Experience Impact:** Follow-through animations feel significantly more natural to users and increase perceived interface quality

**Principle 6: Use Arcs instead of Lines**
Let motion follows natural curved paths rather than rigid straight lines. Also for many other animation types, prefer curved value paths over linear value paths.

**Implementation Examples:**

- Floating action buttons that arc upward when expanding into menus
- Cards that follow curved paths when transitioning between layouts
- Drag-and-drop interactions that use parabolic motion curves
- Page transitions that follow curved motion paths for spatial continuity

**Principle 7: Add Secondary and Tertiary Action**
Add secondary and tertiary animations that enhance the primary interaction without competing for attention.

Secondary and Tertiary actions should be significantly less prominent than primary animations to maintain hierarchy

**Implementation Examples:**

- Subtle background color shifts during button interactions
- Icon micro-animations that support main navigation actions
- Loading spinner accompaniment during form submissions
- Contextual tooltip appearances during hover states


**Principle 8: Make it Look Good**
Create animations that are pleasant, engaging, and emotionally resonant with users.

**Principle 9: Keep Web and Native Close Together**

This is a **React web project** with future React Native portability as a requirement. Write web code that avoids RN-incompatible features.

### Current Stack
- **Web**: Framer Motion, CSS, React (current implementation)

### Future Compatibility
- **React Native**: Will use Moti, Reanimated, react-native-linear-gradient
- Web code must avoid features that don't translate to React Native

**✅ ALLOWED** (cross-platform safe):
- Transforms: `translateX`, `translateY`, `scale`, `rotate`
- Opacity animations
- **Linear gradients ONLY** (via react-native-linear-gradient)
- Color transitions
- Layout animations (position, size)

**❌ FORBIDDEN** (web-only, breaks React Native):
- Blur animations or CSS filters
- Radial/conic gradients
- Box shadows, text shadows
- backdrop-filter, clip-path
- CSS pseudo-elements (:before, :after)
- Complex CSS selectors
