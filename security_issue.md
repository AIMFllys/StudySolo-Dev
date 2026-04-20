# Critical Security Vulnerability: Widespread Use of `service_role` Bypasses Row Level Security (RLS)

## Description

A detailed code review of the `backend/app/` repository has revealed a severe security vulnerability. The FastAPI backend relies almost universally on the Supabase `service_role` client for database operations in its user-facing API endpoints.

By default, the backend injects the Supabase client via the `get_db` and `get_supabase_client` dependencies (located in `backend/app/core/database.py` and `backend/app/core/deps.py`). These dependencies are initialized using the `SUPABASE_SERVICE_ROLE_KEY`.

The Supabase `service_role` key explicitly **bypasses PostgreSQL Row Level Security (RLS) policies**. This means that any backend query executed using this client runs with full administrative privileges. While the backend attempts to enforce authorization manually in code (e.g., via the `check_workflow_access` function), any missed check, logical flaw, or direct execution of queries could lead to unauthorized data exposure, modification, or deletion of other users' data.

This issue violates the principle of least privilege and entirely defeats the purpose of defining RLS policies on the Supabase database.

### Affected Areas

Almost all API endpoints handling user requests are affected. Examples include:
- `app/api/workflow.py` (CRUD operations for workflows)
- `app/api/workflow_execute.py` (Execution of workflows)
- `app/api/workflow_social.py` (Social interactions like forking and sharing)
- `app/api/knowledge.py` (Knowledge base document management)
- `app/api/community_nodes.py` (Community node publishing and access)
- `app/api/usage.py` (Usage statistics)
- `app/api/feedback.py` (Feedback submission)

## Proposed Solution

1. **Adopt the `anon` Client for User Operations**:
   The backend should transition away from using the `service_role` key for user-facing API routes. Instead, it should use the `get_anon_supabase_client` dependency (which initializes the client using the `SUPABASE_ANON_KEY`).

2. **Pass User Authentication to Supabase**:
   When using the `anon` client, the backend must ensure that the user's JWT (`access_token`) is passed to Supabase (e.g., by setting the auth session or passing the token in the authorization header) so that the PostgreSQL database context receives the correct `auth.uid()`. This allows Supabase to automatically enforce RLS policies based on the authenticated user.

3. **Restrict `service_role` Usage**:
   The `service_role` client (`get_db`) should be strictly restricted to:
   - Admin routes (`app/api/admin_*.py`).
   - Internal background tasks (e.g., cron jobs, document chunking pipelines).
   - Specific elevated operations explicitly requiring admin rights (e.g., quota verification/enforcement, or auth registration workflows).

4. **Verify RLS Policies**:
   Ensure robust Row Level Security policies are enabled and correctly configured on all relevant tables (e.g., `ss_workflows`, `ss_workflow_runs`, `ss_kb_documents`, `user_profiles`, etc.) to prevent unauthorized access at the database level.
