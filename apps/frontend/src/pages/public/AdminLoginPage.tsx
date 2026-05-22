import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Shield, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';

export function AdminLoginPage() {
  const [step, setStep] = useState<'credentials' | 'mfa' | 'forgot' | 'reset'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation('common');
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (data.mfaRequired) {
        setTempToken(data.tempToken);
        setStep('mfa');
      } else {
        login(data.accessToken, data.user);
        navigate(data.user.role === 'EVENT_VOLUNTEER' ? '/volunteer/check-in' : '/admin/dashboard');
      }
    } catch {
      toast.error('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/mfa/verify', { tempToken, code: mfaCode });
      login(data.accessToken, data.user);
      navigate(data.user.role === 'EVENT_VOLUNTEER' ? '/volunteer/check-in' : '/admin/dashboard');
    } catch {
      toast.error('Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      toast.success('If an account exists, a reset link has been sent');
      if (data.devToken) {
        setResetToken(data.devToken);
        setStep('reset');
      }
    } catch {
      toast.error('Request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 12) {
      toast.error('Password must be at least 12 characters');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token: resetToken, password: newPassword });
      toast.success('Password reset! You can now log in.');
      setStep('credentials');
      setNewPassword('');
      setResetToken('');
    } catch {
      toast.error('Reset failed — token may be expired');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('auth.adminLoginTitle', 'Admin Login')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {step === 'credentials' && t('auth.signInAdmin', 'Sign in to the admin dashboard')}
          {step === 'mfa' && t('auth.enterVerificationCode', 'Enter your verification code')}
          {step === 'forgot' &&
            t('auth.enterEmailReset', 'Enter your email to receive a reset link')}
          {step === 'reset' && t('auth.setNewPassword', 'Set your new password')}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {step === 'credentials' ? (
          <motion.form
            key="creds"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            onSubmit={handleLogin}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email', 'Email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.org"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password', 'Password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('auth.signingIn', 'Signing in...') : t('auth.login', 'Sign In')}{' '}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setStep('forgot')}
            >
              {t('auth.forgotPassword', 'Forgot password?')}
            </button>
          </motion.form>
        ) : step === 'forgot' ? (
          <motion.form
            key="forgot"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onSubmit={handleForgotPassword}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="reset-email">{t('auth.email', 'Email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reset-email"
                  type="email"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? t('auth.sending', 'Sending...')
                : t('auth.sendResetLink', 'Send Reset Link')}
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setStep('credentials')}
            >
              {t('auth.backToLogin', 'Back to login')}
            </button>
          </motion.form>
        ) : step === 'reset' ? (
          <motion.form
            key="reset"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onSubmit={handleResetPassword}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="new-password">{t('auth.newPassword', 'New Password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="new-password"
                  type="password"
                  className="pl-9"
                  minLength={12}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t('auth.minChars', 'Minimum 12 characters')}
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? t('auth.resetting', 'Resetting...')
                : t('auth.resetPassword', 'Reset Password')}
            </Button>
          </motion.form>
        ) : (
          <motion.form
            key="mfa"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onSubmit={handleMfa}
            className="space-y-4"
          >
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {t('auth.twoFactorAuth', 'Two-Factor Authentication')}
            </p>
            <div className="space-y-2">
              <Label htmlFor="code">{t('auth.verificationCode', 'Verification Code')}</Label>
              <Input
                id="code"
                placeholder="000000"
                className="text-center font-mono text-lg tracking-[0.3em]"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('auth.verifying', 'Verifying...') : t('auth.verify', 'Verify')}{' '}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="mt-6 text-center text-sm">
        <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">
          {t('auth.memberLoginLink', 'Member login')}
        </Link>
      </div>
    </AuthLayout>
  );
}
