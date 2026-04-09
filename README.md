# Laurel Woods Rental App

Standalone admin web app for Laurel Woods property management.

## Features

- Admin login
- Tenant and unit tracking
- Manual rent payment entry
- Ledger-based balances
- Lease contract uploads
- Printable monthly statements
- Printable rent notices
- Warning letters for 3 consecutive unpaid months

## Local development

```bash
npm install
npm run dev
```

Default admin password:

```bash
laurelwoods
```

To override it, set:

```bash
LAUREL_WOODS_ADMIN_PASSWORD=your-secure-password
```

## Deployment

Deploy on Vercel and set the Root Directory to the repository root if this app is pushed directly from this folder.

### Required Vercel environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-server-secret-key
LAUREL_WOODS_ADMIN_PASSWORD=your-secure-password
```

### Supabase setup

1. Open the SQL editor in Supabase.
2. Run [`supabase/schema.sql`](./supabase/schema.sql).
3. Confirm the `lease-documents` storage bucket exists.

Once those are in place, the app will store:

- tenants in Supabase tables
- payments in Supabase tables
- rent charges in Supabase tables
- lease contracts in Supabase Storage

If Supabase is not fully configured yet, the app falls back to starter data so the UI still loads.
