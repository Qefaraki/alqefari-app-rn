/**
 * Mock Tree Store Helper
 *
 * Provides reusable mock store factory for TreeView component tests.
 * Extracted from BranchTreeFeatures.test.js to enable test reuse.
 */

/**
 * Creates a mock Zustand store for TreeView.core testing
 *
 * @param {Object} options - Configuration options
 * @param {Array} options.treeData - Array of profile nodes with d3 layout coordinates
 * @param {Object} options.stateOverrides - Additional state properties to override defaults
 * @param {Object} options.actionOverrides - Additional action mocks to override defaults
 * @returns {Object} Mock store with state and actions matching TreeView.core requirements
 */
export const createMockTreeStore = ({
  treeData = [],
  stateOverrides = {},
  actionOverrides = {}
} = {}) => ({
  state: {
    treeData,
    stage: 'idle',
    isTreeLoaded: true,
    selectedPersonId: null,
    linkedProfileId: null,
    minZoom: 0.1,
    maxZoom: 3,
    nodesMap: new Map(),
    indices: { byId: new Map(), byHid: new Map() },
    showPhotos: true,
    highlightMyLine: false,
    focusOnProfile: false,
    loadingState: { isLoading: false, message: null },
    pendingCousinHighlight: null,
    profileSheetProgress: null,
    ...stateOverrides,
  },
  actions: {
    setTreeData: jest.fn(),
    updateNode: jest.fn(),
    addNode: jest.fn(),
    removeNode: jest.fn(),
    setStage: jest.fn(),
    setSelectedPersonId: jest.fn(),
    setLinkedProfileId: jest.fn(),
    setShowPhotos: jest.fn(),
    setHighlightMyLine: jest.fn(),
    setFocusOnProfile: jest.fn(),
    setLoadingState: jest.fn(),
    setPendingCousinHighlight: jest.fn(),
    initializeProfileSheetProgress: jest.fn(),
    ...actionOverrides,
  }
});

/**
 * Creates a mock profile node with d3 layout coordinates
 *
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Mock profile node
 */
export const createMockProfile = (overrides = {}) => ({
  id: '123',
  name: 'Test Person',
  father_id: null,
  x: 100,
  y: 100,
  depth: 0,
  ...overrides,
});

/**
 * Minimal required props for TreeViewCore component
 * All props are Jest mocks and can be overridden per test
 */
export const createMinimalProps = (overrides = {}) => ({
  setProfileEditMode: jest.fn(),
  onNetworkStatusChange: jest.fn(),
  user: null,
  profile: null,
  linkedProfileId: null,
  isAdmin: false,
  onAdminDashboard: jest.fn(),
  onSettingsOpen: jest.fn(),
  highlightProfileId: null,
  focusOnProfile: false,
  spouse1Id: null,
  spouse2Id: null,
  ...overrides,
});
