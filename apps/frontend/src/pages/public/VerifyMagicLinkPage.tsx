import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';

export function VerifyMagicLinkPage() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const { login } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('No verification token provided');
      return;
    }

    api
      .post('/auth/magic-link/verify', { token })
      .then(({ data }) => {
        login(data.accessToken, data.user);
        navigate('/member/dashboard');
      })
      .catch(() => setError('Invalid or expired link. Please request a new one.'));
  }, [searchParams, login, navigate]);

  return (
    <AuthLayout>
      {error ? (
        <div className="text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
          <h2 className="mt-4 text-lg font-semibold">Verification Failed</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button asChild className="mt-4">
            <Link to="/login">Request New Link</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Verifying your link...</p>
        </div>
      )}
    </AuthLayout>
  );
}
