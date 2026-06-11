import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

const mockCurrentUser = vi.fn();

vi.mock('@/store/auth', () => ({
  useAuthStore: (selector: (state: { currentUser: { id: string; email: string; role: string } | null }) => unknown) =>
    selector({ currentUser: mockCurrentUser() }),
}));

// Mock Tooltip components to avoid Radix UI rendering complexity in tests
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Import the component under test AFTER mocks are set up
// ---------------------------------------------------------------------------
import { Sidebar } from '../sidebar';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Sidebar navigation visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when user is admin', () => {
    beforeEach(() => {
      mockCurrentUser.mockReturnValue({ id: '1', email: 'admin@test.com', role: 'admin' });
    });

    it('Entry Templates link is visible (Req 8.1)', () => {
      render(<Sidebar />);

      const link = screen.getByRole('link', { name: /entry templates/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/entry-templates');
    });

    it('Content Blocks link is NOT present (removed feature)', () => {
      render(<Sidebar />);

      const link = screen.queryByRole('link', { name: /content blocks/i });
      expect(link).not.toBeInTheDocument();
    });
  });

  describe('when user is editor', () => {
    beforeEach(() => {
      mockCurrentUser.mockReturnValue({ id: '2', email: 'editor@test.com', role: 'editor' });
    });

    it('Entry Templates link is NOT visible (Req 8.3)', () => {
      render(<Sidebar />);

      const link = screen.queryByRole('link', { name: /entry templates/i });
      expect(link).not.toBeInTheDocument();
    });
  });
});
