import { Alert } from 'react-native';
import type { DevControls } from '../infrastructure/api/mock/devControls';

export function showDevMenu(controls: DevControls | null, userId: string | null): void {
  if (!__DEV__ || !controls || userId === null) {
    return;
  }
  Alert.alert(
    'Developer menu',
    `Simulated server error is ${controls.forceServerError ? 'on' : 'off'}.`,
    [
      { text: 'Expire access token', onPress: () => controls.expireAccessToken(userId) },
      { text: 'Revoke refresh token', onPress: () => controls.revokeRefreshToken(userId) },
      {
        text: controls.forceServerError ? 'Stop server errors' : 'Force server error',
        onPress: () => controls.toggleForceServerError(),
      },
    ],
    { cancelable: true },
  );
}
