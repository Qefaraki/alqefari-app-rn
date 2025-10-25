# Ref Forwarding Pattern Guide

## Overview

This document describes the ref forwarding pattern used for utility components that need to expose imperative APIs while maintaining internal persistent state.

## When to Use Ref Forwarding

Use `forwardRef` + `useImperativeHandle` when:

1. ✅ Component needs to expose **imperative actions** (focus, scroll, calculate)
2. ✅ Component maintains **persistent internal state** across renders
3. ✅ Component is a **utility** (no JSX, returns null)
4. ✅ Parent needs to **call methods** on the component

**Don't use when:**
- ❌ Passing data down (use props instead)
- ❌ Managing state that belongs in parent (use callbacks)
- ❌ Component renders JSX (use regular component)

## Pattern Implementation

### Basic Structure

```typescript
import { forwardRef, useImperativeHandle, useRef } from 'react';

// 1. Define the ref interface
export interface UtilityComponentRef {
  method1: (arg: string) => number;
  method2: () => void;
}

// 2. Create component with forwardRef
export const UtilityComponent = forwardRef<UtilityComponentRef, {}>((props, ref) => {
  // 3. Create internal persistent state with useRef
  const internalState = useRef({
    counter: 0,
    cache: new Map(),
  });

  // 4. Expose imperative API with useImperativeHandle
  useImperativeHandle(ref, () => ({
    method1: (arg: string) => {
      // Access and modify internal state
      internalState.current.counter++;
      return internalState.current.counter;
    },
    method2: () => {
      internalState.current.cache.clear();
    },
  }), []); // Empty deps = stable API reference

  // 5. Utility component returns null
  return null;
});
```

### Parent Usage

```typescript
function ParentComponent() {
  // 1. Create ref with type annotation
  const utilityRef = useRef<UtilityComponentRef>(null);

  // 2. Call methods with optional chaining (ref might be null initially)
  const handleAction = () => {
    const result = utilityRef.current?.method1('test');
    utilityRef.current?.method2();
  };

  // 3. Render utility component with ref
  return (
    <>
      <UtilityComponent ref={utilityRef} />
      <Button onPress={handleAction} />
    </>
  );
}
```

## Real-World Examples

### Example 1: LODCalculator

Calculates LOD tier with hysteresis, maintains tier state across frames.

```typescript
export interface LODCalculatorRef {
  calculateTier: (scale: number) => number;
  reset: () => void;
}

export const LODCalculator = forwardRef<LODCalculatorRef, {}>((props, ref) => {
  const tierState = useRef({
    current: 1,
    lastQuantizedScale: 1
  });

  useImperativeHandle(ref, () => ({
    calculateTier: (scale: number) => {
      const quantizedScale = Math.round(scale / 0.05) * 0.05;

      // Check if scale changed significantly
      if (Math.abs(quantizedScale - tierState.current.lastQuantizedScale) < 0.05) {
        return tierState.current.current; // Return cached tier
      }

      // Calculate new tier with hysteresis
      const nodePx = 85 * PixelRatio.get() * scale;
      let newTier = tierState.current.current;

      if (tierState.current.current === 1) {
        if (nodePx < 48 * 0.85) newTier = 2;
      } else if (tierState.current.current === 2) {
        if (nodePx >= 48 * 1.15) newTier = 1;
        else if (nodePx < 24 * 0.85) newTier = 3;
      } else {
        if (nodePx >= 24 * 1.15) newTier = 2;
      }

      // Update state if tier changed
      if (newTier !== tierState.current.current) {
        tierState.current = {
          current: newTier,
          lastQuantizedScale: quantizedScale,
        };
      }

      return newTier;
    },
    reset: () => {
      tierState.current = { current: 1, lastQuantizedScale: 1 };
    },
  }), []);

  return null;
});

// Usage in TreeView
const lodRef = useRef<LODCalculatorRef>(null);
const currentTier = lodRef.current?.calculateTier(scale) ?? 1;
```

### Example 2: ImageBuckets

Manages image bucket selection with hysteresis and debounced upgrades.

```typescript
export interface ImageBucketsRef {
  selectBucket: (nodeId: string, pixelSize: number) => number;
  clearBucket: (nodeId: string) => void;
  clearAllBuckets: () => void;
}

export const ImageBuckets = forwardRef<ImageBucketsRef, {}>((props, ref) => {
  const nodeBuckets = useRef(new Map<string, number>());
  const bucketTimers = useRef(new Map<string, NodeJS.Timeout>());

  useImperativeHandle(ref, () => ({
    selectBucket: (nodeId: string, pixelSize: number) => {
      const current = nodeBuckets.current.get(nodeId) || 256;
      const target = [80, 128, 256].find(b => b >= pixelSize) || 256;

      // Apply hysteresis (±20%)
      if (target > current && pixelSize < current * 1.2) {
        return current; // Stay at current
      }
      if (target < current && pixelSize > current * 0.8) {
        return current; // Stay at current
      }

      // Debounce upgrades (150ms)
      if (target > current) {
        clearTimeout(bucketTimers.current.get(nodeId));
        bucketTimers.current.set(
          nodeId,
          setTimeout(() => {
            nodeBuckets.current.set(nodeId, target);
          }, 150)
        );
        return current;
      }

      // Immediate downgrade
      nodeBuckets.current.set(nodeId, target);
      return target;
    },
    clearBucket: (nodeId: string) => {
      clearTimeout(bucketTimers.current.get(nodeId));
      bucketTimers.current.delete(nodeId);
      nodeBuckets.current.delete(nodeId);
    },
    clearAllBuckets: () => {
      bucketTimers.current.forEach(clearTimeout);
      bucketTimers.current.clear();
      nodeBuckets.current.clear();
    },
  }), []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      bucketTimers.current.forEach(clearTimeout);
      bucketTimers.current.clear();
    };
  }, []);

  return null;
});

// Usage in TreeView
const bucketsRef = useRef<ImageBucketsRef>(null);
const bucket = bucketsRef.current?.selectBucket(node.id, pixelSize) ?? 256;
```

## Best Practices

### ✅ Do's

1. **Keep dependency array empty**
   ```typescript
   useImperativeHandle(ref, () => ({
     method: () => { ... }
   }), []); // Empty deps = stable API
   ```

2. **Use optional chaining**
   ```typescript
   ref.current?.method(); // Safe - ref might be null
   ```

3. **Expose only imperative actions**
   ```typescript
   // ✅ Good
   { focus: () => inputRef.current?.focus() }

   // ❌ Bad
   { getData: () => stateData } // Use props instead
   ```

4. **Return null for utility components**
   ```typescript
   return null; // No JSX
   ```

5. **Type the ref interface**
   ```typescript
   export interface MyComponentRef { ... }
   const ref = useRef<MyComponentRef>(null);
   ```

### ❌ Don'ts

1. **Don't expose state setters**
   ```typescript
   // ❌ Bad
   { setState: (data) => setData(data) }

   // ✅ Good - use props/callbacks
   const Component = ({ onDataChange }) => { ... }
   ```

2. **Don't use for data fetching**
   ```typescript
   // ❌ Bad
   { fetchData: async () => { ... } }

   // ✅ Good - use useEffect
   useEffect(() => { fetchData(); }, []);
   ```

3. **Don't call ref methods in render**
   ```typescript
   // ❌ Bad
   function Component() {
     ref.current?.method(); // During render
     return <View />;
   }

   // ✅ Good
   useEffect(() => {
     ref.current?.method(); // After render
   }, []);
   ```

4. **Don't add dependencies unless necessary**
   ```typescript
   // ❌ Bad - deps invalidate ref
   useImperativeHandle(ref, () => ({
     method: () => doSomething(prop)
   }), [prop]);

   // ✅ Good - access props inside method
   useImperativeHandle(ref, () => ({
     method: () => doSomething(props.current)
   }), []);
   ```

## Performance Considerations

- **Refs don't cause re-renders** - Perfect for utility components
- **useImperativeHandle has minimal overhead** - <0.1ms per call
- **Stable API reference prevents re-renders** - Empty deps array critical
- **Internal state persists across renders** - useRef not useState

## Testing

```typescript
import { renderHook } from '@testing-library/react-hooks';

test('LODCalculator maintains state across calls', () => {
  const ref = React.createRef<LODCalculatorRef>();
  render(<LODCalculator ref={ref} />);

  // First call
  expect(ref.current?.calculateTier(1.0)).toBe(1);

  // Second call with same scale (should use cached tier)
  expect(ref.current?.calculateTier(1.0)).toBe(1);

  // Reset
  ref.current?.reset();
  expect(ref.current?.calculateTier(0.5)).toBe(2);
});
```

## Common Pitfalls

### Pitfall 1: Forgetting Optional Chaining

```typescript
// ❌ Crashes if ref is null
ref.current.method();

// ✅ Safe
ref.current?.method();
```

### Pitfall 2: Adding Unnecessary Dependencies

```typescript
// ❌ Ref API changes on every prop change
useImperativeHandle(ref, () => ({
  method: () => console.log(prop)
}), [prop]);

// ✅ Stable API
useImperativeHandle(ref, () => ({
  method: () => console.log(propsRef.current)
}), []);
```

### Pitfall 3: Using for State Management

```typescript
// ❌ Violates React data flow
useImperativeHandle(ref, () => ({
  setData: (data) => setState(data)
}));

// ✅ Use props/callbacks
<Component onDataChange={(data) => setState(data)} />
```

## Summary

**Ref forwarding is ideal for:**
- Utility components with no JSX
- Persistent state across renders (LOD tiers, image buckets)
- Imperative APIs (calculate, focus, scroll)
- Performance-critical code (no re-renders)

**Not ideal for:**
- State management (use props/context)
- Data fetching (use useEffect)
- Rendering components (use regular components)

Follow this pattern for LODCalculator and ImageBuckets integration in Phase 1.
