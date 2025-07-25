# SuperAdmin Feature Documentation

## Overview

The SuperAdmin feature introduces a hierarchical user management system with three distinct roles:

1. **Candidate** - Regular users who take assessments
2. **Administrator** - Can manage candidates and view reports  
3. **Super Administrator** - Can manage all users including administrators

## User Roles & Permissions

### Candidate
- **Role**: `candidate`
- **Permissions**: 
  - Take SJT and JDT assessments
  - View their own reports
  - Update their profile

### Administrator  
- **Role**: `admin` or `Administrator`
- **Permissions**:
  - All candidate permissions
  - View and manage candidate users
  - Delete candidate accounts
  - Configure assessment settings
  - View all assessment reports
  - Cannot delete other administrators

### Super Administrator
- **Role**: `superadmin`
- **Permissions**:
  - All administrator permissions
  - Create new administrator accounts
  - Delete administrator accounts
  - Create other super administrator accounts
  - System-wide configuration access
  - Cannot delete themselves

## Default Accounts

### Super Administrator
- **Email**: `superadmin@gmail.com`
- **Password**: `superadmin123`
- **Name**: Super Administrator
- **ID**: SUPERADMIN001
- **Role**: superadmin

### Administrator
- **Email**: `admin@gmail.com`
- **Password**: `admin123`
- **Name**: Admin User
- **ID**: ADMIN001
- **Role**: admin

## User Management Interface

### Creating Users

The user creation form now includes a **User Type** dropdown:

- **Candidate**: Creates regular assessment users (requires role/position field)
- **Administrator**: Creates admin users (role field hidden)
- **Super Administrator**: Creates superadmin users (only visible to existing superadmins)

### Deleting Users

**For Regular Administrators:**
- Can delete candidates only
- Cannot delete other administrators
- Cannot delete superadministrators

**For Super Administrators:**
- Can delete candidates
- Can delete administrators  
- Can delete other superadministrators
- Cannot delete themselves

### Visual Indicators

Users are displayed with role badges in the user list:
- 👑 **Super Admin** - Purple badge for superadministrators
- 🔑 **Admin** - Blue badge for administrators  
- Regular text for candidates

## Technical Implementation

### Authentication Context Updates

```typescript
// New helper functions
isSuperAdmin(): boolean    // Returns true if user is superadmin
isAdmin(): boolean         // Returns true if user is admin or superadmin

// Updated ProtectedRoute component
<ProtectedRoute superAdminOnly={true}>  // Restricts to superadmin only
<ProtectedRoute adminOnly={true}>       // Allows admin or superadmin
```

### Database Changes

No schema changes required - uses existing `role` field:
- `superadmin` - Super Administrator
- `admin` - Administrator  
- `candidate` - Regular user

### Route Protection

```typescript
// Superadmin only pages
<ProtectedRoute superAdminOnly={true}>
  <SuperAdminOnlyComponent />
</ProtectedRoute>

// Admin or superadmin pages  
<ProtectedRoute adminOnly={true}>
  <AdminComponent />
</ProtectedRoute>
```

## Security Considerations

1. **Self-Protection**: Users cannot delete their own accounts
2. **Hierarchy Enforcement**: Admins cannot delete higher-privileged users
3. **Role Validation**: All role checks are server-side validated
4. **Audit Trail**: User creation/deletion is logged

## Usage Guidelines

### For Super Administrators

1. **Initial Setup**: Log in with superadmin account after deployment
2. **Create Admins**: Use the user management interface to create administrator accounts
3. **Delegate Management**: Allow administrators to handle day-to-day candidate management
4. **Emergency Access**: Use superadmin access for system recovery or admin account issues

### For Administrators

1. **Candidate Management**: Focus on managing assessment candidates
2. **Report Review**: Monitor and review assessment submissions
3. **Configuration**: Adjust assessment settings as needed
4. **Escalation**: Contact superadmin for administrative user issues

## Migration Notes

- Existing users maintain their current roles
- Default superadmin account is created automatically on first run
- No data migration required for existing deployments
- Backward compatible with existing authentication flows

## Best Practices

1. **Limit Superadmins**: Keep the number of superadmin accounts minimal
2. **Regular Audits**: Periodically review user accounts and permissions
3. **Strong Passwords**: Ensure all admin accounts use strong passwords
4. **Documentation**: Keep track of who has administrative access
5. **Backup Plans**: Ensure multiple people know superadmin credentials

## Troubleshooting

### Cannot Delete Administrator
- Verify you are logged in as a superadmin
- Check that you're not trying to delete yourself
- Ensure the target user is actually an admin role

### Missing Superadmin Options
- Confirm you are logged in with superadmin role
- Check browser console for authentication errors
- Verify database role field is set to `superadmin`

### Account Lockout
- Use alternative superadmin account if available
- Check database directly to verify user roles
- Reset password through database if necessary
