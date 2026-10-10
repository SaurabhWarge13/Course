import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { createAuthStore } from '../../src/features/auth/authStore';
import { AuthStoreProvider, useAuthStore } from '../../src/features/auth/authStoreContext';
import { createCoursesStore } from '../../src/features/courses/coursesStore';
import {
  CoursesStoreProvider,
  useCoursesStore,
} from '../../src/features/courses/coursesStoreContext';
import {
  ConnectivityProvider,
  useNetworkStatus,
} from '../../src/infrastructure/network/useNetworkStatus';
import { createSessionContext } from '../../src/infrastructure/secure/sessionContext';
import { createFakeConnectivity } from '../fakes/fakes';
import { alice, pythonCourse } from '../fakes/fixtures';

const noActions = () => ({
  login: jest.fn().mockResolvedValue(undefined),
  logout: jest.fn().mockResolvedValue(undefined),
  retryCleanup: jest.fn().mockResolvedValue(undefined),
});

function AuthStatusText() {
  const status = useAuthStore(state => state.status);
  return <Text>{`status:${status}`}</Text>;
}

function CourseCountText() {
  const count = useCoursesStore(state => state.courses.length);
  return <Text>{`courses:${count}`}</Text>;
}

function NetworkText() {
  const network = useNetworkStatus();
  return <Text>{`network:${network}`}</Text>;
}

function textOf(renderer: ReactTestRenderer.ReactTestRenderer): string {
  return JSON.stringify(renderer.toJSON());
}

type CatchState = { message: string | null };

// React reports render errors asynchronously in React 19, so a boundary is the reliable way to observe them.
class CatchRenderError extends React.Component<{ children: React.ReactNode }, CatchState> {
  state: CatchState = { message: null };

  static getDerivedStateFromError(error: Error): CatchState {
    return { message: error.message };
  }

  render() {
    return this.state.message === null ? this.props.children : <Text>{`caught:${this.state.message}`}</Text>;
  }
}

async function renderCaught(element: React.ReactElement): Promise<string> {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<CatchRenderError>{element}</CatchRenderError>);
  });
  return textOf(renderer);
}

describe('feature store providers', () => {
  it('serve the provided store instances to screens and follow their updates', async () => {
    const authStore = createAuthStore(noActions);
    const coursesStore = createCoursesStore({
      courseRepository: {
        readCached: jest.fn(),
        getCourses: jest.fn(),
        getLessons: jest.fn(),
        completeLesson: jest.fn(),
      },
      sessionContext: createSessionContext(),
    });
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <AuthStoreProvider store={authStore}>
          <CoursesStoreProvider store={coursesStore}>
            <AuthStatusText />
            <CourseCountText />
          </CoursesStoreProvider>
        </AuthStoreProvider>,
      );
    });
    expect(textOf(renderer)).toContain('status:restoring');
    expect(textOf(renderer)).toContain('courses:0');

    await ReactTestRenderer.act(() => {
      authStore.setState({ status: 'authenticated', user: alice });
      coursesStore.getState().hydrate(alice.id, { courses: [pythonCourse], lessonsByCourse: {} });
    });
    expect(textOf(renderer)).toContain('status:authenticated');
    expect(textOf(renderer)).toContain('courses:1');
  });

  it('fail loudly when a screen renders outside its provider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await renderCaught(<AuthStatusText />)).toContain('caught:useAuthStore must be used inside an AuthStoreProvider');
    expect(await renderCaught(<CourseCountText />)).toContain('caught:useCoursesStore must be used inside a CoursesStoreProvider');
    expect(await renderCaught(<NetworkText />)).toContain('caught:useNetworkStatus must be used inside a ConnectivityProvider');
    spy.mockRestore();
  });
});

describe('connectivity provider', () => {
  it('exposes the current status and re-renders on changes', async () => {
    const connectivity = createFakeConnectivity('online');
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ConnectivityProvider connectivity={connectivity}>
          <NetworkText />
        </ConnectivityProvider>,
      );
    });
    expect(textOf(renderer)).toContain('network:online');

    await ReactTestRenderer.act(() => {
      connectivity.setStatus('offline');
    });
    expect(textOf(renderer)).toContain('network:offline');
  });
});
