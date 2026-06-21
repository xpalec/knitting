/**
 * Unit tests for RelationshipsPanel component.
 *
 * Requirements: 1.3, 1.4, 2.7, 2.9, 5.1, 5.2, 5.4, 7.3, 7.7
 *
 * File: apps/admin/src/components/entries/__tests__/relationships-panel.test.tsx
 */

// ---------------------------------------------------------------------------
// Module-level mocks (must come before component imports)
// ---------------------------------------------------------------------------

// Mock useRelationships to control the list state imperatively
const mockRetry = vi.fn();
const mockNotifyMutated = vi.fn();

vi.mock('../use-relationships', () => ({
  useRelationships: vi.fn(() => ({
    relationships: [],
    isLoading: false,
    isError: false,
    retry: mockRetry,
    notifyMutated: mockNotifyMutated,
  })),
}));

// Mock entryRelationshipsApi so no real HTTP calls happen
vi.mock('@/lib/api/entry-relationships', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/entry-relationships')>();
  return {
    ...actual,
    entryRelationshipsApi: {
      listRelationships: vi.fn(),
      createRelationship: vi.fn(),
      deleteRelationship: vi.fn(),
    },
  };
});

// Mock entriesApi
vi.mock('@/lib/api/entries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/entries')>();
  return {
    ...actual,
    entriesApi: {
      listEntries: vi.fn().mockResolvedValue({ data: [] }),
    },
  };
});

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock useMutation so we can control mutation callbacks
const mockMutate = vi.fn();
const mockUseMutation = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  QueryClient: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { useRelationships } from '../use-relationships';
import { EntryRelationshipType, type EntryRelationship } from '@/lib/api/entry-relationships';
import RelationshipsPanel from '../relationships-panel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENTRY_ID = 'entry-uuid-1234';
const ACTIVE_LOCALE = 'en';

function buildRelationship(overrides: Partial<EntryRelationship> = {}): EntryRelationship {
  return {
    id: 'rel-1',
    sourceEntryId: ENTRY_ID,
    targetEntryId: 'target-uuid-5678',
    type: EntryRelationshipType.RELATED_TO,
    createdAt: new Date(),
    targetEntry: {
      id: 'target-uuid-5678',
      translations: [{ locale: 'en', term: 'Target Entry', slug: 'target-entry', status: 'draft' as const }],
    },
    ...overrides,
  };
}

function renderPanel(props: Partial<React.ComponentProps<typeof RelationshipsPanel>> = {}) {
  return render(
    <RelationshipsPanel
      entryId={ENTRY_ID}
      activeLocale={ACTIVE_LOCALE}
      {...props}
    />,
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Default useMutation: no-op, non-pending
  mockUseMutation.mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  });

  // Default useRelationships: empty list, no loading/error
  (useRelationships as ReturnType<typeof vi.fn>).mockReturnValue({
    relationships: [],
    isLoading: false,
    isError: false,
    retry: mockRetry,
    notifyMutated: mockNotifyMutated,
  });
});

// ---------------------------------------------------------------------------
// Test 1: No entryId → placeholder message, add controls absent
// Requirements: 1.3, 1.4
// ---------------------------------------------------------------------------

describe('RelationshipsPanel — no entryId', () => {
  it('shows placeholder message when entryId is undefined', () => {
    render(
      <RelationshipsPanel entryId={undefined} activeLocale={ACTIVE_LOCALE} />,
    );

    expect(
      screen.getByText('Relationships can be added after the entry is first saved.'),
    ).toBeInTheDocument();
  });

  it('does not render add controls section when entryId is undefined', () => {
    render(
      <RelationshipsPanel entryId={undefined} activeLocale={ACTIVE_LOCALE} />,
    );

    expect(screen.queryByTestId('add-controls-section')).not.toBeInTheDocument();
  });

  it('does not render relationships list section when entryId is undefined', () => {
    render(
      <RelationshipsPanel entryId={undefined} activeLocale={ACTIVE_LOCALE} />,
    );

    expect(screen.queryByTestId('relationships-list-section')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 2: With entryId → add controls and list section present
// Requirements: 1.3, 1.4
// ---------------------------------------------------------------------------

describe('RelationshipsPanel — with entryId', () => {
  it('renders add controls section when entryId is provided', () => {
    renderPanel();

    expect(screen.getByTestId('add-controls-section')).toBeInTheDocument();
  });

  it('renders relationships list section when entryId is provided', () => {
    renderPanel();

    expect(screen.getByTestId('relationships-list-section')).toBeInTheDocument();
  });

  it('does not show the unsaved placeholder when entryId is provided', () => {
    renderPanel();

    expect(
      screen.queryByText('Relationships can be added after the entry is first saved.'),
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 3: Loading state → skeleton rendered
// Requirements: 7.3
// ---------------------------------------------------------------------------

describe('RelationshipsPanel — loading state', () => {
  it('renders skeleton when isLoading is true', () => {
    (useRelationships as ReturnType<typeof vi.fn>).mockReturnValue({
      relationships: [],
      isLoading: true,
      isError: false,
      retry: mockRetry,
      notifyMutated: mockNotifyMutated,
    });

    renderPanel();

    expect(screen.getByTestId('relationships-skeleton')).toBeInTheDocument();
  });

  it('does not render error state or empty state when loading', () => {
    (useRelationships as ReturnType<typeof vi.fn>).mockReturnValue({
      relationships: [],
      isLoading: true,
      isError: false,
      retry: mockRetry,
      notifyMutated: mockNotifyMutated,
    });

    renderPanel();

    expect(screen.queryByTestId('relationships-error-state')).not.toBeInTheDocument();
    expect(screen.queryByTestId('relationships-empty-state')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 4: Error state → error message and retry button
// Requirements: 7.7
// ---------------------------------------------------------------------------

describe('RelationshipsPanel — error state', () => {
  it('renders error state when isError is true', () => {
    (useRelationships as ReturnType<typeof vi.fn>).mockReturnValue({
      relationships: [],
      isLoading: false,
      isError: true,
      retry: mockRetry,
      notifyMutated: mockNotifyMutated,
    });

    renderPanel();

    expect(screen.getByTestId('relationships-error-state')).toBeInTheDocument();
  });

  it('renders retry button when in error state', () => {
    (useRelationships as ReturnType<typeof vi.fn>).mockReturnValue({
      relationships: [],
      isLoading: false,
      isError: true,
      retry: mockRetry,
      notifyMutated: mockNotifyMutated,
    });

    renderPanel();

    expect(screen.getByTestId('relationships-retry-button')).toBeInTheDocument();
  });

  it('calls retry when retry button is clicked', () => {
    (useRelationships as ReturnType<typeof vi.fn>).mockReturnValue({
      relationships: [],
      isLoading: false,
      isError: true,
      retry: mockRetry,
      notifyMutated: mockNotifyMutated,
    });

    renderPanel();

    fireEvent.click(screen.getByTestId('relationships-retry-button'));

    expect(mockRetry).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Test 5: Confirmation dialog shown on remove click; no API call before confirm
// Requirements: 5.1, 5.2
// ---------------------------------------------------------------------------

describe('RelationshipsPanel — confirmation dialog on remove', () => {
  it('shows confirmation dialog when remove button is clicked', () => {
    const relationship = buildRelationship();

    (useRelationships as ReturnType<typeof vi.fn>).mockReturnValue({
      relationships: [relationship],
      isLoading: false,
      isError: false,
      retry: mockRetry,
      notifyMutated: mockNotifyMutated,
    });

    renderPanel();

    // Click the remove button on the card
    const removeButton = screen.getByTestId('relationship-card-remove-button');
    fireEvent.click(removeButton);

    // Confirmation dialog title should appear
    expect(screen.getByText('Remove relationship')).toBeInTheDocument();
  });

  it('does not call the delete API before confirming', () => {
    const relationship = buildRelationship();

    (useRelationships as ReturnType<typeof vi.fn>).mockReturnValue({
      relationships: [relationship],
      isLoading: false,
      isError: false,
      retry: mockRetry,
      notifyMutated: mockNotifyMutated,
    });

    renderPanel();

    // Click remove to open dialog
    fireEvent.click(screen.getByTestId('relationship-card-remove-button'));

    // mockMutate is the delete mutation — should NOT have been called yet
    expect(mockMutate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 6: Cancelling confirmation leaves card intact
// Requirements: 5.2
// ---------------------------------------------------------------------------

describe('RelationshipsPanel — cancelling confirmation dialog', () => {
  it('keeps the relationship card when Cancel is clicked in the dialog', () => {
    const relationship = buildRelationship();

    (useRelationships as ReturnType<typeof vi.fn>).mockReturnValue({
      relationships: [relationship],
      isLoading: false,
      isError: false,
      retry: mockRetry,
      notifyMutated: mockNotifyMutated,
    });

    renderPanel();

    // Open the dialog
    fireEvent.click(screen.getByTestId('relationship-card-remove-button'));
    expect(screen.getByText('Remove relationship')).toBeInTheDocument();

    // Click Cancel in the dialog
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    // Card should still be visible (no API call triggered)
    expect(screen.getByTestId(`relationship-card-${relationship.id}`)).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('closes the dialog when Cancel is clicked', () => {
    const relationship = buildRelationship();

    (useRelationships as ReturnType<typeof vi.fn>).mockReturnValue({
      relationships: [relationship],
      isLoading: false,
      isError: false,
      retry: mockRetry,
      notifyMutated: mockNotifyMutated,
    });

    renderPanel();

    // Open the dialog
    fireEvent.click(screen.getByTestId('relationship-card-remove-button'));
    expect(screen.getByText('Remove relationship')).toBeInTheDocument();

    // Cancel
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    // Dialog title should no longer be in the DOM
    expect(screen.queryByText('Remove relationship')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 7: toast.error called on create failure
// Requirements: 2.7, 2.9
// ---------------------------------------------------------------------------

describe('RelationshipsPanel — create mutation failure', () => {
  it('calls toast.error when the create mutation errors', () => {
    // Capture the onError callback passed to the second useMutation call (create)
    let createOnError: ((err: Error) => void) | undefined;

    mockUseMutation.mockImplementation((options: { onError?: (err: Error) => void; onSuccess?: () => void }) => {
      // The second call is the create mutation (it sets isPending via isCreating)
      // We capture the onError for every call; the create mutation's onError is what we want
      if (options?.onError) {
        createOnError = options.onError;
      }
      return { mutate: mockMutate, isPending: false };
    });

    renderPanel();

    // Trigger the onError callback to simulate a failed create
    expect(createOnError).toBeDefined();
    createOnError!(new Error('Network error'));

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Failed to add relationship'));
  });
});

// ---------------------------------------------------------------------------
// Test 8: toast.error called on delete failure
// Requirements: 5.4
// ---------------------------------------------------------------------------

describe('RelationshipsPanel — delete mutation failure', () => {
  it('calls toast.error when the delete mutation errors', () => {
    // Capture onError from all useMutation calls
    const capturedOnErrors: ((err: Error) => void)[] = [];

    mockUseMutation.mockImplementation((options: { onError?: (err: Error) => void; onSuccess?: () => void }) => {
      if (options?.onError) {
        capturedOnErrors.push(options.onError);
      }
      return { mutate: mockMutate, isPending: false };
    });

    renderPanel();

    // There are two useMutation calls: delete first, then create (in component source order)
    // The first captured onError belongs to the delete mutation
    expect(capturedOnErrors.length).toBeGreaterThanOrEqual(1);
    capturedOnErrors[0]!(new Error('Server error'));

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Failed to remove relationship'));
  });
});
