# Project

A full-stack application with a decoupled backend and frontend. Each is a self-contained project with its own dependencies, tooling, and CLAUDE.md.

## Structure
```
/
├── backend/   # REST API — Node.js + Express + TypeScript
└── frontend/  # React.js (Vite) SPA application
```

## Conventions
- Work within the relevant subdirectory — do not run commands from the root
- Each subdirectory has its own `CLAUDE.md` with full context
- Commit messages should indicate scope: `backend: ...` or `frontend: ...`

## Rules

- Follow TypeScript best practices throughout:
  - Do not use the `as` keyword to force type assertions
  - Avoid `any` types

## Guidelines

- All business logic must live in the **service layer** (`services/` directory)
- Controllers should delegate to services and must not contain business logic directly
