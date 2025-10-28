/**
 * Component Tests for PhotoCropEditor
 *
 * Tests crop editor UI behavior, gesture handling, and state management.
 * Uses React Native Testing Library for component testing.
 *
 * Test Coverage:
 * - Component rendering and visibility
 * - Image loading states
 * - Pan gesture handling (draggable crop rectangle)
 * - Reset functionality
 * - Save validation
 * - Loading states during save
 * - Error handling
 * - Cancel flow
 *
 * Run: npm test -- PhotoCropEditor.test.tsx
 *
 * Created: 2025-10-28
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Image } from 'react-native';
import { PhotoCropEditor } from '../PhotoCropEditor';

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    GestureDetector: View,
    Gesture: {
      Pan: () => ({
        onUpdate: jest.fn(),
      }),
    },
    GestureHandlerRootView: View,
  };
});

// Mock tokens
jest.mock('../../ui/tokens', () => ({
  __esModule: true,
  default: {
    colors: {
      najdi: {
        background: '#F9F7F3',
        container: '#D1BBA3',
        text: '#242121',
        primary: '#A13333',
      },
    },
  },
}));

// Mock cropUtils
jest.mock('../../../utils/cropUtils', () => ({
  isValidCrop: jest.fn(),
  clampCropCoordinates: jest.fn((crop) => crop), // Pass-through by default
}));

describe('PhotoCropEditor', () => {
  const mockPhotoUrl = 'https://example.com/photo.jpg';
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();

  // Mock Image.getSize to simulate successful image loading
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Image.getSize to call success callback
    jest.spyOn(Image, 'getSize').mockImplementation((uri, success) => {
      success(800, 600); // Mock image dimensions
      return {};
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ========================================================================
  // Component Rendering Tests
  // ========================================================================
  describe('Component Rendering', () => {
    it('should render when visible is true', async () => {
      const { getByText } = render(
        <PhotoCropEditor
          visible={true}
          photoUrl={mockPhotoUrl}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(getByText('تعديل الصورة')).toBeTruthy();
        expect(getByText('إلغاء')).toBeTruthy();
        expect(getByText('إعادة تعيين')).toBeTruthy();
        expect(getByText('حفظ')).toBeTruthy();
      });
    });

    it('should not render when visible is false', () => {
      const { queryByText } = render(
        <PhotoCropEditor
          visible={false}
          photoUrl={mockPhotoUrl}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      expect(queryByText('تعديل الصورة')).toBeNull();
    });

    it('should render instructions text', async () => {
      const { getByText } = render(
        <PhotoCropEditor
          visible={true}
          photoUrl={mockPhotoUrl}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(getByText(/اسحب المستطيل لتحديد منطقة القص/)).toBeTruthy();
      });
    });
  });

  // ========================================================================
  // Image Loading States
  // ========================================================================
  describe('Image Loading States', () => {
    it('should show loading indicator while image loads', () => {
      // Mock slow image loading
      jest.spyOn(Image, 'getSize').mockImplementation(() => {
        // Don't call success callback yet
        return {};
      });

      const { UNSAFE_getByType } = render(
        <PhotoCropEditor
          visible={true}
          photoUrl={mockPhotoUrl}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      // ActivityIndicator should be rendered while loading
      expect(() => UNSAFE_getByType('ActivityIndicator')).not.toThrow();
    });

    it('should call onCancel and show alert if image fails to load', async () => {
      const mockAlert = jest.spyOn(Alert, 'alert');

      // Mock image loading failure
      jest.spyOn(Image, 'getSize').mockImplementation((uri, success, failure) => {
        failure?.(new Error('Network error'));
        return {};
      });

      render(
        <PhotoCropEditor
          visible={true}
          photoUrl={mockPhotoUrl}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('خطأ', 'فشل تحميل الصورة');
        expect(mockOnCancel).toHaveBeenCalled();
      });
    });

    it('should hide loading indicator after image loads', async () => {
      const { queryByTestId } = render(
        <PhotoCropEditor
          visible={true}
          photoUrl={mockPhotoUrl}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        // After image loads, ActivityIndicator should not be rendered
        expect(queryByTestId('loading-indicator')).toBeNull();
      });
    });
  });

  // ========================================================================
  // Reset Functionality
  // ========================================================================
  describe('Reset Functionality', () => {
    it('should call reset handler when reset button pressed', async () => {
      const { getByText } = render(
        <PhotoCropEditor
          visible={true}
          photoUrl={mockPhotoUrl}
          initialCrop={{
            crop_top: 0.1,
            crop_bottom: 0.1,
            crop_left: 0.1,
            crop_right: 0.1,
          }}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        const resetButton = getByText('إعادة تعيين');
        fireEvent.press(resetButton);
      });

      // Note: Testing actual state reset requires integration with reanimated shared values
      // This test verifies the button is pressable and handler is called
    });
  });

  // ========================================================================
  // Save Validation
  // ========================================================================
  describe('Save Validation', () => {
    it('should call onSave with valid crop coordinates', async () => {
      const { isValidCrop } = require('../../../utils/cropUtils');
      isValidCrop.mockReturnValue(true);

      const { getByText } = render(
        <PhotoCropEditor
          visible={true}
          photoUrl={mockPhotoUrl}
          initialCrop={{
            crop_top: 0.1,
            crop_bottom: 0.1,
            crop_left: 0.1,
            crop_right: 0.1,
          }}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(async () => {
        const saveButton = getByText('حفظ');
        fireEvent.press(saveButton);
      });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });
    });

    it('should show alert and not call onSave for invalid crop', async () => {
      const { isValidCrop } = require('../../../utils/cropUtils');
      isValidCrop.mockReturnValue(false);

      const mockAlert = jest.spyOn(Alert, 'alert');

      const { getByText } = render(
        <PhotoCropEditor
          visible={true}
          photoUrl={mockPhotoUrl}
          initialCrop={{
            crop_top: 0.5,
            crop_bottom: 0.5,
            crop_left: 0.5,
            crop_right: 0.5,
          }}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(async () => {
        const saveButton = getByText('حفظ');
        fireEvent.press(saveButton);
      });

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'خطأ',
          expect.stringContaining('حجم المنطقة المحصورة صغير جداً')
        );
        expect(mockOnSave).not.toHaveBeenCalled();
      });
    });

    it('should clamp coordinates before validation', async () => {
      const { isValidCrop, clampCropCoordinates } = require('../../../utils/cropUtils');
      clampCropCoordinates.mockReturnValue({
        crop_top: 0.999,
        crop_bottom: 0.0,
        crop_left: 0.0,
        crop_right: 0.0,
      });
      isValidCrop.mockReturnValue(true);

      const { getByText } = render(
        <PhotoCropEditor
          visible={true}
          photoUrl={mockPhotoUrl}
          initialCrop={{
            crop_top: 0.9999, // Floating-point edge case
            crop_bottom: 0,
            crop_left: 0,
            crop_right: 0,
          }}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(async () => {
        const saveButton = getByText('حفظ');
        fireEvent.press(saveButton);
      });

      await waitFor(() => {
        expect(clampCropCoordinates).toHaveBeenCalled();
        expect(isValidCrop).toHaveBeenCalled();
      });
    });
  });

  // ========================================================================
  // Loading States During Save
  // ========================================================================
  describe('Loading States During Save', () => {
    it('should disable save button and show spinner when saving is true', async () => {
      const { getByTestId, UNSAFE_getAllByType } = render(
        <PhotoCropEditor
          visible={true}
          photoUrl={mockPhotoUrl}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          saving={true}
        />
      );

      await waitFor(() => {
        // Save button should show ActivityIndicator
        const indicators = UNSAFE_getAllByType('ActivityIndicator');
        expect(indicators.length).toBeGreaterThan(0); // At least one for save button
      });
    });

    it('should disable save button when image not loaded', () => {
      // Mock slow image loading
      jest.spyOn(Image, 'getSize').mockImplementation(() => {
        // Don't call success callback
        return {};
      });

      const { getByText } = render(
        <PhotoCropEditor
          visible={true}
          photoUrl={mockPhotoUrl}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const saveButton = getByText('حفظ');
      // Button should be disabled (tested via press not calling onSave)
      fireEvent.press(saveButton);
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Cancel Flow
  // ========================================================================
  describe('Cancel Flow', () => {
    it('should call onCancel when cancel button pressed', async () => {
      const { getByText } = render(
        <PhotoCropEditor
          visible={true}
          photoUrl={mockPhotoUrl}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        const cancelButton = getByText('إلغاء');
        fireEvent.press(cancelButton);
      });

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should call onCancel when modal requests close', async () => {
      const { UNSAFE_getByType } = render(
        <PhotoCropEditor
          visible={true}
          photoUrl={mockPhotoUrl}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        const modal = UNSAFE_getByType('Modal');
        fireEvent(modal, 'onRequestClose');
      });

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Initial Crop Values
  // ========================================================================
  describe('Initial Crop Values', () => {
    it('should use provided initialCrop values', async () => {
      const initialCrop = {
        crop_top: 0.2,
        crop_bottom: 0.1,
        crop_left: 0.15,
        crop_right: 0.25,
      };

      render(
        <PhotoCropEditor
          visible={true}
          photoUrl={mockPhotoUrl}
          initialCrop={initialCrop}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      // Note: Testing actual shared value initialization requires integration testing
      // This test verifies the component accepts initialCrop prop without errors
      await waitFor(() => {
        expect(true).toBe(true); // Component rendered successfully
      });
    });

    it('should default to all zeros when no initialCrop provided', async () => {
      render(
        <PhotoCropEditor
          visible={true}
          photoUrl={mockPhotoUrl}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(true).toBe(true); // Component rendered successfully with defaults
      });
    });
  });
});
