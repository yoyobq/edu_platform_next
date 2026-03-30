# aigc-friendly-frontend

AI-friendly frontend project based on `Vite + React + TypeScript + Ant Design + Tailwind CSS`.

## AI Entry

Before generating or modifying code, read [docs/README.md](./docs/README.md).

That document set is the source of truth for structure, dependencies, and promotion rules.

## Overview

This project is built for a workflow where AI can generate quickly, experiments stay isolated, and only manually-governed code enters the long-term stable area.

Detailed rules live in [docs/README.md](./docs/README.md).

## Architecture Model

The project uses a two-dimensional governance model:

- First dimension: lifecycle and exposure governance
  - `stable`: formal long-term code
  - `labs`: controlled production experiments
  - `sandbox`: development-only trials
- Second dimension: internal responsibility layering inside `stable` only
  - outer slice model: `app / pages / widgets / features / entities / shared`
  - inner clean model: introduce `domain / application / infrastructure / ui` only when a stable business slice has enough complexity

Important constraints:

- `labs` and `sandbox` do not use the second dimension by default
- not every frontend module needs Clean Architecture
- layout shells, page composition, and simple presentation modules should remain simple
- only stable slices with real business rules, orchestration, or external adapters should introduce clean layering

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
npm run test:e2e
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
- `stable` may use extra internal clean layering when complexity justifies it

## Tooling

- Prettier handles formatting
- ESLint handles architectural boundaries and import sorting
- VS Code workspace settings enable format-on-save and ESLint fixes
- Husky + lint-staged run lightweight staged-file checks on commit

## Testing

- Testing conventions and E2E setup live in [docs/testing.md](./docs/testing.md)

## Env

- shared and future dev env examples live under `env/`
- development mode example lives in `env/.env.development.example`
- production mode example lives in `env/.env.production.example`

## Routing

- client routing uses React Router Data Mode
