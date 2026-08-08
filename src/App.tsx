import { Component, type ReactNode } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';

interface BoundaryState {
  error: Error | null;
}

/** Top-level error boundary: never show a blank window on an unexpected crash. */
class ErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('App crashed:', error);
    console.error('Component stack:', info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full space-y-4 text-center">
            <div className="text-4xl">⚠️</div>
            <h1 className="text-xl font-bold font-heading">Something went wrong</h1>
            <p className="text-sm text-slate-400 break-words">
              {this.state.error.message || 'An unexpected error occurred.'}
            </p>
            <p className="text-xs text-slate-500">
              Your data is safe in the local database. Reload to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
