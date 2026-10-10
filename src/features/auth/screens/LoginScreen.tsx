import { AlertCircle, GraduationCap } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type TextInput,
  View,
} from 'react-native';
import { type LoginFieldErrors, validateLogin } from '../../../domain/auth/validation';
import { AppButton } from '../../../ui/components/AppButton';
import { AppScreen } from '../../../ui/components/AppScreen';
import { AppText } from '../../../ui/components/AppText';
import { AppTextField } from '../../../ui/components/AppTextField';
import { ErrorView } from '../../../ui/components/ErrorView';
import { IconTile } from '../../../ui/components/IconTile';
import { LoadingView } from '../../../ui/components/LoadingView';
import { iconSize } from '../../../ui/scale';
import { colors, radius, spacing } from '../../../ui/theme';
import type { AuthStatus } from '../authStore';
import { useAuthStore } from '../authStoreContext';

function assertNever(value: never): never {
  throw new Error(`Unhandled auth status: ${String(value)}`);
}

function CleanupRequiredView() {
  const errorMessage = useAuthStore(state => state.errorMessage);
  const retryCleanup = useAuthStore(state => state.retryCleanup);
  return (
    <AppScreen edges={['top', 'bottom']}>
      <ErrorView
        title="Secure storage problem"
        message={errorMessage ?? 'Please try again.'}
        onRetry={() => {
          retryCleanup();
        }}
      />
    </AppScreen>
  );
}

// The single unauthenticated route: the sign-in form, plus the blocking lifecycle states that must
// never offer a new login while credentials are being restored or cleared.
export function LoginScreen() {
  const status: AuthStatus = useAuthStore(state => state.status);
  switch (status) {
    case 'unauthenticated':
    case 'submitting':
      return <LoginForm />;
    case 'signingOut':
      return (
        <AppScreen edges={['top', 'bottom']}>
          <LoadingView message="Signing out…" />
        </AppScreen>
      );
    case 'restoring':
      // Only reachable after the native splash is gone, e.g. while retrying a first-launch cleanup.
      return (
        <AppScreen edges={['top', 'bottom']}>
          <LoadingView />
        </AppScreen>
      );
    case 'cleanupRequired':
      return <CleanupRequiredView />;
    case 'authenticated':
      // The navigator never mounts this route while authenticated.
      return null;
    default:
      return assertNever(status);
  }
}

function LoginForm() {
  const status = useAuthStore(state => state.status);
  const errorMessage = useAuthStore(state => state.errorMessage);
  const notice = useAuthStore(state => state.notice);
  const login = useAuthStore(state => state.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const passwordRef = useRef<TextInput>(null);
  const isSubmitting = status === 'submitting';

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setFieldErrors(errors => ({ ...errors, email: undefined }));
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setFieldErrors(errors => ({ ...errors, password: undefined }));
  };

  const handleLogin = () => {
    const errors = validateLogin(email, password);
    setFieldErrors(errors);
    if (errors.email || errors.password) {
      return;
    }
    Keyboard.dismiss();
    login(email, password);
  };

  return (
    <AppScreen edges={['top', 'bottom']} padded>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <IconTile icon={GraduationCap} size={48} style={styles.brand} />
            <AppText variant="title" accessibilityRole="header">
              Welcome back
            </AppText>
            <AppText variant="body" color={colors.muted}>
              Sign in to continue learning.
            </AppText>
          </View>

          {notice !== null && (
            <View style={styles.notice}>
              <AppText variant="bodySmall" color={colors.warningText}>
                {notice}
              </AppText>
            </View>
          )}

          <AppTextField
            label="Email"
            value={email}
            onChangeText={handleEmailChange}
            error={fieldErrors.email}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!isSubmitting}
          />
          <AppTextField
            label="Password"
            value={password}
            onChangeText={handlePasswordChange}
            error={fieldErrors.password}
            placeholder="Your password"
            secure
            inputRef={passwordRef}
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            editable={!isSubmitting}
          />

          {errorMessage !== null && (
            <View style={styles.errorRow} accessibilityLiveRegion="polite">
              <AlertCircle size={iconSize(18)} color={colors.danger} />
              <AppText variant="bodySmall" color={colors.dangerText} style={styles.flex}>
                {errorMessage}
              </AppText>
            </View>
          )}

          <AppButton label="Sign in" onPress={handleLogin} loading={isSubmitting} />

          <AppText variant="caption" color={colors.muted} align="center">
            Demo: any email with password "Password@123". Use empty@test.com to see an empty
            dashboard.
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xl,
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  brand: {
    marginBottom: spacing.lg,
  },
  notice: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
});
