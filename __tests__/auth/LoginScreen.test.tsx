import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { type AuthStatus, createAuthStore } from '../../src/features/auth/authStore';
import { AuthStoreProvider } from '../../src/features/auth/authStoreContext';
import { LoginScreen } from '../../src/features/auth/screens/LoginScreen';
import { AppButton } from '../../src/ui/components/AppButton';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const FORM_HEADING = 'Welcome back';

let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

async function renderWith(status: AuthStatus, errorMessage: string | null = null) {
  const login = jest.fn().mockResolvedValue(undefined);
  const logout = jest.fn().mockResolvedValue(undefined);
  const retryCleanup = jest.fn().mockResolvedValue(undefined);
  // A store per test, provided the same way App.tsx provides the real one.
  const store = createAuthStore(() => ({ login, logout, retryCleanup }));
  store.setState({ status, errorMessage, notice: null });
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={metrics}>
        <AuthStoreProvider store={store}>
          <LoginScreen />
        </AuthStoreProvider>
      </SafeAreaProvider>,
    );
  });
  const output = JSON.stringify(renderer?.toJSON() ?? null);
  return { output, login, retryCleanup };
}

afterEach(async () => {
  await ReactTestRenderer.act(() => {
    renderer?.unmount();
  });
  renderer = null;
});

describe('LoginScreen auth states', () => {
  it.each<AuthStatus>(['unauthenticated', 'submitting'])('shows the sign-in form while %s', async status => {
    const { output } = await renderWith(status);
    expect(output).toContain(FORM_HEADING);
  });

  it('blocks with a signing-out state instead of the form', async () => {
    const { output } = await renderWith('signingOut');
    expect(output).toContain('Signing out…');
    expect(output).not.toContain(FORM_HEADING);
  });

  it('shows a loader without the form if restoration runs again after the splash', async () => {
    const { output } = await renderWith('restoring');
    expect(output).not.toContain(FORM_HEADING);
  });

  it('offers only a cleanup retry while cleanup is required', async () => {
    const { output, login, retryCleanup } = await renderWith('cleanupRequired', 'Cleanup failed.');
    expect(output).toContain('Secure storage problem');
    expect(output).toContain('Cleanup failed.');
    expect(output).not.toContain(FORM_HEADING);

    const buttons = renderer?.root.findAllByType(AppButton) ?? [];
    expect(buttons).toHaveLength(1);
    await ReactTestRenderer.act(() => {
      buttons[0].props.onPress();
    });
    expect(retryCleanup).toHaveBeenCalledTimes(1);
    expect(login).not.toHaveBeenCalled();
  });

  it('never renders the form while authenticated', async () => {
    const { output } = await renderWith('authenticated');
    expect(output).not.toContain(FORM_HEADING);
    // Only the safe-area provider remains; the screen itself renders nothing.
    expect(renderer?.toJSON()).toMatchObject({ children: null });
  });
});
