# Animation Development Playbook

## Quick Reference: Do's and Don'ts

### 🚫 NEVER USE

| Don't Use                  | Why                      | Use Instead                 |
| -------------------------- | ------------------------ | --------------------------- |
| `document.createElement()` | No DOM in React Native   | React state arrays          |
| `querySelector()`          | No DOM queries in RN     | Refs or state management    |
| `element.animate()`        | Web API only             | CSS animations or state     |
| `::before`, `::after`      | No pseudo-elements in RN | Actual React components     |
| `filter: blur()`           | Limited RN support       | Opacity + scale simulation  |
| `filter: brightness()`     | Not in RN                | Opacity adjustments         |
| `mix-blend-mode`           | Not in RN                | Layered opacity             |
| `clip-path`                | Not in RN                | SVG or transform masks      |
| `vh`, `vw` units           | Different in RN          | Percentages or fixed values |
| CSS variables              | Not in RN                | JavaScript constants        |
| `cursor` properties        | Mobile doesn't need      | Touch feedback instead      |

### ✅ ALWAYS USE

| Pattern                  | Why                  | Example                                          |
| ------------------------ | -------------------- | ------------------------------------------------ |
| React state for elements | Works in both        | `const [particles, setParticles] = useState([])` |
| CSS animations           | Easily translatable  | `@keyframes` + `animation` property              |
| Transform + opacity      | Hardware accelerated | `transform: scale()`, `opacity`                  |
| Component composition    | Reusable in RN       | Separate small components                        |
| Declarative animations   | React pattern        | State-driven animation triggers                  |

---

## Step-by-Step Guide for New Animations

### Step 1: Plan Your Animation Structure

Before writing any code, answer these questions:

1. **What elements need to animate?**
   - List each moving part
   - Identify if they need to be created dynamically

2. **What properties will change?**
   - Stick to: `transform`, `opacity`, `backgroundColor`
   - Avoid: `filter`, `clip-path`, `mix-blend-mode`

3. **How is it triggered?**
   - On mount? On interaction? Continuous loop?

### Step 2: Create the Component Structure

```tsx
// ✅ GOOD: Component-based structure
export function MyAnimation() {
  // State for animation control
  const [isAnimating, setIsAnimating] = useState(false);
  const [elements, setElements] = useState<Element[]>([]);

  useEffect(() => {
    // Trigger animation on mount
    setIsAnimating(true);

    // Create elements via state
    setElements(generateElements());

    // Cleanup
    return () => {
      setIsAnimating(false);
      setElements([]);
    };
  }, []);

  return (
    <div className="animation-container">
      {elements.map(element => (
        <AnimatedElement key={element.id} {...element} />
      ))}
    </div>
  );
}

// ❌ BAD: DOM manipulation
export function BadAnimation() {
  useEffect(() => {
    const container = ref.current;
    const element = document.createElement('div'); // ❌ NO!
    container.appendChild(element); // ❌ NO!
    element.animate([...]); // ❌ NO!
  }, []);
}
```

### Step 3: Implement Animations

#### Option A: CSS Animations (Preferred)

```tsx
// Component
<div
  style={{
    animation: isAnimating
      ? 'slide-in 0.5s ease-out forwards'
      : 'none'
  }}
/>

// CSS (in style tag or CSS file)
@keyframes slide-in {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

#### Option B: State-Driven Styles

```tsx
const [progress, setProgress] = useState(0)

useEffect(() => {
  const interval = setInterval(() => {
    setProgress((prev) => Math.min(prev + 1, 100))
  }, 16)

  return () => clearInterval(interval)
}, [])

return (
  <div
    style={{
      transform: `scaleX(${progress / 100})`,
      opacity: progress / 100,
      transition: 'all 0.3s ease-out',
    }}
  />
)
```

### Step 4: Handle Decorative Elements

Instead of pseudo-elements, create actual components:

```tsx
// ❌ BAD: Using CSS pseudo-elements
.coin::before {
  content: '$';
}

// ✅ GOOD: Actual component
const Coin = () => (
  <div className="coin">
    <span className="coin-symbol">$</span>
  </div>
);
```

### Step 5: Replace Filter Effects

#### Blur Effect Simulation

```tsx
// ❌ BAD: Using filter
style={{ filter: 'blur(10px)' }}

// ✅ GOOD: Progressive opacity + scale
@keyframes blur-simulation {
  0% {
    transform: scale(0.9);
    opacity: 0;
  }
  25% {
    transform: scale(0.95);
    opacity: 0.3;
  }
  50% {
    transform: scale(0.98);
    opacity: 0.6;
  }
  75% {
    transform: scale(0.99);
    opacity: 0.85;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
```

#### Brightness Effect

```tsx
// ❌ BAD: Using filter
style={{ filter: 'brightness(1.5)' }}

// ✅ GOOD: Opacity adjustment
style={{ opacity: isHighlighted ? 1 : 0.7 }}
```

### Step 6: Create Particle Systems

```tsx
// ✅ GOOD: State-based particles
interface Particle {
  id: number
  x: number
  y: number
  delay: number
}

function ParticleSystem() {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    // Generate particles
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: i * 50,
    }))

    setParticles(newParticles)
  }, [])

  return (
    <>
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="particle"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            animation: `particle-float 1s ${particle.delay}ms ease-out forwards`,
          }}
        />
      ))}
    </>
  )
}
```

---

## Animation Patterns by Use Case

### 1. Progress Bars

```tsx
function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress-track">
      <div
        className="progress-fill"
        style={{
          transform: `scaleX(${value / 100})`,
          transformOrigin: 'left',
          transition: 'transform 0.3s ease-out',
        }}
      />
    </div>
  )
}
```

### 2. Floating Elements (Coins, Points, etc.)

```tsx
function FloatingElement({ children, delay = 0 }) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  return (
    <div
      className="floating-element"
      style={{
        animation: isVisible ? 'float-up 1s ease-out forwards' : 'none',
        opacity: 0,
      }}
    >
      {children}
    </div>
  )
}
```

### 3. Modal Animations

```tsx
function AnimatedModal({ isOpen, children }) {
  return (
    <div
      className="modal"
      style={{
        animation: isOpen
          ? 'modal-enter 0.3s ease-out forwards'
          : 'modal-exit 0.2s ease-in forwards',
        transformOrigin: 'center',
      }}
    >
      {children}
    </div>
  )
}
```

### 4. Text Effects

```tsx
function AnimatedText({ text, letterDelay = 50 }) {
  const letters = text.split('')

  return (
    <span className="animated-text">
      {letters.map((letter, i) => (
        <span
          key={i}
          className="animated-letter"
          style={{
            animation: `letter-appear 0.3s ${i * letterDelay}ms ease-out forwards`,
            opacity: 0,
          }}
        >
          {letter}
        </span>
      ))}
    </span>
  )
}
```

---

## Testing Your Animation for RN Compatibility

### Checklist Before Committing

- [ ] **No DOM Manipulation**: Zero uses of `document.*` or `querySelector`
- [ ] **No Pseudo-Elements**: All decorative elements are real components
- [ ] **No Filter Effects**: Using alternatives (opacity, scale, etc.)
- [ ] **Transform + Opacity Only**: Primary animation properties
- [ ] **State-Driven**: Animation controlled by React state
- [ ] **CSS Animations**: Using `@keyframes` instead of `.animate()`
- [ ] **Component-Based**: Small, reusable components
- [ ] **No Web-Only Units**: No `vh`, `vw`, or CSS variables
- [ ] **Cleanup Handled**: Effects return cleanup functions

### Quick Test

Ask yourself: "Could I rewrite this animation using only:"

- React Native's `Animated` API
- `transform` and `opacity` properties
- State changes

If yes, you're good! If no, refactor using the patterns above.

---

## React Native Translation Examples

### Web Animation → React Native Translation

#### Example 1: Fade In

**Web (Your Code):**

```tsx
<div style={{
  animation: 'fade-in 0.5s ease-out forwards'
}} />

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

**React Native (Future Translation):**

```tsx
import { Animated } from 'react-native'

const fadeAnim = useRef(new Animated.Value(0)).current

useEffect(() => {
  Animated.timing(fadeAnim, {
    toValue: 1,
    duration: 500,
    useNativeDriver: true,
  }).start()
}, [])
;<Animated.View style={{ opacity: fadeAnim }} />
```

#### Example 2: Scale Bounce

**Web (Your Code):**

```tsx
<div style={{
  animation: 'bounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards'
}} />

@keyframes bounce {
  0% { transform: scale(0); }
  60% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
```

**React Native (Future Translation):**

```tsx
import { MotiView } from 'moti'
;<MotiView
  from={{ scale: 0 }}
  animate={{ scale: 1 }}
  transition={{
    type: 'spring',
    damping: 10,
    stiffness: 100,
  }}
/>
```

---

## Common Mistakes and Solutions

### Mistake 1: Creating Elements Imperatively

❌ **Wrong:**

```tsx
useEffect(() => {
  for (let i = 0; i < 10; i++) {
    const div = document.createElement('div')
    container.appendChild(div)
  }
}, [])
```

✅ **Right:**

```tsx
const [elements] = useState(() => Array.from({ length: 10 }, (_, i) => ({ id: i })))

return (
  <>
    {elements.map((el) => (
      <div key={el.id} />
    ))}
  </>
)
```

### Mistake 2: Using Complex Selectors

❌ **Wrong:**

```tsx
const element = document.querySelector('.container > .item:first-child')
element.style.transform = 'scale(1.2)'
```

✅ **Right:**

```tsx
const [firstItemScale, setFirstItemScale] = useState(1)

// In your JSX
;<div style={{ transform: `scale(${firstItemScale})` }} />
```

### Mistake 3: Forgetting Cleanup

❌ **Wrong:**

```tsx
useEffect(() => {
  const interval = setInterval(animate, 100)
  // No cleanup!
}, [])
```

✅ **Right:**

```tsx
useEffect(() => {
  const interval = setInterval(animate, 100)
  return () => clearInterval(interval) // Always cleanup!
}, [])
```

---

## Resources

### Documentation

- [React Native Animated API](https://reactnative.dev/docs/animated)
- [Reanimated Documentation](https://docs.swmansion.com/react-native-reanimated/)
- [Moti Documentation](https://moti.fyi/)

### Internal Docs

- [REACT_NATIVE_ANIMATION_TRANSLATION_GUIDE.md](./REACT_NATIVE_ANIMATION_TRANSLATION_GUIDE.md)
- [REACT_NATIVE_REFACTORING_PATTERNS.md](./REACT_NATIVE_REFACTORING_PATTERNS.md)

---

## Summary

**The Golden Rule:** If you can't imagine how to build it with just `<div>` elements moving via `transform` and `opacity`, then it probably won't work well in React Native.

**Remember:**

1. State over DOM
2. Components over pseudo-elements
3. CSS animations over JavaScript animations
4. Transform + opacity over everything else
5. Always test with the compatibility checklist

By following this playbook, every animation you add will be ready for React Native translation, ensuring consistency across web and mobile experiences!
