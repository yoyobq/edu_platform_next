# AGENTS.md

AI agent rules. Keep this file short; use `docs/` for details.

## Priority

- If rules conflict, use `docs/rule-precedence.md`.
- Layer and dependency rules win first: `docs/layer-model.md`, `docs/dependency-rules.md`.
- Topic rules apply only after ownership is clear; UI/layout/navigation/GraphQL/testing must not override layer boundaries.

## Workspace

- Stack: React 19, TS 5.9, Vite 8, React Router 7 Data Mode, Apollo, antd 6, Ant Design X, Tailwind 4, Vitest, Playwright.
- Alias: `@/` maps to `src/`.
- Env files live in `env/`, not repo root.
- Do not create `packages/`, `apps/`, or a new monorepo shape.
- Do not add a state library; use Apollo + React Context.

## Placement

- Stable: `src/app`, `src/pages`, `src/widgets`, `src/features`, `src/entities`, `src/shared`.
- Labs: `src/labs/<name>`; require `access.ts` and `meta.ts`; access-list gated.
- Sandbox: `src/sandbox/<name>`; dev/test only; never prod.
- New business validation defaults to labs. Throwaway prototypes go to sandbox. Existing stable ownership may go straight to stable.
- Moving labs/sandbox to stable needs human confirmation and cleanup.
- New source/docs files should start with a path header.

## Dependencies

- `pages -> widgets, features, entities, shared`
- `widgets -> features, entities, shared`
- `features -> entities, shared`
- `entities -> shared`
- `shared -> shared only`
- `labs -> same lab, shared, entities public API`
- `sandbox -> same sandbox, shared, entities public API`
- `app/router -> labs/sandbox public route API only`

Rules:

- Cross-module imports must use public barrels, e.g. `@/features/auth`; no deep imports.
- Stable must not depend on labs/sandbox except `src/app/router` route registration.
- Labs/sandbox must not depend on pages/widgets/features private code.
- Exceptions need human approval and `labs/<name>/meta.ts` `exception`.

## Stable Roles

- `app`: router, providers, layout shell, global config, bootstrap.
- `pages`: page composition.
- `widgets`: reusable page-scale UI blocks.
- `features`: user actions, workflows, owned adapters.
- `entities`: stable business objects; no mock/API/storage.
- `shared`: ownerless generic code only.
- Use `domain/application/infrastructure/ui` only for complex stable features.
- API/storage/URL params/SDK/mock belong to infrastructure. Find the owner first; do not promote to shared by default.

## UI

- antd owns business UI. Ant Design X owns AI UI. Tailwind owns layout wrappers.
- No Tailwind `className` on antd/antdX component bodies.
- Do not Tailwind-style `Typography`; use native `span` for compact metadata.
- Colors/radius/shadow/layers use antd tokens or CSS vars; no hex/rgb/hsl magic values.
- z-index uses `--z-index-*` tokens only; no raw numbers or inline `zIndex`.
- No Tailwind breakpoint prefixes; use JS width bands and conditional rendering.
- Dark mode uses `.dark`, not `prefers-color-scheme`.

## Router Layout

- Use React Router Data Mode.
- Auth, permission, and lab exposure checks belong in loaders/guards.
- Route truth: `src/app/router/index.tsx`.
- Navigation truth: `src/app/navigation/`; layout consumes aggregated results.
- Sidecar must live outside `<Outlet />`; route changes must not reset it by default.
- AI cannot be the only business path; `main` must work without Sidecar.

## GraphQL

- Requests: `src/shared/graphql/request.ts` `executeGraphQL()`.
- Client: `src/shared/graphql/client.ts`.
- Auth runtime: `src/app/bootstrap/graphql-runtime.ts`.
- Errors: `docs/project-convention/graphql-error-model.md`.
- Auth boundary: `docs/project-convention/graphql-ingress-auth-boundary.md`.

## Engineering

- Style: single quotes, trailing commas, 100 cols, 2 spaces, LF.
- Import order is `simple-import-sort`; do not hand-sort.
- ESLint enforces boundaries, public imports, import groups, UI className, magic colors, inline zIndex.
- Commit in Chinese: `<type>(<scope>): <subject>` plus body.
- Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.

## Commands

- Dev/build: `npm run dev`, `npm run build`
- Check: `npx tsc --noEmit`, `npm run lint`, `npm run format:check`
- Fix: `npm run lint:fix`, `npm run format`
- Tests: `npm run test:unit`, `npm run test:e2e`, `npm run test:e2e:headed`
- After code changes, prefer `npx tsc --noEmit` and `npm run lint`.
- E2E specs: `e2e/specs/`; E2E env: `env/.env.e2e.*`.

## Docs

- Rule conflicts: `docs/rule-precedence.md`
- Layers: `docs/layer-model.md`
- Dependencies/imports: `docs/dependency-rules.md`
- Stable clean: `docs/stable-clean/architecture.md`
- Infrastructure/mock: `docs/infrastructure-rules.md`
- UI stack: `docs/ui-stack-rules.md`
- Design tokens: `docs/ui-design/`
- Layout/Sidecar: `docs/layout.md`
- Navigation: `docs/navigation.md`
- Labs: `docs/labs-rules.md`
- Sandbox: `docs/sandbox-rules.md`
- AI workflow: `docs/ai-workflow.md`
- Testing: `docs/testing.md`
- Chunks: `docs/chunk-strategy.md`
- Conventions: `docs/project-convention/`
- Backend truth: `docs/backend/README.md`
