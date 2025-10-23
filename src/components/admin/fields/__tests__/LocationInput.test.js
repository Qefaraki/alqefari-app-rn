import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import LocationInput from '../LocationInput';

jest.mock('../../../services/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

const { supabase } = require('../../../services/supabase');

const SAUDI_SUGGESTION = {
  id: 101,
  display_name: 'الرياض',
  display_name_en: 'Riyadh',
  place_type: 'city',
  region: 'saudi',
  country_name: 'السعودية',
  normalized_data: {
    city: { id: 101, ar: 'الرياض', en: 'Riyadh' },
    country: { id: 1, ar: 'السعودية', en: 'Saudi Arabia', code: 'SA' },
  },
};

const DUBAI_SUGGESTION = {
  id: 302,
  display_name: 'دبي',
  display_name_en: 'Dubai',
  place_type: 'city',
  region: 'gulf',
  country_name: 'الإمارات',
  normalized_data: {
    country: { id: 55, ar: 'الإمارات', en: 'United Arab Emirates', code: 'AE' },
  },
};

describe('LocationInput', () => {
  const onChange = jest.fn();
  const onNormalizedChange = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders label and placeholder', () => {
    render(
      <LocationInput
        label="مكان الميلاد"
        value=""
        onChange={onChange}
        onNormalizedChange={onNormalizedChange}
        placeholder="ابحث عن موقع..."
      />
    );

    expect(screen.getByText('مكان الميلاد')).toBeTruthy();
    expect(screen.getByPlaceholderText('ابحث عن موقع...')).toBeTruthy();
  });

  it('debounces search calls and ignores single whitespace', () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    render(
      <LocationInput
        label="مكان الميلاد"
        value=""
        onChange={onChange}
        onNormalizedChange={onNormalizedChange}
      />
    );

    const input = screen.getByPlaceholderText('ابحث عن موقع...');
    fireEvent.changeText(input, ' ');
    jest.advanceTimersByTime(200);
    expect(supabase.rpc).not.toHaveBeenCalled();

    fireEvent.changeText(input, 'ا');
    jest.advanceTimersByTime(200);
    expect(supabase.rpc).toHaveBeenCalledWith('search_place_autocomplete', {
      p_query: 'ا',
      p_limit: 8,
    });
  });

  it('renders suggestions and allows selecting a Saudi city', async () => {
    supabase.rpc.mockResolvedValue({ data: [SAUDI_SUGGESTION], error: null });

    render(
      <LocationInput
        label="مكان الميلاد"
        value=""
        onChange={onChange}
        onNormalizedChange={onNormalizedChange}
      />
    );

    const input = screen.getByPlaceholderText('ابحث عن موقع...');
    fireEvent.changeText(input, 'الرياض');
    jest.advanceTimersByTime(200);

    await waitFor(() => expect(screen.getByText('الرياض')).toBeTruthy());

    fireEvent.press(screen.getByText('الرياض'));

    expect(onChange).toHaveBeenLastCalledWith('الرياض');

    const normalized = onNormalizedChange.mock.calls[onNormalizedChange.mock.calls.length - 1][0];
    expect(normalized.city).toEqual(expect.objectContaining({ id: 101 }));
    expect(normalized.country).toEqual(expect.objectContaining({ code: 'SA' }));
  });

  it('coerces non-Saudi results to country selections', async () => {
    supabase.rpc.mockResolvedValue({ data: [DUBAI_SUGGESTION], error: null });

    render(
      <LocationInput
        label="مكان الإقامة"
        value=""
        onChange={onChange}
        onNormalizedChange={onNormalizedChange}
      />
    );

    const input = screen.getByPlaceholderText('ابحث عن موقع...');
    fireEvent.changeText(input, 'دبي');
    jest.advanceTimersByTime(200);

    await waitFor(() => expect(screen.getByText('الإمارات')).toBeTruthy());

    fireEvent.press(screen.getByText('الإمارات'));

    expect(onChange).toHaveBeenLastCalledWith('الإمارات');

    const normalized = onNormalizedChange.mock.calls[onNormalizedChange.mock.calls.length - 1][0];
    expect(normalized.country).toEqual(expect.objectContaining({ code: 'AE' }));
    expect(normalized.city).toBeUndefined();
  });

  it('keeps free text but stays uncommitted on blur without selection', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    render(
      <LocationInput
        label="مكان الميلاد"
        value=""
        onChange={onChange}
        onNormalizedChange={onNormalizedChange}
      />
    );

    const input = screen.getByPlaceholderText('ابحث عن موقع...');
    fireEvent.changeText(input, 'دبي');
    jest.advanceTimersByTime(200);

    const changeCallCount = onChange.mock.calls.length;
    const normalizedCallCount = onNormalizedChange.mock.calls.length;

    fireEvent(input, 'blur');

    await waitFor(() => {
      expect(onChange.mock.calls.length).toBe(changeCallCount);
      expect(onNormalizedChange.mock.calls.length).toBe(normalizedCallCount);
    });
  });
});
