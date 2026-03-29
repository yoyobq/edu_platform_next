# aigc-friendly-frontend

AI-friendly frontend project based on `Vite + React + TypeScript + Ant Design + Tailwind CSS`.

## AI Entry

Before generating or modifying code, read [docs/README.md](./docs/README.md).

That document set is the source of truth for structure, dependencies, and promotion rules.

## Overview

This project is built for a workflow where AI can generate quickly, experiments stay isolated, and only manually-governed code enters the long-term stable area.

Detailed rules live in [docs/README.md](./docs/README.md).

## Stack

- Vite
- React 19
- TypeScript
- Ant Design
- Ant Design X
- Tailwind CSS 4
- ESLint + Prettier

## Commands

```bash
npm install
npm run dev
npm run check
```

Other useful commands:

- `npm run lint`
- `npm run lint:fix`
- `npm run format`
- `npm run format:check`
- `npm run build`

## Directory Model

```txt
src/
  app/
  pages/
  widgets/
  features/
  entities/
  shared/
  labs/
  sandbox/
```

Simple interpretation:

- `stable`: long-term formal code
- `labs`: controlled experiments that may enter production
- `sandbox`: dev-only prototypes and trial code

## Tooling

- Prettier handles formatting
- ESLint handles architectural boundaries and import sorting
- VS Code workspace settings enable format-on-save and ESLint fixes
- Husky + lint-staged run lightweight staged-file checks on commit

## Testing

`vitest` is installed, but test setup is not enabled yet.
