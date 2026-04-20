import { useAuth } from '@/hooks/useAuth';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

/**
 * Permission types for granular access control.
 * These map to specific capabilities within the workforce management system.
 */
export type Permission =
  | 'manage_schedule'
  | 'view_schedule'
  | 'approve_timesheet'
  | 'view_dept_reports'
  | 'manage_statutory'
  | 'send_announcements'
  | 'manage_leave'
  | 'manage_shifts'
  | 'swap_shifts'
  | 'request_time_off'
  | 'view_messaging'
  | 'manage_calendar';

/**
 * Role-to-permission mapping.
 * Admin and HR get full management permissions.
 * Employees get self-service permissions only.
 */
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    'manage_schedule', 'view_schedule', 'approve_timesheet', 'view_dept_reports',
    'manage_statutory', 'send_announcements', 'manage_leave', 'manage_shifts',
    'swap_shifts', 'request_time_off', 'view_messaging', 'manage_calendar',
  ],
  hr_manager: [
    'manage_schedule', 'view_schedule', 'approve_timesheet', 'view_dept_reports',
    'manage_statutory', 'send_announcements', 'manage_leave', 'manage_shifts',
    'swap_shifts', 'request_time_off', 'view_messaging', 'manage_calendar',
  ],
  employee: [
    'view_schedule', 'swap_shifts', 'request_time_off', 'view_messaging',
  ],
};

/**
 * Maps permissions to their required feature flag.
 * If the flag is disabled, the permission is denied regardless of role.
 */
const PERMISSION_FLAGS: Partial<Record<Permission, string>> = {
  manage_schedule: 'enabled_workforce_mgmt',
  view_schedule: 'enabled_workforce_mgmt',
  approve_timesheet: 'enabled_workforce_mgmt',
  manage_shifts: 'enabled_workforce_mgmt',
  swap_shifts: 'enabled_workforce_mgmt',
  manage_leave: 'enabled_workforce_mgmt',
  request_time_off: 'enabled_workforce_mgmt',
  manage_statutory: 'enabled_ja_compliance',
  send_announcements: 'enabled_messaging',
  view_messaging: 'enabled_messaging',
  view_dept_reports: 'enabled_reporting',
  manage_calendar: 'enabled_workforce_mgmt',
};

/**
 * Hook for checking granular permissions with feature-flag gating.
 *
 * Usage:
 *   const { can } = usePermissionGuard();
 *   if (can('manage_schedule')) { ... }
 */
export function usePermissionGuard() {
  const { roles, profile } = useAuth();
  const wfmEnabled = useFeatureFlag('enabled_workforce_mgmt');
  const jaEnabled = useFeatureFlag('enabled_ja_compliance');
  const msgEnabled = useFeatureFlag('enabled_messaging');
  const rptEnabled = useFeatureFlag('enabled_reporting');

  const flagLookup: Record<string, boolean> = {
    'enabled_workforce_mgmt': wfmEnabled,
    'enabled_ja_compliance': jaEnabled,
    'enabled_messaging': msgEnabled,
    'enabled_reporting': rptEnabled,
  };

  const can = (permission: Permission): boolean => {
    // Check feature flag gate
    const requiredFlag = PERMISSION_FLAGS[permission];
    if (requiredFlag && !flagLookup[requiredFlag]) return false;

    // Check role permission
    return roles.some(r => ROLE_PERMISSIONS[r]?.includes(permission));
  };

  return {
    can,
    departmentId: profile?.department_id,
    isAdmin: roles.includes('admin'),
    isHR: roles.includes('hr_manager'),
    isEmployee: roles.includes('employee'),
  };
}
