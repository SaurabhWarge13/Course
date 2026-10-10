// Dependency direction: shared → domain → infrastructure → features → navigation/app.
// Each override forbids the imports that would point the other way (see README, Architecture).
const NATIVE_ADAPTERS = ['axios', 'react-native-mmkv', 'react-native-keychain', '@react-native-community/netinfo'];
const DATA_ADAPTERS = ['**/infrastructure/api/**', '**/infrastructure/storage/**', '**/infrastructure/secure/**'];

const DOMAIN = [
  {
    group: ['react', 'react-native', ...NATIVE_ADAPTERS, '**/infrastructure/**', '**/features/**', '**/app/**', '**/navigation/**', '**/ui/**'],
    message: 'Domain code is pure TypeScript: it may import only other domain modules and shared helpers.',
  },
];
const SHARED = [
  {
    group: ['**/domain/**', '**/infrastructure/**', '**/features/**', '**/app/**', '**/navigation/**', '**/ui/**'],
    message: 'Shared helpers depend on nothing in the app.',
  },
];
const INFRASTRUCTURE = [
  {
    group: ['**/features/**', '**/app/**', '**/navigation/**', '**/ui/**'],
    message: 'Infrastructure depends on domain and shared code only.',
  },
];
const FEATURE = [
  {
    group: ['**/app/**', '**/navigation/**', '!**/navigation/types'],
    message: 'Features never import the composition root or the navigator; the app layer wires features together.',
  },
];
const AUTH_FEATURE = [
  ...FEATURE,
  { group: ['**/features/courses/**'], message: 'The auth feature does not depend on other features.' },
];
const COURSES_FEATURE = [
  ...FEATURE,
  {
    group: ['**/features/auth/**', '!**/features/auth/authStoreContext'],
    message: 'The courses feature may use the auth store hook only, never other auth internals.',
  },
];
const VIEW = [
  {
    group: [...NATIVE_ADAPTERS, ...DATA_ADAPTERS],
    message: 'Screens and components talk to stores, never to HTTP, storage or secure-storage adapters.',
  },
];
const UI = [
  {
    group: [...NATIVE_ADAPTERS, '**/domain/**', '**/infrastructure/**', '**/features/**', '**/app/**', '**/navigation/**'],
    message: 'UI primitives are presentational and depend on nothing above the theme.',
  },
];

const restrict = patterns => ({ 'no-restricted-imports': ['error', { patterns }] });

module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    { files: ['src/domain/**'], rules: restrict(DOMAIN) },
    { files: ['src/shared/**'], rules: restrict(SHARED) },
    { files: ['src/infrastructure/**'], rules: restrict(INFRASTRUCTURE) },
    { files: ['src/features/auth/**'], rules: restrict(AUTH_FEATURE) },
    { files: ['src/features/courses/**'], rules: restrict(COURSES_FEATURE) },
    { files: ['src/features/auth/screens/**', 'src/features/auth/components/**'], rules: restrict([...AUTH_FEATURE, ...VIEW]) },
    { files: ['src/features/courses/screens/**', 'src/features/courses/components/**'], rules: restrict([...COURSES_FEATURE, ...VIEW]) },
    { files: ['src/ui/**'], rules: restrict(UI) },
    { files: ['src/navigation/**'], rules: restrict(VIEW) },
  ],
};
