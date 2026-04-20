/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LeaveManagement from '../pages/LeaveManagement';
import * as useAuthHook from '../hooks/useAuth';

vi.mock('../hooks/useFeatureFlag', () => ({
  useFeatureFlag: vi.fn(() => true),
}));

// Mock the Supabase client
const mockQueryBuilder: Record<string, unknown> = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: { enabled: true }, error: null }),
  then: vi.fn((callback: (v: unknown) => unknown) => Promise.resolve({ data: [{ enabled: true }], error: null }).then(callback)),
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => mockQueryBuilder),
  },
}));

// Mock ResizeObserver
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

const queryClient = new QueryClient();

describe('LeaveManagement Component', () => {
  it('should render the Leave Management page without crashing', async () => {
    vi.spyOn(useAuthHook, 'useAuth').mockReturnValue({
      user: { id: 'test-user-id' } as any,
      session: null,
      profile: { id: 'test-profile-id', role_tier: 'admin_staff' } as any,
      roles: ['admin'],
      loading: false,
      isAdmin: true,
      isHR: false,
      isEmployee: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LeaveManagement />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify main header or common element
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
