import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, UserCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState('');
  const { t } = useTranslation('common');
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const requestMagicLink = async (targetEmail: string) => {
    const { data } = await api.post('/auth/magic-link/request', { email: targetEmail });
    return data.devToken as string | undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const devToken = await requestMagicLink(email);
      setSent(true);
      if (devToken) {
        setDevLink(`${window.location.origin}/auth/verify?token=${devToken}`);
        toast.success('Magic link generated — see link below');
      } else {
        toast.success('Check your email for a login link');
      }
    } catch {
      toast.error('Failed to send login link');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      const { data } = await api.post('/auth/demo-login');
      login(data.accessToken, data.user);
      navigate('/member/dashboard');
      toast.success('Logged in as demo member');
    } catch {
      toast.error('Demo login failed — run the seed first');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('auth.memberLogin', 'Member Login')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('auth.magicLinkDescription', 'Sign in with a magic link sent to your email')}
        </p>
      </div>

      {sent ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-center text-sm text-emerald-500">
            {devLink
              ? t('auth.magicLinkGenerated', 'Magic link generated! Click below to log in.')
              : t(
                  'auth.checkEmail',
                  'Check your email for a login link. It expires in 15 minutes.',
                )}
          </div>
          {devLink && (
            <a
              href={devLink}
              className="flex items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <ExternalLink className="h-4 w-4" />
              {t('auth.openMagicLink', 'Open Magic Link')}
            </a>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              setSent(false);
              setDevLink('');
            }}
          >
            {t('auth.sendAnotherLink', 'Send another link')}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email', 'Email')}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="pl-9"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t('auth.sending', 'Sending...') : t('auth.sendLoginLink', 'Send Login Link')}{' '}
            <ArrowRight className="h-4 w-4" />
          </Button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">{t('auth.or', 'or')}</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleDemoLogin}
            disabled={demoLoading}
          >
            <UserCircle className="mr-2 h-4 w-4" />
            {demoLoading
              ? t('auth.loggingIn', 'Logging in...')
              : t('auth.loginAsDemo', 'Login as Demo Member')}
          </Button>
        </form>
      )}

      <div className="mt-6 flex items-center justify-between text-sm">
        <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
          {t('auth.applyForMembership', 'Apply for membership')}
        </Link>
        <Link
          to="/admin/login"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('auth.adminLogin', 'Admin login')}
        </Link>
      </div>
    </AuthLayout>
  );
}
