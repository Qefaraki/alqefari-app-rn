/**
 * NodeRenderer Tests
 *
 * Test suite for LOD Tier 1 full node card rendering.
 *
 * Coverage:
 * - Node dimension calculation (root, G2 parent, standard)
 * - Hero/Tier detection
 * - Shadow/background/border rendering
 * - Photo placeholder rendering
 * - Generation badge rendering
 * - Name text rendering
 * - Photo layout (avatar + text below)
 * - Text-only layout (name centered)
 * - Root node special handling (120px, 22pt, Sadu icons)
 * - G2 parent special handling (95px/75px, smaller Sadu icons)
 * - Selection state (border color/width)
 * - Frame tracking for highlights
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import {
  NodeRenderer,
  calculateNodeDimensions,
  isHeroNode,
  isSearchTier2,
  renderShadow,
  renderBackground,
  renderBorder,
  renderPhotoPlaceholder,
  renderGenerationBadge,
  renderNameText,
  NODE_RENDERER_CONSTANTS,
} from '../../../../src/components/TreeView/rendering/NodeRenderer';

// Mock batched image loading hook
const mockUseBatchedSkiaImage = jest.fn((url, bucket, priority) => {
  // Return null (skeleton) for tests
  return null;
});

// Mock ImageNode to use our batched image hook
jest.mock('../../../../src/components/TreeView/rendering/ImageNode', () => {
  const actual = jest.requireActual('../../../../src/components/TreeView/rendering/ImageNode');
  return {
    ...actual,
    ImageNode: ({ url, x, y, width, height, radius, tier, scale, nodeId, selectBucket, showPhotos }) => {
      // Use the mock hook
      mockUseBatchedSkiaImage(url, 256, 'visible');
      return null; // Return null for test rendering
    },
  };
});

describe('NodeRenderer', () => {
  beforeEach(() => {
    mockUseBatchedSkiaImage.mockClear();
  });
  // ============================================================================
  // CONSTANTS TESTS
  // ============================================================================

  describe('NODE_RENDERER_CONSTANTS', () => {
    test('should export expected constants', () => {
      expect(NODE_RENDERER_CONSTANTS.NODE_WIDTH_WITH_PHOTO).toBe(58); // 50px photo + 4px padding × 2 (breathing room)
      expect(NODE_RENDERER_CONSTANTS.NODE_HEIGHT_WITH_PHOTO).toBe(75); // 50px photo + 4px padding × 2 + 17px name space
      expect(NODE_RENDERER_CONSTANTS.NODE_WIDTH_TEXT_ONLY).toBe(58);  // Same as photo card width
      expect(NODE_RENDERER_CONSTANTS.NODE_HEIGHT_TEXT_ONLY).toBe(35);
      expect(NODE_RENDERER_CONSTANTS.PHOTO_SIZE).toBe(50);
      expect(NODE_RENDERER_CONSTANTS.CORNER_RADIUS).toBe(10); // Smooth corners
      expect(NODE_RENDERER_CONSTANTS.SELECTION_BORDER).toBe(2.5); // Restored for visibility
      expect(NODE_RENDERER_CONSTANTS.ROOT_WIDTH).toBe(120);
      expect(NODE_RENDERER_CONSTANTS.ROOT_HEIGHT).toBe(100);
      expect(NODE_RENDERER_CONSTANTS.ROOT_BORDER_RADIUS).toBe(20);
      expect(NODE_RENDERER_CONSTANTS.G2_PHOTO_WIDTH).toBe(95);
      expect(NODE_RENDERER_CONSTANTS.G2_TEXT_WIDTH).toBe(75);
      expect(NODE_RENDERER_CONSTANTS.G2_BORDER_RADIUS).toBe(16);
    });
  });

  // ============================================================================
  // CALCULATE NODE DIMENSIONS TESTS
  // ============================================================================

  describe('calculateNodeDimensions', () => {
    test('should return root dimensions', () => {
      const node = { id: 'n1', name: 'Root', generation: 1, father_id: null, x: 0, y: 0 };

      const result = calculateNodeDimensions(node, true, false);

      expect(result.width).toBe(120);
      expect(result.height).toBe(100);
      expect(result.borderRadius).toBe(20);
    });

    test('should return G2 parent dimensions with photo', () => {
      const node = {
        id: 'n1',
        name: 'G2',
        generation: 2,
        father_id: 'root',
        photo_url: 'http://example.com/photo.jpg',
        x: 0,
        y: 0,
      };

      const result = calculateNodeDimensions(node, true, true);

      expect(result.width).toBe(95);
      expect(result.height).toBe(75); // TEMP: Minimal padding
      expect(result.borderRadius).toBe(16);
    });

    test('should return G2 parent dimensions text-only', () => {
      const node = {
        id: 'n1',
        name: 'G2',
        generation: 2,
        father_id: 'root',
        x: 0,
        y: 0,
      };

      const result = calculateNodeDimensions(node, false, true);

      expect(result.width).toBe(75);
      expect(result.height).toBe(35);
      expect(result.borderRadius).toBe(16);
    });

    test('should return standard dimensions with photo', () => {
      const node = {
        id: 'n1',
        name: 'Standard',
        generation: 3,
        father_id: 'g2',
        photo_url: 'http://example.com/photo.jpg',
        x: 0,
        y: 0,
      };

      const result = calculateNodeDimensions(node, true, false);

      expect(result.width).toBe(58); // 50px photo + 4px padding × 2 (breathing room)
      expect(result.height).toBe(75); // 50px photo + 4px padding × 2 + 17px name space
      expect(result.borderRadius).toBe(10); // Smooth corners
    });

    test('should return standard dimensions text-only', () => {
      const node = {
        id: 'n1',
        name: 'Standard',
        generation: 3,
        father_id: 'g2',
        x: 0,
        y: 0,
      };

      const result = calculateNodeDimensions(node, false, false);

      expect(result.width).toBe(58); // 58px card width (matches photo)
      expect(result.height).toBe(35);
      expect(result.borderRadius).toBe(10); // Smooth corners
    });

    test('should use custom nodeWidth if provided', () => {
      const node = {
        id: 'n1',
        name: 'Custom',
        generation: 3,
        father_id: 'g2',
        nodeWidth: 100,
        x: 0,
        y: 0,
      };

      const result = calculateNodeDimensions(node, false, false);

      expect(result.width).toBe(100);
    });

    test('should handle G2 without children (standard node)', () => {
      const node = {
        id: 'n1',
        name: 'G2 No Kids',
        generation: 2,
        father_id: 'root',
        x: 0,
        y: 0,
      };

      const result = calculateNodeDimensions(node, false, false);

      expect(result.width).toBe(58); // Standard, not G2 parent (58px card width)
      expect(result.borderRadius).toBe(10); // Smooth corners
    });
  });

  // ============================================================================
  // HERO/TIER DETECTION TESTS
  // ============================================================================

  describe('isHeroNode', () => {
    test('should return true for hero node', () => {
      const heroNodes = [{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }];

      expect(isHeroNode('h2', heroNodes)).toBe(true);
    });

    test('should return false for non-hero node', () => {
      const heroNodes = [{ id: 'h1' }, { id: 'h2' }];

      expect(isHeroNode('h3', heroNodes)).toBe(false);
    });

    test('should return false for undefined heroNodes', () => {
      expect(isHeroNode('h1', undefined)).toBe(false);
    });

    test('should return false for empty heroNodes', () => {
      expect(isHeroNode('h1', [])).toBe(false);
    });
  });

  describe('isSearchTier2', () => {
    test('should return true for Tier 2 node', () => {
      const searchTiers = { n1: 1, n2: 2, n3: 1 };

      expect(isSearchTier2('n2', searchTiers)).toBe(true);
    });

    test('should return false for non-Tier 2 node', () => {
      const searchTiers = { n1: 1, n2: 2 };

      expect(isSearchTier2('n1', searchTiers)).toBe(false);
    });

    test('should return false for undefined searchTiers', () => {
      expect(isSearchTier2('n1', undefined)).toBe(false);
    });

    test('should return false for missing node', () => {
      const searchTiers = { n1: 2 };

      expect(isSearchTier2('n2', searchTiers)).toBe(false);
    });
  });

  // ============================================================================
  // RENDERING HELPER TESTS
  // ============================================================================

  describe('renderShadow', () => {
    test('should render shadow at correct position', () => {
      const result = renderShadow(100, 200, 85, 105, 13);

      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
    });

    test('should offset shadow by 1px', () => {
      const result = renderShadow(0, 0, 85, 105, 13);
      expect(result).toBeDefined();
    });
  });

  describe('renderBackground', () => {
    test('should render background at correct position', () => {
      const result = renderBackground(100, 200, 85, 105, 13);

      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
    });
  });

  describe('renderBorder', () => {
    test('should render border with selection state', () => {
      const selectedResult = renderBorder(100, 200, 85, 105, 13, true);
      const normalResult = renderBorder(100, 200, 85, 105, 13, false);

      expect(selectedResult).toBeDefined();
      expect(normalResult).toBeDefined();
    });
  });

  describe('renderPhotoPlaceholder', () => {
    test('should render photo placeholder circles', () => {
      const result = renderPhotoPlaceholder(100, 200, 25);

      expect(result).toBeDefined();
    });
  });

  describe('renderGenerationBadge', () => {
    const mockGetParagraph = jest.fn((text) => ({
      getHeight: () => 10,
    }));

    beforeEach(() => {
      mockGetParagraph.mockClear();
    });

    test('should render generation badge', () => {
      const result = renderGenerationBadge(3, 100, 200, 15, mockGetParagraph);

      expect(result).toBeDefined();
      expect(mockGetParagraph).toHaveBeenCalledWith('3', 'regular', 7, '#24212140', 15);
    });

    test('should return null if paragraph creation fails', () => {
      mockGetParagraph.mockReturnValue(null);

      const result = renderGenerationBadge(3, 100, 200, 15, mockGetParagraph);

      expect(result).toBeNull();
    });
  });

  describe('renderNameText', () => {
    const mockGetParagraph = jest.fn((text) => ({
      getHeight: () => 15,
    }));

    beforeEach(() => {
      mockGetParagraph.mockClear();
    });

    test('should render name text with standard size', () => {
      const result = renderNameText('محمد', false, 100, 200, 85, mockGetParagraph);

      expect(result).toBeDefined();
      expect(mockGetParagraph).toHaveBeenCalledWith('محمد', 'bold', 11, '#242121', 85);
    });

    test('should render name text with root size', () => {
      const result = renderNameText('Root', true, 100, 200, 120, mockGetParagraph);

      expect(result).toBeDefined();
      expect(mockGetParagraph).toHaveBeenCalledWith('Root', 'bold', 22, '#242121', 120);
    });

    test('should return null if paragraph creation fails', () => {
      mockGetParagraph.mockReturnValue(null);

      const result = renderNameText('Name', false, 100, 200, 85, mockGetParagraph);

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // NODE RENDERER COMPONENT TESTS
  // ============================================================================

  describe('NodeRenderer component', () => {
    const mockGetParagraph = jest.fn((text) => ({
      getHeight: () => 15,
    }));

    const MockSaduIcon = ({ x, y, size }) => null;
    const MockSaduIconG2 = ({ x, y, size }) => null;

    const nodeFramesRef = { current: new Map() };

    const defaultProps = {
      node: {
        id: 'n1',
        name: 'محمد',
        generation: 3,
        father_id: 'f1',
        x: 100,
        y: 200,
      },
      showPhotos: true,
      selectedPersonId: null,
      getCachedParagraph: mockGetParagraph,
      SaduIcon: MockSaduIcon,
      SaduIconG2: MockSaduIconG2,
      nodeFramesRef,
    };

    beforeEach(() => {
      mockGetParagraph.mockClear();
      nodeFramesRef.current.clear();
    });

    test('should render standard node with photo', () => {
      const node = {
        ...defaultProps.node,
        photo_url: 'http://example.com/photo.jpg',
        _tier: 1,
        _scale: 1.0,
      };

      const { UNSAFE_root } = render(
        <NodeRenderer {...defaultProps} node={node} />
      );

      expect(UNSAFE_root).toBeDefined();
      expect(nodeFramesRef.current.has('n1')).toBe(true);
    });

    test('should render standard node text-only', () => {
      const { UNSAFE_root } = render(
        <NodeRenderer {...defaultProps} showPhotos={false} />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should render root node', () => {
      const rootNode = {
        ...defaultProps.node,
        generation: 1,
        father_id: null,
      };

      const { UNSAFE_root } = render(
        <NodeRenderer {...defaultProps} node={rootNode} showPhotos={false} />
      );

      expect(UNSAFE_root).toBeDefined();
      const frame = nodeFramesRef.current.get('n1');
      expect(frame.width).toBe(120);
      expect(frame.height).toBe(100);
    });

    test('should render G2 parent node with photo', () => {
      const g2Node = {
        ...defaultProps.node,
        generation: 2,
        photo_url: 'http://example.com/photo.jpg',
        _hasChildren: true,
        _tier: 1,
        _scale: 1.0,
      };

      const { UNSAFE_root } = render(
        <NodeRenderer {...defaultProps} node={g2Node} />
      );

      expect(UNSAFE_root).toBeDefined();
      const frame = nodeFramesRef.current.get('n1');
      expect(frame.width).toBe(95);
    });

    test('should render G2 parent node text-only', () => {
      const g2Node = {
        ...defaultProps.node,
        generation: 2,
        _hasChildren: true,
      };

      const { UNSAFE_root } = render(
        <NodeRenderer {...defaultProps} node={g2Node} showPhotos={false} />
      );

      expect(UNSAFE_root).toBeDefined();
      const frame = nodeFramesRef.current.get('n1');
      expect(frame.width).toBe(75);
    });

    test('should show selected border', () => {
      const { UNSAFE_root } = render(
        <NodeRenderer {...defaultProps} selectedPersonId="n1" />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should handle hero node (T1)', () => {
      const heroNodes = [{ id: 'n1' }];

      const { UNSAFE_root } = render(
        <NodeRenderer {...defaultProps} heroNodes={heroNodes} />
      );

      expect(UNSAFE_root).toBeDefined();
      const frame = nodeFramesRef.current.get('n1');
      expect(frame.borderRadius).toBe(16); // T1 radius
    });

    test('should handle search tier 2 node', () => {
      const searchTiers = { n1: 2 };

      const { UNSAFE_root } = render(
        <NodeRenderer {...defaultProps} searchTiers={searchTiers} />
      );

      expect(UNSAFE_root).toBeDefined();
      const frame = nodeFramesRef.current.get('n1');
      expect(frame.borderRadius).toBe(13); // T2 radius
    });

    test('should update frame tracking', () => {
      const { UNSAFE_root } = render(
        <NodeRenderer {...defaultProps} />
      );

      const frame = nodeFramesRef.current.get('n1');
      expect(frame).toBeDefined();
      expect(frame.x).toBeDefined();
      expect(frame.y).toBeDefined();
      expect(frame.width).toBeDefined();
      expect(frame.height).toBeDefined();
      expect(frame.borderRadius).toBeDefined();
    });

    test('should handle custom nodeWidth', () => {
      const customNode = {
        ...defaultProps.node,
        nodeWidth: 100,
      };

      const { UNSAFE_root } = render(
        <NodeRenderer {...defaultProps} node={customNode} showPhotos={false} />
      );

      const frame = nodeFramesRef.current.get('n1');
      expect(frame.width).toBe(100);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration', () => {
    const mockGetParagraph = jest.fn((text) => ({
      getHeight: () => 15,
    }));

    const MockSaduIcon = ({ x, y, size }) => null;
    const MockSaduIconG2 = ({ x, y, size }) => null;

    const nodeFramesRef = { current: new Map() };

    test('should handle root node with photo and selection', () => {
      const rootNode = {
        id: 'root',
        name: 'الأصل',
        generation: 1,
        father_id: null,
        photo_url: 'http://example.com/photo.jpg',
        x: 0,
        y: 0,
        _tier: 1,
        _scale: 1.0,
      };

      const { UNSAFE_root } = render(
        <NodeRenderer
          node={rootNode}
          showPhotos={true}
          selectedPersonId="root"
          getCachedParagraph={mockGetParagraph}
          SaduIcon={MockSaduIcon}
          SaduIconG2={MockSaduIconG2}
          nodeFramesRef={nodeFramesRef}
        />
      );

      expect(UNSAFE_root).toBeDefined();
      const frame = nodeFramesRef.current.get('root');
      expect(frame.width).toBe(120);
      expect(frame.borderRadius).toBe(20);
    });

    test('should handle G2 parent text-only with Sadu icons', () => {
      const g2Node = {
        id: 'g2',
        name: 'عبدالله',
        generation: 2,
        father_id: 'root',
        x: 100,
        y: 200,
        _hasChildren: true,
      };

      const { UNSAFE_root } = render(
        <NodeRenderer
          node={g2Node}
          showPhotos={false}
          selectedPersonId={null}
          getCachedParagraph={mockGetParagraph}
          SaduIcon={MockSaduIcon}
          SaduIconG2={MockSaduIconG2}
          nodeFramesRef={nodeFramesRef}
        />
      );

      expect(UNSAFE_root).toBeDefined();
      const frame = nodeFramesRef.current.get('g2');
      expect(frame.width).toBe(75);
    });

    test('should handle photo node with generation badge', () => {
      const photoNode = {
        id: 'n1',
        name: 'محمد',
        generation: 5,
        father_id: 'f1',
        photo_url: 'http://example.com/photo.jpg',
        x: 100,
        y: 200,
        _tier: 1,
        _scale: 1.0,
      };

      const { UNSAFE_root } = render(
        <NodeRenderer
          node={photoNode}
          showPhotos={true}
          selectedPersonId={null}
          getCachedParagraph={mockGetParagraph}
          SaduIcon={MockSaduIcon}
          SaduIconG2={MockSaduIconG2}
          nodeFramesRef={nodeFramesRef}
        />
      );

      expect(UNSAFE_root).toBeDefined();
      // Component renders name text for photo nodes
      expect(mockGetParagraph).toHaveBeenCalledWith('محمد', 'bold', 11, expect.any(String), expect.any(Number));
    });
  });
});
