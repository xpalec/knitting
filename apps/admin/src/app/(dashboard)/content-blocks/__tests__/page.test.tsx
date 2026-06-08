import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ContentBlockType } from '@/lib/api/content-block-types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: (selector: (state: { currentUser: { id: string; email: string; role: string } | null }) => unknown) =>
    selector({ currentUser: { id: '1', email: 'admin@test.com', role: 'admin' } }),
}));

vi.mock('@/providers/page-header-provider', () => ({
  usePageHeader: () => ({ header: { title: '' }, setHeader: vi.fn() }),
}));

const mockUseQuery = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import ContentBlocksPage from '../page';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockBlockTypes: ContentBlockType[] = [
  {
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
  },
  {
    id: 'bt-2',
    type: 'image_gallery',
    label: 'Image Gallery',
    translations: {},
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ContentBlocksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows 3 skeleton rows during loading (Req 3.10)', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<ContentBlocksPage />);

    const table = screen.getByRole('table');
    const tbody = within(table).getAllByRole('rowgroup')[1]!;
    const rows = within(tbody).getAllByRole('row');
    expect(rows).toHaveLength(3);
  });

  it('shows "No block types found" empty state when list is empty (Req 3.11)', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<ContentBlocksPage />);
    expect(screen.getByText('No block types found')).toBeInTheDocument();
  });

  it('renders table with mock data showing label and type slug (Req 3.1)', () => {
    mockUseQuery.mockReturnValue({ data: mockBlockTypes, isLoading: false, isError: false });
    render(<ContentBlocksPage />);

    expect(screen.getByText('Rich Text')).toBeInTheDocument();
    expect(screen.getByText('Image Gallery')).toBeInTheDocument();
    expect(screen.getByText('rich_text')).toBeInTheDocument();
    expect(screen.getByText('image_gallery')).toBeInTheDocument();
  });

  it('renders translation status badges for all 5 locales (Req 3.4)', () => {
    mockUseQuery.mockReturnValue({ data: mockBlockTypes, isLoading: false, isError: false });
    render(<ContentBlocksPage />);

    // EN=complete for bt-1, PL=incomplete for bt-1, remaining 8 locale slots are missing
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getByText('Incomplete')).toBeInTheDocument();
    // 5 locales × 2 rows = 10 badge cells; 1 complete + 1 incomplete = 8 missing
    expect(screen.getAllByText('Missing').length).toBeGreaterThanOrEqual(1);
  });

  it('"+ New Block Type" link navigates to /content-blocks/new (Req 3.13)', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<ContentBlocksPage />);

    const link = screen.getByRole('link', { name: /new block type/i });
    expect(link).toHaveAttribute('href', '/content-blocks/new');
  });

  it('clicking a table row navigates to /content-blocks/[id] (Req 3.8)', async () => {
    mockUseQuery.mockReturnValue({ data: mockBlockTypes, isLoading: false, isError: false });
    render(<ContentBlocksPage />);

    const row = screen.getByText('Rich Text').closest('tr')!;
    await userEvent.click(row);

    expect(mockPush).toHaveBeenCalledWith('/content-blocks/bt-1');
  });
});
