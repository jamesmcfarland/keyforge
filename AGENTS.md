# Agent Guidelines for Keyforge

## Build & Development Commands

- **Dev**: `pnpm run dev` (runs `tsx watch src/index.ts`)
- **Build**: `pnpm run build` (runs `tsc`)
- **Start**: `pnpm start` (runs `node dist/index.js`)
- **Database**: `pnpm run db:generate` (drizzle-kit generate), `pnpm run db:migrate` (run migrations)
- **Package Manager**: pnpm (v10.13.1+)

No test or lint commands are currently configured. Tests should be added if needed.

## Process Management

**CRITICAL: DO NOT restart, kill, or stop any processes.**
- The user manages Docker, Kubernetes, and application processes manually
- DO NOT run commands like `kill`, `pkill`, `killall`, or restart servers
- DO NOT use `npm run dev`, `npm start`, or similar commands to start/restart services
- If you need the user to restart something, ask them to do it

## Code Style Guidelines

### TypeScript & Types
- **Strict mode enabled** - all files use strict type checking (`"strict": true`)
- **Module syntax**: `verbatimModuleSyntax: true` - explicit type imports required with `.js` extensions
- **Target**: ESNext, Module: NodeNext
- Always annotate function return types and parameters

### Imports
- Use ES module syntax (`import`/`export`) with `.js` extensions (e.g., `import admin from './routes/admin.js'`)
- For type-only imports, use `import type` (required by verbatimModuleSyntax)
- Framework imports: Hono from `hono` and `@hono/node-server`
- JSX imports from `hono/jsx`

### Code Patterns
- **Web framework**: Hono for HTTP routes and middleware
- **Services pattern**: Create service modules (e.g., `services/vaultwd-client.ts`, `services/registry.ts`)
- **Routing pattern**: Define routes in separate files (e.g., `routes/admin.ts`, `routes/societies.ts`)
- **Middleware**: Use Hono middleware for auth and error handling
- **Database**: Drizzle ORM with postgres driver

### Error Handling
- Include error handling in all async operations
- Log provisioning steps for debugging
- Use global error handler middleware

### Naming Conventions
- Functions/variables: camelCase
- Interfaces/Types: PascalCase
- File names: kebab-case (e.g., `vaultwd-client.ts`)
- Constants: UPPER_SNAKE_CASE

### External Libraries
- Shell execution: `execa` for kubectl/helm operations
- Database: Drizzle ORM with `postgres` driver
- Server: `@hono/node-server`
- Password hashing: `argon2`

## Architecture Notes

- Single-tenant per VaultWarden instance deployed to Kubernetes
- Service → Route → Endpoint pattern
- Database schemas in `src/db/schema.ts`
- Kubernetes operations via helm/kubectl shell commands through execa
