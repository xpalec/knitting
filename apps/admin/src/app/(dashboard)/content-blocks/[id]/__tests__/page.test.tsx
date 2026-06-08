import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ContentBlockType } from '@/lib/api/content-block-types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useParams: () => ({ id: 'bt-1' }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: (selector: (state: { currentUser: { id: string; email: string; role: string } | null }) => unknown) =>
    selector({ currentUser: { id: '1', email: 'admin@test.com', role: 'admin' } }),
}));

// Mock RichTextEditor to avoid TipTap JSDOM issues
vi.mock('@/components/ui/rich-text-editor', () => ({
  RichTextEditor: () => <div data-testid="rich-text-editor" />,
}));

const mockInvalidateQueries = vi.fn();
const mockMutate = vi.fn();
// Track each useMutation call's onSuccess separately (update=0, delete=1)
const onSuccessCallbacks: Array<(() => void) | undefined> = [];
let mutationCallIndex = 0;

const mockUseQuery = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  useMutation: (opts: { onSuccess?: () => void; onError?: () => void }) => {
    onSuccessCallbacks[mutationCallIndex] = opts.onSuccess;
    mutationCallIndex++;
    return { mutate: mockMutate, isPending: false };
  },
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

import ContentBlockDetailPage from '../page';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockBlockType: ContentBlockType = {
  id: 'bt-1',
  type: 'rich_text',
  label: 'Rich Text',
  description: 'A rich text block',
  translations: {
    en: { heading: 'Text Content' },
    pl: { heading: '' },
  },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ContentBlockDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSuccessCallbacks.length = 0;
    mutationCallIndex = 0;
    mockUseQuery.mockReturnValue({ data: mockBlockType, isLoading: false, isError: false, error: null });
  });

  async function renderPage() {
    await act(async () => {
      render(
        <Suspense fallback={<div>Loading...</div>}>
          <ContentBlockDetailPage params={Promise.resolve({ id: 'bt-1' })} />
        </Suspense>
      );
    });
  }

  it('renders locale tabs (English, Polish, French, German) for the block type (Req 4.1)', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('English')).toBeInTheDocument();
    });
    expect(screen.getByText('Polish')).toBeInTheDocument();
    expect(screen.getByText('French')).toBeInTheDocument();
    expect(screen.getByText('German')).toBeInTheDocument();
  });

  it('displays the block type label in the page title (Req 4.1)', async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('Rich Text')).toBeInTheDocument();
    });
  });

  it('pre-populates the label input with the block type label (Req 4.2)', async () => {
    await renderPage();
    await waitFor(() => {
      const labelInput = document.querySelector('#block-label') as HTMLInputElement;
      expect(labelInput).not.toBeNull();
      expect(labelInput.value).toBe('Rich Text');
    });
  });

  it('pre-populates EN heading input from translations (Req 4.2)', async () => {
    await renderPage();
    await waitFor(() => {
      const enInput = document.querySelector('#heading-en') as HTMLInputElement;
      expect(enInput).not.toBeNull();
      expect(enInput.value).toBe('Text Content');
    });
  });

  it('Save button triggers the update mutation (Req 4.3)', async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(mockMutate).toHaveBeenCalled();
  });

  it('successful save shows "Block type saved" toast and invalidates cache (Req 4.3)', async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(mockMutate).toHaveBeenCalled();

    // onSuccessCallbacks[0] = update mutation's onSuccess; [1] = delete mutation's onSuccess
    act(() => { onSuccessCallbacks[0]?.(); });

    expect(mockToastSuccess).toHaveBeenCalledWith('Block type saved');
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });
});
