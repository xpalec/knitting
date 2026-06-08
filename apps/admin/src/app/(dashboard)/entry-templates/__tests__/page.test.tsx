import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EntryTemplate } from '@/lib/api/entry-templates';

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
const mockUseMutation = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Import the component under test AFTER mocks are set up
// ---------------------------------------------------------------------------
import EntryTemplatesPage from '../page';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockTemplates: EntryTemplate[] = [
  {
    id: 'et-1',
    name: 'Basic Stitch Template',
    description: 'A basic template',
    blocks: [{ type: 'rich_text', order: 1, required: true }],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'et-2',
    name: 'Technique Deep Dive',
    blocks: [],
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EntryTemplatesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  it('shows skeleton placeholders during loading (Req 6.8)', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });

    render(<EntryTemplatesPage />);

    // During loading, skeleton rows are rendered in the table body
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders template rows when loaded (Req 6.1)', () => {
    mockUseQuery.mockReturnValue({
      data: mockTemplates,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<EntryTemplatesPage />);

    expect(screen.getByText('Basic Stitch Template')).toBeInTheDocument();
    expect(screen.getByText('Technique Deep Dive')).toBeInTheDocument();
  });

  it('shows empty state with "No templates found" when list is empty (Req 6.9)', () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<EntryTemplatesPage />);

    expect(screen.getByText('No templates found')).toBeInTheDocument();
  });

  it('displays "+ Add Template" button in the page header (Req 6.11)', () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<EntryTemplatesPage />);

    // The "+ Add Template" link/button should be present
    const addLinks = screen.getAllByText('+ Add Template');
    expect(addLinks.length).toBeGreaterThanOrEqual(1);
  });
});
