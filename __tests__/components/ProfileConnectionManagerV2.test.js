import React from 'react';
import { Alert, Linking } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    View,
    FadeInDown: {
      delay: () => ({
        springify: () => ({
          damping: () => ({}),
        }),
      }),
    },
    Layout: {
      springify: () => ({}),
    },
  };
});
jest.mock('../../src/services/supabase', () => {
  const supabase = {
    from: jest.fn(),
  };

  return {
    __esModule: true,
    supabase,
    default: supabase,
    handleSupabaseError: jest.fn(),
  };
});

const mockPhoneAuthService = {
  approveProfileLink: jest.fn(),
  rejectProfileLink: jest.fn(),
};

jest.mock('../../src/services/phoneAuth', () => ({
  __esModule: true,
  phoneAuthService: mockPhoneAuthService,
  default: mockPhoneAuthService,
}));

jest.mock('../../src/services/subscriptionManager', () => ({
  subscribe: jest.fn(() => Promise.resolve({ unsubscribe: jest.fn() })),
}));

jest.mock('../../src/services/notifications', () => ({
  scheduleLocalNotification: jest.fn(),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'Light',
    Medium: 'Medium',
    Heavy: 'Heavy',
  },
  NotificationFeedbackType: {
    Success: 'Success',
    Warning: 'Warning',
    Error: 'Error',
  },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@expo/ui/swift-ui', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Host: ({ children }) => <View>{children}</View>,
    Picker: () => null,
  };
});

const subscriptionManager = require('../../src/services/subscriptionManager');
const notificationService = require('../../src/services/notifications');
const { supabase } = require('../../src/services/supabase');
const ProfileConnectionManagerV2 = require('../../src/components/admin/ProfileConnectionManagerV2').default;

const profile = {
  id: 'profile-1',
  name: 'أحمد',
  father_id: null,
  generation: 2,
  photo_url: null,
  gender: 'male',
  hid: '1',
};

const pendingRequest = {
  id: 'request-1',
  status: 'pending',
  profile_id: profile.id,
  profiles: profile,
  phone: '+966 50 123 4567',
  name_chain: 'أحمد القفاري',
  created_at: '2024-01-01T00:00:00Z',
};

let requestsResponse = [pendingRequest];
let profilesQueue = [[profile], []];

const configureSupabase = ({ requests = [pendingRequest], profiles = [profile], ancestors = [] } = {}) => {
  requestsResponse = requests;
  profilesQueue = [profiles, ancestors];
};

beforeEach(() => {
  jest.clearAllMocks();
  configureSupabase();

  Alert.alert = jest.fn((title, message, buttons) => {
    const confirmButton = buttons?.find((btn) => btn?.text === 'موافقة');
    if (confirmButton?.onPress) {
      confirmButton.onPress();
    }
  });

  Alert.prompt = Alert.prompt || jest.fn();

  Linking.openURL = jest.fn(() => Promise.resolve());

  supabase.from.mockImplementation((table) => {
    if (table === 'profile_link_requests') {
      return {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: requestsResponse, error: null }),
      };
    }

    if (table === 'profiles') {
      const select = jest.fn().mockReturnThis();
      const inMock = jest.fn().mockImplementation(() => {
        const data = profilesQueue.length ? profilesQueue.shift() : [];
        return Promise.resolve({ data, error: null });
      });

      return {
        select,
        in: inMock,
      };
    }

    return {
      select: jest.fn().mockReturnThis(),
    };
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ProfileConnectionManagerV2', () => {
  it('moves request to approved on successful approval', async () => {
    mockPhoneAuthService.approveProfileLink.mockResolvedValue({ success: true });

    const { getByText, queryByText } = render(<ProfileConnectionManagerV2 />);

    await waitFor(() => expect(getByText('قبول')).toBeTruthy());

    fireEvent.press(getByText('قبول'));

    await waitFor(() => expect(mockPhoneAuthService.approveProfileLink).toHaveBeenCalledWith(pendingRequest.id));

    await waitFor(() => expect(queryByText('قبول')).toBeNull());
    expect(notificationService.scheduleLocalNotification).toHaveBeenCalledWith(
      'تمت الموافقة ✅',
      expect.any(String),
      expect.objectContaining({ type: 'approval_success' })
    );
  });

  it('retries approval and restores request after repeated failures', async () => {
    jest.useFakeTimers();

    mockPhoneAuthService.approveProfileLink.mockImplementation(() =>
      Promise.resolve({ success: false, error: 'server error' })
    );

    const { getByText } = render(<ProfileConnectionManagerV2 />);

    await waitFor(() => expect(getByText('قبول')).toBeTruthy());

    fireEvent.press(getByText('قبول'));

    await waitFor(() => expect(mockPhoneAuthService.approveProfileLink).toHaveBeenCalledTimes(1));

    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    await waitFor(() => expect(mockPhoneAuthService.approveProfileLink).toHaveBeenCalledTimes(2));

    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });

    await waitFor(() => expect(mockPhoneAuthService.approveProfileLink).toHaveBeenCalledTimes(3));

    expect(Alert.alert).toHaveBeenCalledWith(
      'خطأ',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'إلغاء' }),
        expect.objectContaining({ text: 'إعادة المحاولة' }),
      ])
    );

    expect(getByText('قبول')).toBeTruthy();
  });

  it('sanitises phone numbers before opening WhatsApp', async () => {
    mockPhoneAuthService.approveProfileLink.mockResolvedValue({ success: true });

    const { getByLabelText, getByText } = render(<ProfileConnectionManagerV2 />);

    await waitFor(() => expect(getByText('قبول')).toBeTruthy());

    const whatsappButton = getByLabelText('مراسلة عبر واتساب');
    fireEvent.press(whatsappButton);

    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('whatsapp://send?phone=+966501234567')
    );
  });
});
