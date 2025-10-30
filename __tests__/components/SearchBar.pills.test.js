import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

import SearchBar from "../../src/components/SearchBar";

jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: { Light: "light" },
  impactAsync: jest.fn(),
}));

const mockStoreState = {
  profileSheetProgress: { value: 0 },
  selectedPersonId: null,
};

jest.mock("../../src/stores/useTreeStore", () => ({
  useTreeStore: jest.fn((selector) => selector(mockStoreState)),
}));

jest.mock("../../src/contexts/AdminModeContext", () => ({
  useAdminMode: () => ({ isAdminMode: false }),
}));

jest.mock("../../src/hooks/useNetworkGuard", () => ({
  useNetworkGuard: () => ({ isOffline: false }),
}));

const nodesFixture = [
  {
    id: 1,
    name: "سليمان ابو القفارات",
    generation: 1,
  },
  {
    id: 2,
    name: "عبدالله بن سليمان",
    generation: 2,
    father_id: 1,
    _hasChildren: true,
    sibling_order: 1,
  },
  {
    id: 3,
    name: "محمد بن سليمان",
    generation: 2,
    father_id: 1,
    _hasChildren: true,
    sibling_order: 2,
  },
];

describe("SearchBar navigation pills", () => {
  beforeEach(() => {
    mockStoreState.profileSheetProgress.value = 0;
    mockStoreState.selectedPersonId = null;
  });

  it("highlights the root pill by default", async () => {
    const { getByLabelText } = render(
      <SearchBar nodes={nodesFixture} onNavigate={jest.fn()} />,
    );

    const rootPill = getByLabelText("الانتقال إلى سليمان ابو القفارات");

    await waitFor(() => {
      expect(rootPill.props.accessibilityState).toMatchObject({ selected: true });
    });
  });

  it("activates branch pill when pressed and calls onNavigate", async () => {
    const handleNavigate = jest.fn();
    const { getByLabelText } = render(
      <SearchBar nodes={nodesFixture} onNavigate={handleNavigate} />,
    );

    const branchPill = getByLabelText("الانتقال إلى فرع عبدالله بن سليمان");
    fireEvent.press(branchPill);

    await waitFor(() => {
      expect(branchPill.props.accessibilityState).toMatchObject({ selected: true });
    });

    expect(handleNavigate).toHaveBeenCalledWith(2);

    const rootPill = getByLabelText("الانتقال إلى سليمان ابو القفارات");
    expect(rootPill.props.accessibilityState).toMatchObject({ selected: false });
  });
});
