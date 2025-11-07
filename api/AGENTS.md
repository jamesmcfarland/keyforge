# Agent Guidelines for Keyforge API

## Commands

- **Dev**: `bun run dev` (runs with hot reload)
- **DB Migration Generate**: `bunx drizzle-kit generate`
- **DB Migration Push**: `bunx drizzle-kit push`
- No test or lint commands currently configured

## Code Style

- **Runtime**: Bun (not Node.js)
- **Framework**: Hono with TypeScript
- **Strict Mode**: Enabled (`strict: true` in tsconfig.json)
- **Imports**: Use single quotes, no semicolons required but currently used inconsistently
- **Database**: Drizzle ORM with PostgreSQL, schema in `src/lib/db/schema.ts`
- **Environment**: Use `dotenv/config` import for environment variables
- **Logging**: Use Pino logger via Hono context (`c.get("logger")`)
- **Types**: Prefer explicit types, use Hono's `ContextVariableMap` for context extensions
- **Naming**: camelCase for variables/functions, PascalCase for types/enums, snake_case for DB columns
- **Error Handling**: Non-null assertion (`!`) used for required env vars
- **DB Enums**: Define with `pgEnum` before table definitions
- **Tables**: Export with `Table` suffix (e.g., `deploymentsTable`)
