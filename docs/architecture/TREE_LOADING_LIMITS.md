# Tree Loading Limits

**Current Configuration**:
- **Database Max**: 10,000 profiles (safety buffer, supports design capacity)
- **Frontend Load**: 5,000 profiles (supports 3K incoming + 67% buffer)
- **Warning Threshold**: 3,750 profiles (75%)
- **Critical Threshold**: 4,750 profiles (95%)

## How It Works

### Viewport Culling
- Tree uses viewport culling to render only visible nodes (~500 max)
- Database supports up to 10K profiles (matching original design intent)
- Frontend loads 5K profiles - viewport culling handles rendering efficiently
- Monitoring logs warn when approaching limits
- **Rendering performance: 60fps regardless of dataset size**

## Monitoring Tree Size

### Console Logs
```javascript
// Check console on tree load
// ✅ Tree loaded: X profiles
// ⚠️ Approaching limit: 3750/5000 profiles. Consider increasing limit.
// 🚨 CRITICAL: 4750/5000 profiles. Immediate action required.
```

### Programmatic Check
```javascript
console.log(useTreeStore.getState().treeData.length);
```

## When to Increase Limit

Consider increasing limit or implementing progressive loading when:
- Tree size exceeds 4,500 profiles (90% of limit)
- Load times exceed 2 seconds on iPhone XR
- Memory usage exceeds 20MB for tree data
- User complaints about slow loading

## Performance Expectations

| Profiles | Load Time | Memory | Rendering | Status |
|----------|-----------|--------|-----------|--------|
| Current Size | <200ms | ~0.5MB | 60fps | ✅ Optimal |
| 2,000 | ~650ms | ~6MB | 60fps | ✅ Good |
| 3,000 (target) | ~950ms | ~9MB | 60fps | ✅ Good |
| 5,000 (limit) | ~1.3s | ~15MB | 60fps | ✅ Acceptable |
| 7,500 | ~1.6s | ~22MB | 60fps | ⚠️ Consider testing |

## Key Insight

**Rendering performance remains 60fps regardless of dataset size** due to viewport culling. The limits primarily affect initial load time and memory usage.

## Related Documentation

- [Progressive Loading](../PTS/README.md) - Phase 3B progressive loading system
- [TreeView Performance](../TREEVIEW_PERFORMANCE_OPTIMIZATION.md) - Performance optimizations
- [Viewport Culling](../architecture/GESTURE_SYSTEM.md) - Viewport calculations
