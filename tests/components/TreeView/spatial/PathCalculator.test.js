/**
 * PathCalculator tests
 * Phase 2 Day 1
 */

import {
  calculateBusY,
  calculateParentVerticalPath,
  shouldRenderBusLine,
  calculateBusLine,
  calculateChildVerticalPaths,
  calculateConnectionPaths,
} from '../../../../src/components/TreeView/spatial/PathCalculator';

describe('PathCalculator', () => {
  // Test data: Simple parent-child relationships
  const createParent = (x = 100, y = 50, hasPhoto = true) => ({
    id: 'parent',
    x,
    y,
    photo_url: hasPhoto ? 'https://example.com/photo.jpg' : null,
  });

  const createChild = (id, x, y, hasPhoto = true, hasFather = true) => ({
    id,
    x,
    y,
    father_id: hasFather ? 'parent' : null,
    photo_url: hasPhoto ? 'https://example.com/photo.jpg' : null,
  });

  describe('calculateBusY', () => {
    it('should calculate midpoint between parent and nearest child', () => {
      const parent = createParent(100, 50);
      const children = [createChild('c1', 80, 150), createChild('c2', 120, 150)];

      const busY = calculateBusY(parent, children);

      // Midpoint between 50 (parent) and 150 (nearest child)
      expect(busY).toBe(100);
    });

    it('should use nearest child when children at different Y levels', () => {
      const parent = createParent(100, 50);
      const children = [
        createChild('c1', 80, 130), // Nearer
        createChild('c2', 120, 170), // Farther
      ];

      const busY = calculateBusY(parent, children);

      // Midpoint between 50 (parent) and 130 (nearest child)
      expect(busY).toBe(90);
    });

    it('should handle single child', () => {
      const parent = createParent(100, 50);
      const children = [createChild('c1', 100, 150)];

      const busY = calculateBusY(parent, children);

      expect(busY).toBe(100);
    });
  });

  describe('calculateParentVerticalPath', () => {
    it('should calculate path from parent bottom with photo', () => {
      const parent = createParent(100, 50, true);
      const busY = 100;

      const path = calculateParentVerticalPath(parent, busY, true);

      expect(path.startX).toBe(100);
      expect(path.startY).toBe(50 + 75 / 2); // y + NODE_HEIGHT_WITH_PHOTO/2 = 87.5 (50px photo + 4px padding × 2)
      expect(path.endX).toBe(100);
      expect(path.endY).toBe(100);
    });

    it('should calculate path from parent bottom without photo', () => {
      const parent = createParent(100, 50, false);
      const busY = 100;

      const path = calculateParentVerticalPath(parent, busY, true);

      expect(path.startX).toBe(100);
      expect(path.startY).toBe(50 + 35 / 2); // y + NODE_HEIGHT_TEXT_ONLY/2 = 67.5
      expect(path.endX).toBe(100);
      expect(path.endY).toBe(100);
    });

    it('should respect showPhotos parameter', () => {
      const parent = createParent(100, 50, true);
      const busY = 100;

      const pathWithPhotos = calculateParentVerticalPath(parent, busY, true);
      const pathWithoutPhotos = calculateParentVerticalPath(parent, busY, false);

      expect(pathWithPhotos.startY).not.toBe(pathWithoutPhotos.startY);
    });
  });

  describe('shouldRenderBusLine', () => {
    it('should return true for multiple children', () => {
      const parent = createParent(100, 50);
      const children = [createChild('c1', 80, 150), createChild('c2', 120, 150)];

      const result = shouldRenderBusLine(children, parent);

      expect(result).toBe(true);
    });

    it('should return true for single child with X offset', () => {
      const parent = createParent(100, 50);
      const children = [createChild('c1', 110, 150)]; // Offset by 10

      const result = shouldRenderBusLine(children, parent);

      expect(result).toBe(true);
    });

    it('should return false for single child aligned with parent', () => {
      const parent = createParent(100, 50);
      const children = [createChild('c1', 100, 150)]; // Same X

      const result = shouldRenderBusLine(children, parent);

      expect(result).toBe(false);
    });

    it('should return false for single child with small offset (<5px)', () => {
      const parent = createParent(100, 50);
      const children = [createChild('c1', 103, 150)]; // Offset by 3

      const result = shouldRenderBusLine(children, parent);

      expect(result).toBe(false);
    });
  });

  describe('calculateBusLine', () => {
    it('should span from leftmost to rightmost child', () => {
      const children = [createChild('c1', 80, 150), createChild('c2', 120, 150)];
      const busY = 100;

      const busLine = calculateBusLine(children, busY);

      expect(busLine.startX).toBe(80); // Leftmost
      expect(busLine.endX).toBe(120); // Rightmost
      expect(busLine.startY).toBe(100);
      expect(busLine.endY).toBe(100);
    });

    it('should handle children in any order', () => {
      const children = [
        createChild('c1', 120, 150),
        createChild('c2', 80, 150),
        createChild('c3', 100, 150),
      ];
      const busY = 100;

      const busLine = calculateBusLine(children, busY);

      expect(busLine.startX).toBe(80);
      expect(busLine.endX).toBe(120);
    });

    it('should work with single child', () => {
      const children = [createChild('c1', 100, 150)];
      const busY = 100;

      const busLine = calculateBusLine(children, busY);

      expect(busLine.startX).toBe(100);
      expect(busLine.endX).toBe(100);
    });
  });

  describe('calculateChildVerticalPaths', () => {
    it('should calculate paths for multiple children with photos', () => {
      const children = [
        createChild('c1', 80, 150, true, true),
        createChild('c2', 120, 150, true, true),
      ];
      const busY = 100;

      const paths = calculateChildVerticalPaths(children, busY, true);

      expect(paths).toHaveLength(2);

      // Child 1
      expect(paths[0].startX).toBe(80);
      expect(paths[0].startY).toBe(100); // busY
      expect(paths[0].endX).toBe(80);
      expect(paths[0].endY).toBe(150 - 75 / 2); // y - NODE_HEIGHT_WITH_PHOTO/2 = 112.5 (50px photo + 4px padding × 2)

      // Child 2
      expect(paths[1].startX).toBe(120);
      expect(paths[1].startY).toBe(100);
      expect(paths[1].endX).toBe(120);
      expect(paths[1].endY).toBe(150 - 75 / 2); // y - NODE_HEIGHT_WITH_PHOTO/2 = 112.5 (50px photo + 4px padding × 2)
    });

    it('should calculate paths for children without photos', () => {
      const children = [createChild('c1', 100, 150, false, true)];
      const busY = 100;

      const paths = calculateChildVerticalPaths(children, busY, true);

      expect(paths[0].endY).toBe(150 - 35 / 2); // y - NODE_HEIGHT_TEXT_ONLY/2 = 132.5
    });

    it('should handle root nodes (no father) with fixed height', () => {
      const children = [createChild('c1', 100, 150, true, false)]; // No father
      const busY = 100;

      const paths = calculateChildVerticalPaths(children, busY, true);

      expect(paths[0].endY).toBe(150 - 100 / 2); // y - 100/2 (root height)
    });

    it('should respect showPhotos parameter', () => {
      const children = [createChild('c1', 100, 150, true, true)];
      const busY = 100;

      const pathsWithPhotos = calculateChildVerticalPaths(children, busY, true);
      const pathsWithoutPhotos = calculateChildVerticalPaths(children, busY, false);

      expect(pathsWithPhotos[0].endY).not.toBe(pathsWithoutPhotos[0].endY);
    });
  });

  describe('calculateConnectionPaths', () => {
    it('should combine all path segments for multiple children', () => {
      const connection = {
        parent: createParent(100, 50, true),
        children: [createChild('c1', 80, 150), createChild('c2', 120, 150)],
      };

      const segments = calculateConnectionPaths(connection, true);

      // Should have: 1 parent vertical + 1 bus line + 2 child verticals = 4
      expect(segments).toHaveLength(4);

      // Parent vertical
      expect(segments[0].startX).toBe(100);
      expect(segments[0].endY).toBe(100); // busY

      // Bus line
      expect(segments[1].startX).toBe(80);
      expect(segments[1].endX).toBe(120);
      expect(segments[1].startY).toBe(100);

      // Child verticals
      expect(segments[2].startX).toBe(80);
      expect(segments[3].startX).toBe(120);
    });

    it('should omit bus line when not needed', () => {
      const connection = {
        parent: createParent(100, 50),
        children: [createChild('c1', 100, 150)], // Aligned with parent
      };

      const segments = calculateConnectionPaths(connection, true);

      // Should have: 1 parent vertical + 0 bus line + 1 child vertical = 2
      expect(segments).toHaveLength(2);

      // Parent vertical
      expect(segments[0].startX).toBe(100);

      // Child vertical (no bus line in between)
      expect(segments[1].startX).toBe(100);
    });

    it('should handle single child with offset', () => {
      const connection = {
        parent: createParent(100, 50),
        children: [createChild('c1', 120, 150)], // Offset by 20
      };

      const segments = calculateConnectionPaths(connection, true);

      // Should have: 1 parent vertical + 1 bus line + 1 child vertical = 3
      expect(segments).toHaveLength(3);

      // Bus line included due to offset
      expect(segments[1].startX).toBe(120);
      expect(segments[1].endX).toBe(120);
    });

    it('should handle root child nodes', () => {
      const connection = {
        parent: createParent(100, 50),
        children: [createChild('c1', 100, 150, true, false)], // Root node
      };

      const segments = calculateConnectionPaths(connection, true);

      // Last segment should use root height (100px)
      const childPath = segments[segments.length - 1];
      expect(childPath.endY).toBe(150 - 100 / 2);
    });

    it('should respect showPhotos parameter', () => {
      const connection = {
        parent: createParent(100, 50, true),
        children: [createChild('c1', 100, 150, true)],
      };

      const segmentsWithPhotos = calculateConnectionPaths(connection, true);
      const segmentsWithoutPhotos = calculateConnectionPaths(connection, false);

      // Parent and child paths should differ based on photo visibility
      expect(segmentsWithPhotos[0].startY).not.toBe(segmentsWithoutPhotos[0].startY);
    });
  });
});
