# Learning Dashboard

React Native (CLI, TypeScript): sign in, browse courses, mark lessons complete, read cached content offline.

**Run**

```sh
yarn install --frozen-lockfile && (cd ios && bundle exec pod install)
yarn start && yarn android          # or yarn ios
yarn test && yarn lint && yarn tsc --noEmit
cd android && ./gradlew assembleRelease   # app/build/outputs/apk/release/app-release.apk
```

**Mock credentials:** any valid email + `Password@123`; `empty@test.com` shows an empty dashboard. Access tokens expire after 60 s; in debug builds, long-press "My Courses" for the dev menu.

## 1. Architecture

Pragmatic MVVM with a repository layer: **screens → Zustand stores → repositories → axios clients + MMKV storage adapter**, plus pure domain functions (validation, progress, completion). Folders follow the dependency direction `shared → domain → infrastructure → features → app`, enforced by ESLint import rules: screens never touch HTTP or storage, stores are testable without React, repositories run against an in-memory adapter and fake APIs, and features never import the composition root (stores and connectivity arrive through React context). A small session lifecycle orders restore, login, sign-out and expiry. Debugging: dev-only logger, dev menu, error boundary, typed errors, React Native DevTools.

## 2. Offline Support

Courses and lessons are cached per user in MMKV as versioned envelopes validated on read. The cache is read before the dashboard mounts, then refreshed; a failed refresh keeps cached data and shows a banner. Progress is derived from a lesson list only when it is complete. Completion is online-only: optimistic update, server confirmation written to the cache, rollback with Retry on failure. No offline-write queue by design.

## 3. Security

The session lives only in Keychain/Keystore (`react-native-keychain`, app-specific service), never in MMKV or UI state; an in-memory session context feeds the request interceptor. The protected axios client shares one refresh per session, retries each request once, rejects stale-session requests and ends the session on an invalid refresh token. Keychain writes are serialized so a late save cannot resurrect a signed-out session, and a failed secure cleanup blocks login until it succeeds. Login validation: valid email plus a non-empty password up to 128 characters, no composition rules. The mock provides no real security.

## 4. Scale

For 1M users and hundreds of courses: cursor pagination and conditional requests; a server-state cache (TanStack Query) over the repositories; SQLite/WatermelonDB behind the storage adapter; FlashList; crash and API monitoring; CI gates.

## 5. Second Platform

This submission is React Native, so the one codebase already runs on both Android and iOS. Rebuilt natively it would use the same layers and contracts: Android with Jetpack Compose, ViewModel + StateFlow, Room, Retrofit/OkHttp with an authenticator for refresh and Keystore; iOS with SwiftUI, `@Observable` view models, SwiftData, URLSession async/await with an actor for single-flight refresh and Keychain Services.

Limitations: mock state resets with app data; the release APK uses the template debug signing.
