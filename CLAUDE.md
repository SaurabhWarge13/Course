# Learning Dashboard — Project Instructions

## Mission
Build and maintain a reliable React Native Learning Dashboard. Optimize for correct behavior, maintainability, accessibility, and clear separation of concerns. Prefer a complete, dependable product over unnecessary features.

The required user journey is:
1. Log in.
2. View a course dashboard.
3. Open course details and lessons.
4. Mark lessons complete and see progress update.
5. Use cached courses/lessons while offline and after app restart.

Prioritize code quality, architecture, API/state handling, and offline behavior. Keep the UI clear and accessible, with styling that supports the product rather than distracting from its functionality.

## Before changing code
- Inspect the actual repository, `package.json`, React Native version, existing files, and current git status.
- Treat the current repository and the assignment brief as the source of truth. Do not assume the planned folder structure already exists.
- Check installed package versions and official package compatibility before adding or upgrading dependencies.
- If a requirement is ambiguous, state the assumption and choose the smallest defensible implementation. Ask only if the ambiguity blocks progress.
- For substantial work, first give a short plan, list the files likely to change, and identify how you will verify it. Then implement in small, testable steps.

## Target architecture
Use this data flow:

`Screens → Zustand stores/actions → Repository → API client and StorageAdapter`

- **Screens:** presentation, user interaction, loading/empty/error states. Avoid embedding API, cache, or reconciliation logic in screens.
- **Zustand stores:** observable UI/application state and actions. Keep actions small and delegate data behavior to services/repositories.
- **Repository:** course/lesson loading, cache fallback, cache writes, and progress consistency.
- **API client:** Axios instance, timeout, normalized errors, and mock adapter.
- **StorageAdapter:** minimal interface implemented by MMKV in the app and an in-memory adapter in tests.
- **Secure token storage:** use `react-native-keychain` only for credentials/session data that the implemented auth flow actually needs.
- **Connectivity:** use NetInfo for connection status and offline UI. Do not treat connectivity status as proof that a request will succeed.

Preferred stack, unless the repository or assignment makes it infeasible:
- React Native CLI + TypeScript
- React Navigation Native Stack with typed routes
- Zustand
- Axios + `axios-mock-adapter`
- `react-native-mmkv` behind `StorageAdapter`
- `react-native-keychain` for secure session credentials
- `@react-native-community/netinfo`
- Jest for unit tests

Do not add Redux Toolkit, TanStack Query, SQLite, a UI component library, or other major dependencies just because they may be useful at scale. Explain future upgrades in the README instead. Add a dependency only when it solves a current requirement and its integration cost is justified.

## Functional requirements
- Login: validate inputs, show submitting/error state, and provide deterministic mock credentials documented in the README.
- Navigation: use typed route parameters. Gate the app/auth stack from authentication state; avoid imperative navigation as a substitute for auth state.
- Dashboard: show courses and progress, plus loading, empty, error/retry, and offline states.
- Course details: show lessons, completed state, and a way to mark a lesson complete.
- Progress: calculate from lessons using one pure function. Define and consistently use the rounding rule. Handle zero lessons.
- Offline: read cache first when available, then refresh from the API. On request failure, retain valid cached data. Cache lessons per course.
- Persistence: update local lesson state and course progress consistently. Do not claim failed server writes will eventually sync unless a durable retry/outbox mechanism is implemented.
- Recovery: support retry and reconnect refresh where appropriate. Avoid duplicate requests or stale updates where practical.
- README: document architecture, offline behavior, security boundaries, scaling options, how to run/test/demo, and what is implemented versus proposed.

## Quality rules
- Use strict, explicit TypeScript types. Avoid `any`; if unavoidable, explain why and narrow it quickly.
- Keep modules small and single-purpose. Prefer simple functions over abstractions that do not earn their complexity.
- Do not silently swallow errors. Normalize errors at the service boundary and display safe, useful messages in the UI.
- Do not log tokens, passwords, personal data, or full sensitive request headers.
- Never hardcode real secrets. Mock credentials and mock tokens are development-only.
- Do not describe mock API behavior as real backend behavior.
- Do not claim a security property, offline guarantee, test pass, or build success unless it has actually been verified.
- Preserve the existing project configuration unless a change is necessary. Avoid broad dependency upgrades.
- Do not add architecture solely to make the project look enterprise-grade.

## Required verification after meaningful changes
Run the relevant checks that exist in this repository, such as:
- `yarn test --runInBand`
- `yarn tsc --noEmit`
- `yarn lint`
- Launch on an available simulator/emulator where feasible.
Report which checks ran and their actual result. If a command cannot run, state why; do not imply it passed.

## Package Manager and Verification Rules
1. Yarn (Classic, v1; `packageManager` in `package.json` pins `yarn@1.22.22`) is the sole package manager for this repository.
2. `yarn.lock` is the only dependency lockfile that may be committed.
3. Do not generate, restore, or commit `package-lock.json`; it is ignored by git.
4. Use Yarn for dependency installation, scripts, tests, lint and TypeScript checks: `yarn install`, `yarn test`, `yarn lint`, `yarn tsc --noEmit`, `yarn android`, `yarn ios`, `yarn start`. Run local binaries with `yarn <bin>` rather than `npx`.
5. Install with the lockfile-preserving command for the installed Yarn version: `yarn install --frozen-lockfile` for Yarn Classic (`yarn install --immutable` would be the Yarn 2+ equivalent).
6. Preserve `ios/Podfile.lock` and use the existing Bundler/CocoaPods workflow (`cd ios && bundle exec pod install`) for iOS dependencies; do not update native pods unless a change requires it.
7. When adding or removing dependencies, change `package.json` and `yarn.lock` only through Yarn (`yarn add`, `yarn remove`), with exact versions that are proven compatible with the installed React Native version.
8. After relevant code or dependency changes, run the required tests, lint and TypeScript checks with Yarn and report the real results, including the actual test and suite counts.
9. Never claim a build, test or manual check passed unless the command actually completed successfully; say which checks did not run and why.
10. Do not perform git commits, pushes, resets, checkouts, cleans or other destructive git operations without explicit user authorization.

## Implementation priorities
1. Get the complete login → dashboard → details → completion journey working.
2. Add cache-first reads, offline fallback, and persistence/relaunch behavior.
3. Add meaningful repository/progress/validation tests.
4. Verify error states, TypeScript, lint, and runtime behavior.
5. Keep setup instructions and technical documentation accurate.
6. Consider a persistent outbox/retry queue or additional polish only when the core experience is stable.

Prefer a complete, verified product over a partially completed advanced architecture.
