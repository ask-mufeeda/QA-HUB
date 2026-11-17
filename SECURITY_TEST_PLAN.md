# QA Hub Security Test Plan

This document covers the positive and negative tests for the database-level authorization and role checks described in the security migration set.

## Scope

- profiles
- bugs
- test_cases
- automation_* tables
- learning_progress and sql_practice_progress
- storage bucket bug-attachments

## Positive tests

### 1. Unauthenticated user
- Attempt to read `public.bugs`.
- Attempt to fetch `public.profiles`.
- Attempt to read `public.test_cases`.
- Attempt to read automation or learning progress tables.
- Expected result: all requests are denied.

### 2. Authenticated normal user
- Read their own profile.
- Update their own profile without changing `role`.
- Create a new bug report.
- Read only bugs they own or are assigned to.
- Create a test case and verify `created_by` matches `auth.uid()`.
- View their own automation runs/projects.
- View their own learning progress.
- Expected result: allowed.

### 3. Admin user
- Read all profiles.
- Update a user profile when needed by admin policy.
- Read all bugs, automation data, and learning progress.
- Manage attachment bucket access when needed.
- Expected result: allowed.

## Negative tests

### 4. Cross-user bug access
- User A attempts to read, update, or delete User B’s bug.
- Expected result: denied.

### 5. Cross-user test case modification
- User A tries to update a test case where `created_by` belongs to User B.
- Expected result: denied.

### 6. Role escalation
- A normal user attempts to change their own `profiles.role` to `admin`.
- Expected result: denied.

### 7. Automation cross-user access
- User A tries to access User B’s automation projects, scripts, suites, runs, or results.
- Expected result: denied.

### 8. Learning progress isolation
- User A reads or edits User B’s `learning_progress` or `sql_practice_progress` row.
- Expected result: denied.

### 9. Storage privacy
- User A attempts to read another user’s attachment in the `bug-attachments` bucket.
- Expected result: denied.

### 10. Fake ownership injection
- User A sends a crafted payload with a different `created_by` or `owner_id` than `auth.uid()`.
- Expected result: rejected by RLS `WITH CHECK` policy.

## Staging validation checklist

- Confirm `public.get_current_user_role()` returns the correct role for admin and standard users.
- Confirm the helper has a fixed `search_path` and is `SECURITY DEFINER`.
- Confirm no user can change their `role` to `admin` via the profiles table.
- Confirm users only access their own records or admin-only records.
- Confirm admin-only routes still work with a real admin account.
- Confirm bug reporting remains available to authenticated users.
- Confirm attachments stay private to the owner or admin.

## Pass/fail criteria

Consider the migration successful only when all positive checks pass and all negative checks fail with authorization denials, not data exposure.
