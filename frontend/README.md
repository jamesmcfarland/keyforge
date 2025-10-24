# Keyforge Frontend

React-based admin dashboard for monitoring VaultWarden deployments managed by Keyforge.

## Features

- View all VaultWarden union deployments
- Monitor deployment status and events
- View detailed deployment logs with filtering
- Create new union deployments
- Real-time deployment tracking

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TanStack Query** - Server state management
- **React Router** - Client-side routing
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **Zustand** - Client state management

## Prerequisites

- Node.js 20.x or higher
- pnpm 10.13.1 or higher
- Keyforge API running (default: http://localhost:3000)

See [../PREREQUISITES.md](../PREREQUISITES.md) for installation instructions.

## Quick Start

### 1. Install Dependencies

```bash
cd frontend
pnpm install
```

### 2. Configure Environment

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` and set the API URL:

```env
VITE_API_BASE=http://localhost:3000
```

### 3. Start Development Server

```bash
pnpm run dev
```

The app will be available at **http://localhost:5173**

## Available Scripts

```bash
pnpm run dev      # Start dev server (port 5173)
pnpm run build    # Build for production (outputs to dist/)
pnpm run preview  # Preview production build locally
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE` | Keyforge API base URL | `http://localhost:3000` |

**Note:** Environment variables must be prefixed with `VITE_` to be exposed to the app.

## Project Structure

```
frontend/
├── src/
│   ├── api/
│   │   └── client.ts              # API client with axios
│   ├── components/
│   │   ├── DeploymentList.tsx     # List of all deployments
│   │   ├── Header.tsx             # App header
│   │   └── NewDeploymentModal.tsx # Create union modal
│   ├── hooks/
│   │   └── useDeployments.ts      # TanStack Query hooks
│   ├── pages/
│   │   └── DeploymentDetail.tsx   # Deployment detail view
│   ├── types/
│   │   └── index.ts               # TypeScript type definitions
│   ├── App.tsx                    # Root component with routing
│   ├── main.tsx                   # App entry point
│   └── index.css                  # Global styles (Tailwind)
├── public/
│   └── vite.svg                   # Static assets
├── .env.example                   # Environment variable template
├── index.html                     # HTML template
├── package.json                   # Dependencies and scripts
├── tailwind.config.ts             # Tailwind CSS configuration
├── tsconfig.json                  # TypeScript configuration
└── postcss.config.js              # PostCSS configuration
```

## Usage

### Viewing Deployments

The home page displays all VaultWarden deployments:

- **Union ID** - Unique identifier
- **Union Name** - Human-readable name
- **Status** - Deployment status (pending, provisioning, ready, failed)
- **VaultWarden URL** - Access URL (when ready)
- **Created At** - Timestamp

### Creating a New Union

1. Click **"New Union"** button
2. Enter a unique union name
3. Click **"Create Union"**
4. Monitor provisioning progress in the deployment list

### Viewing Deployment Details

Click on any deployment to view:

- **Deployment Events** - High-level milestones (helm_install, postgres_ready, vaultwd_ready)
- **Deployment Logs** - Detailed structured logs
- **Log Filtering** - Filter by level (debug, info, warn, error)

## API Integration

The frontend communicates with the Keyforge API via REST endpoints:

```typescript
// API client usage example
import { api } from './api/client'

// Fetch all deployments
const deployments = await api.getDeployments()

// Get specific deployment
const deployment = await api.getDeployment('union-123')

// Get deployment events
const events = await api.getDeploymentEvents('union-123')

// Get deployment logs with filtering
const logs = await api.getDeploymentLogs('union-123', {
  level: 'error',
  page: 1,
  limit: 50
})

// Create new union
const result = await api.createUnion('my-union')
```

See `src/api/client.ts` for all available methods.

## Development

### Type Definitions

TypeScript types are defined in `src/types/index.ts` and should match the OpenAPI spec in `../openapi.yaml`:

```typescript
interface Union {
  union_id: string
  name: string
  status: 'pending' | 'provisioning' | 'ready' | 'failed'
  vaultwd_url: string | null
  created_at: string
}

interface DeploymentDetail extends Union {
  admin_token?: string
}

interface DeploymentEvent {
  event_name: string
  status: 'pending' | 'in_progress' | 'success' | 'failed'
  message: string | null
  created_at: string
}

interface DeploymentLog {
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  created_at: string
}
```

### State Management

- **Server State**: TanStack Query manages API data with automatic caching and refetching
- **Client State**: Zustand (if needed for local UI state)

### Styling

The app uses Tailwind CSS with the following approach:

- Utility-first classes for component styling
- No custom CSS modules
- Tailwind configuration in `tailwind.config.ts`
- Global styles in `src/index.css`

## Building for Production

### 1. Build the App

```bash
pnpm run build
```

This creates an optimized production build in the `dist/` directory.

### 2. Preview Production Build

```bash
pnpm run preview
```

Serves the production build locally for testing.

### 3. Deploy

The `dist/` directory contains static files that can be served by any web server:

- **Nginx**
- **Apache**
- **Caddy**
- **Static hosting** (Vercel, Netlify, Cloudflare Pages, etc.)

**Example nginx configuration:**

```nginx
server {
    listen 80;
    server_name keyforge.example.com;
    root /var/www/keyforge/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## CORS Configuration

The API server (`src/index.ts`) is configured to allow requests from:

- `http://localhost:5173` (Vite dev server)
- `http://localhost:3001` (Alternative dev port)

For production, update the CORS configuration in the API:

```typescript
app.use('*', cors({
  origin: ['https://keyforge.example.com'],
  credentials: true
}))
```

## Troubleshooting

### Error: `Failed to fetch` or Network Error

**Solutions:**

1. **Verify API is running:**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Check API URL in `.env`:**
   ```env
   VITE_API_BASE=http://localhost:3000
   ```

3. **Restart dev server after changing `.env`:**
   ```bash
   pnpm run dev
   ```

4. **Check browser console for CORS errors**

### Error: `Cannot find module` or import errors

**Solutions:**

```bash
# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Error: `Port 5173 already in use`

**Solutions:**

```bash
# Kill process using the port
lsof -ti :5173 | xargs kill -9

# Or specify a different port
pnpm run dev -- --port 3001
```

### TypeScript errors after API changes

**Solutions:**

1. **Update types in `src/types/index.ts`** to match OpenAPI spec
2. **Rebuild TypeScript:**
   ```bash
   pnpm run build
   ```

### Stale data in UI

TanStack Query caches data. To force a refresh:

1. **Hard refresh browser:** Cmd/Ctrl + Shift + R
2. **Clear browser cache**
3. **Adjust query stale time** in `src/hooks/useDeployments.ts`

## Further Reading

- [Vite Documentation](https://vite.dev/)
- [React Documentation](https://react.dev/)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [React Router Documentation](https://reactrouter.com/)

## Related Documentation

- [Main README](../README.md) - Project overview
- [API Documentation](../openapi.yaml) - OpenAPI specification
- [Troubleshooting](../TROUBLESHOOTING.md) - Common issues
- [Setup Guide](../SETUP.md) - Backend setup
