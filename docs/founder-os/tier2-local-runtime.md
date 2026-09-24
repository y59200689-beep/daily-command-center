# Tier 2 local verification runtime

The user authorized installation of a local test runtime. Homebrew installed Colima 0.10.3, Lima 2.2.0 and Docker CLI 29.8.1. The isolated Colima profile is `tier2` (2 CPUs, 4 GiB RAM, 30 GiB disk). It does not replace the default Docker context or modify SSH configuration.

Use this profile explicitly:

```sh
export DOCKER_HOST="unix://$HOME/.colima/tier2/docker.sock"
export DOCKER_CONFIG=/private/tmp/tier2-docker-config
supabase start --exclude realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
```

The separate Docker config is an empty, private config directory; the existing default config references an unavailable Docker Desktop credential helper. No registry credentials are copied. `supabase/config.toml` disables demo seeding. Start applies the checked-in migrations to the **local** stack; it does not push migrations to the linked remote project.

For browser verification, build with the local public Supabase URL/key before running the existing E2E launcher with `E2E_TARGET=local` and `E2E_SERVER_MODE=production`. Obtain connection values from local `supabase status` in the runner process; never copy a privileged key into client environment variables or logs. The launcher creates normal temporary Auth users, records synthetic resources, and runs mandatory cleanup.

The runtime tools are installed. Supabase startup failed during image download because the host disk filled (147 MiB remaining). The task-created empty `tier2` VM and its incomplete container data were removed, recovering space to approximately 5.8 GiB. No local database or synthetic Auth user had been created. Recreate the profile only after sufficient disk space is available, or place the runtime on a user-approved external volume. Authenticated Phase 2A verification remains pending; this is an environment blocker, not evidence of a broken product workflow. This is not a completion report.

## Resume after disk recovery

The user reported 33 GiB free and authorized resuming. Host inspection showed 31 GiB free. The existing `tier2` runtime was healthy when accessed outside sandbox socket restrictions. Startup now monitors host space every five seconds and stops below an 8 GiB reserve. The complete checked-in migration sequence, including `20260924010000_tier2_business_kpis.sql`, applied to local PostgreSQL successfully. Service health and browser verification are in progress. No linked/remote migration command was used.

Local stack startup completed successfully with 23.2 GiB free. `supabase_db_ysf`, Auth, Storage and Kong passed health checks; REST returned HTTP 200. A read-only `supabase db query --local` confirmed Tier 2A version `20260924010000` and zero initial Auth users. The local-target production build is running.
