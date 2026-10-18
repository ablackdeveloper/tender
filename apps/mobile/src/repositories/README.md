# Repository boundary

Repositories are the only mobile modules allowed to issue Supabase data requests. They accept validated inputs, return domain-oriented results, and never expose service-role credentials. Authorization remains enforced by database RLS.
