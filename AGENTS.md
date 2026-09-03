# Repository Guidelines

## Project Structure & Module Organization

Alarim is an Expo Router React Native app.

- `src/app/` contains file-based routes and navigation entry points.
- `src/components/` contains reusable screens and UI components.
- `src/context/` owns shared alarm state and persistence orchestration.
- `src/lib/` contains storage, notifications, media, and alarm utilities.
- `src/constants/` and `src/types/` contain theme tokens and domain types.
- `app.json`, `tsconfig.json`, `eslint.config.js`, `package.json`, and `bun.lock` define app and tooling configuration.

There is currently no test or static-assets directory. User-selected media is handled at runtime; platform-specific modules use suffixes such as `storage.web.ts`.

## Build, Test, and Development Commands

- `bun install` — install dependencies from `bun.lock`.
- `bun run start` — start the Expo development server.
- `bun run android` / `bun run ios` — build and launch a native development target.
- `bun run web` — run the web target.
- `bun run typecheck` — run strict TypeScript checking.
- `bun run lint` — run ESLint across the repository.
- `bunx expo-doctor` — check Expo dependency and configuration health.

Use Bun 1.4.0 for dependency changes and commit `bun.lock`; do not regenerate an npm lockfile.

## Coding Style & Naming Conventions

Use TypeScript with two-space indentation, semicolons, double-quoted strings, and the existing ESLint configuration. Use PascalCase for React components and types, camelCase for functions, variables, and callbacks, and descriptive domain names such as `AlarmCard` or `scheduleAlarmNotifications`. Prefer the `@/*` path alias for imports from `src`. Keep platform-specific behavior in platform-specific files where possible.

## Testing Guidelines

No automated test framework or `bun test` script is configured. Every change should pass `bun run typecheck` and `bun run lint`. For UI or native changes, manually smoke-test the affected flow with Expo on the relevant platform; check alarm creation/editing, notifications, and media selection when applicable.

## Commit & Pull Request Guidelines

No Git history is included in this workspace, so repository-specific commit conventions cannot be inferred. Use short imperative commits, for example `fix: preserve alarm row identity`. Pull requests should explain behavior changes, list validation commands, include screenshots for visual changes, and mention any `app.json`, native dependency, or lockfile updates.
