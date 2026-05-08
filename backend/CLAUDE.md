# Project Setup

## Structure
- Source files: `src/`
- Compiled output: `dist/`
- Tests: `tests/` (same level as `src/`)

## Commands
- `npm run dev` — runs `src/index.ts`
- `npm run test` — runs Jest tests from `tests/`
- `npm run format:code` - runs ESLint and Prettier

## Stack
- TypeScript (strict mode)
- Jest for testing
- Node.js target
- ESLint + Prettier for code style

## Conventions
- All new features need a corresponding test in `tests/`
- Prefer named exports over default exports