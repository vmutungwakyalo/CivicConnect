## Architecture rules

- Data access uses the browser Supabase client with RLS; staff checks use `has_role`/`is_staff` SQL functions — keeps permissions enforced in the database.
- Roles live in `user_roles`; the first account to sign up becomes admin via the signup trigger — bootstraps an officer without a separate admin tool.
