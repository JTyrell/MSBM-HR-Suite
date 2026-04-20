/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AppSidebar from '../components/layout/AppSidebar';
import * as useAuthHook from '../hooks/useAuth';

vi.mock('../hooks/useFeatureFlag', () => ({
  useFeatureFlag: vi.fn(() => true),
}));

describe('Components Rendering Tests', () => {
  it('should render AppSidebar for an admin user', () => {
    vi.spyOn(useAuthHook, 'useAuth').mockReturnValue({
      user: { id: 'test-user-id' } as any,
      session: null,
      profile: { id: 'test-profile-id', role_tier: 'admin_staff', first_name: 'Test', last_name: 'User', email: 'test@msbm.edu.jm' } as any,
      roles: ['admin'],
      loading: false,
      isAdmin: true,
      isHR: false,
      isEmployee: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>
    );

    // Sidebar should display the brand text and nav items
    expect(screen.getByText(/MSBM-HR/)).toBeInTheDocument();
    expect(screen.getByText(/Settings/i)).toBeInTheDocument();
  });
});
