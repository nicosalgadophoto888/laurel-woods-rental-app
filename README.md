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
