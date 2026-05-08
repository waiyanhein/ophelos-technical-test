# Project

## Stack
- **Runtime:** Node.js + TypeScript (strict mode)
- **Framework:** Express.js
- **Testing:** Jest
- **Linting/Formatting:** ESLint + Prettier

## Structure
```
src/
  controllers/   # Route handlers
  services/      # Business/domain logic
dist/            # Compiled output (do not edit)
tests/           # Mirrors src/ structure
```

## Commands
| Command | Action |
|---|---|
| `npm run dev` | Run `src/index.ts` in development |
| `npm run test` | Run Jest test suite |
| `npm run format:code` | Lint and format via ESLint + Prettier |

## Conventions
- Named exports only — no default exports
- Every new feature must have a corresponding test in `tests/`
- Never modify files in `dist/` directly
- Run `npm run format:code` before committing

## TypeScript
- Strict mode is enabled — avoid `any`, use explicit types
- All source files live in `src/`, compiled to `dist/`