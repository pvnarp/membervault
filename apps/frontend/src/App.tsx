import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { ErrorBoundary } from '@/components/error-boundary';
import { AuthBootstrap } from '@/components/auth-bootstrap';
import { useIdleTimeout } from '@/hooks/use-idle-timeout';
import { AppRoutes } from './routes';

function IdleGuard({ children }: { children: React.ReactNode }) {
  useIdleTimeout();
  return <>{children}</>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthBootstrap>
              <IdleGuard>
                <AppRoutes />
              </IdleGuard>
            </AuthBootstrap>
            <Toaster
              position="top-right"
              toastOptions={{
                className: 'bg-card text-card-foreground border-border',
              }}
            />
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
