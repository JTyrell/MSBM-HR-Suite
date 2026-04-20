/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as useAuthHook from '../hooks/useAuth';

// Import all pages
import Attendance from '../pages/Attendance';
import ClockInOut from '../pages/ClockInOut';
import CRM from '../pages/CRM';
import Dashboard from '../pages/Dashboard';
import Employees from '../pages/Employees';
import Geofences from '../pages/Geofences';
import Payroll from '../pages/Payroll';
import PayStubs from '../pages/PayStubs';
import Reports from '../pages/Reports';
import Settings from '../pages/Settings';
import Messaging from '../pages/Messaging';

vi.mock('../hooks/useFeatureFlag', () => ({
  useFeatureFlag: vi.fn(() => true),
}));

// Mock the Supabase client — uses Record<string, unknown> to avoid any
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
  is: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  single: vi.fn().mockResolvedValue({ data: { enabled: true, first_name: 'Test', last_name: 'User' }, error: null }),
  then: vi.fn((callback: (v: unknown) => unknown) =>
    Promise.resolve({ data: [{ id: '1', enabled: true, user_id: 'test', status: 'active', first_name: 'Test', last_name: 'User', email: 'test@example.com', role: 'admin' }], error: null }).then(callback)),
  subscribe: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => mockQueryBuilder),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn().mockResolvedValue(true),
    })),
    removeChannel: vi.fn(),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
  },
}));

// Mock Mapbox and ResizeObserver
vi.mock('mapbox-gl', () => {
  class MockMap {
    on = vi.fn();
    remove = vi.fn();
    addControl = vi.fn();
  }
  class MockMarker {
    setLngLat = vi.fn().mockReturnThis();
    addTo = vi.fn().mockReturnThis();
    remove = vi.fn();
  }
  return {
    default: {
      Map: MockMap,
      Marker: MockMarker,
      NavigationControl: vi.fn(),
    }
  };
});

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;
window.URL.createObjectURL = vi.fn();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Pages Rendering Tests', () => {
  vi.spyOn(useAuthHook, 'useAuth').mockReturnValue({
    user: { id: 'test-user-id' } as any,
    session: null,
    profile: { id: 'test-profile-id', role_tier: 'admin_staff', first_name: 'Test', last_name: 'User' } as any,
    roles: ['admin'],
    loading: false,
    isAdmin: true,
    isHR: false,
    isEmployee: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  });

  describe('Attendance', () => {
    it('should render successfully', async () => {
      renderWithProviders(<Attendance />);
      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  describe('ClockInOut', () => {
    it('should render successfully', async () => {
      renderWithProviders(<ClockInOut />);
      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  describe('CRM', () => {
    it('should show access denied for non-admin users', async () => {
      vi.spyOn(useAuthHook, 'useAuth').mockReturnValue({
        user: { id: 'test-user-id' } as any,
        session: null,
        profile: { id: 'test-profile-id', role_tier: 'admin_staff', first_name: 'Test', last_name: 'User' } as any,
        roles: ['employee'],
        loading: false,
        isAdmin: false,
        isHR: false,
        isEmployee: true,
        signIn: vi.fn(),
        signOut: vi.fn(),
      });
      renderWithProviders(<CRM />);
      expect(await screen.findByText(/Access Denied/i)).toBeInTheDocument();
      // Restore admin mock for subsequent tests
      vi.spyOn(useAuthHook, 'useAuth').mockReturnValue({
        user: { id: 'test-user-id' } as any,
        session: null,
        profile: { id: 'test-profile-id', role_tier: 'admin_staff', first_name: 'Test', last_name: 'User' } as any,
        roles: ['admin'],
        loading: false,
        isAdmin: true,
        isHR: false,
        isEmployee: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
      });
    });
  });

  describe('Dashboard', () => {
    it('should render successfully', async () => {
      renderWithProviders(<Dashboard />);
      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  describe('Employees', () => {
    it('should render successfully', async () => {
      renderWithProviders(<Employees />);
      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  describe('Geofences', () => {
    it('should render successfully', async () => {
      renderWithProviders(<Geofences />);
      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  describe('Payroll', () => {
    it('should render successfully', async () => {
      renderWithProviders(<Payroll />);
      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  describe('PayStubs', () => {
    it('should render successfully', async () => {
      renderWithProviders(<PayStubs />);
      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  describe('Reports', () => {
    it('should render successfully', async () => {
      renderWithProviders(<Reports />);
      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  describe('Messaging', () => {
    it('should render successfully', async () => {
      renderWithProviders(<Messaging />);
      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  describe('Settings', () => {
    it('should render successfully', async () => {
      renderWithProviders(<Settings />);
      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });
});
