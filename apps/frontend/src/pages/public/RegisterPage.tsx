import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import 'altcha';
import { UserPlus, Info, MapPin, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import api from '@/lib/api';

export function RegisterPage() {
  const { t } = useTranslation('member');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const altchaRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();

  const challengeUrl = (import.meta.env.VITE_API_URL || '/api/v1') + '/auth/captcha/challenge';

  useEffect(() => {
    const el = altchaRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.payload) setCaptchaToken(detail.payload);
    };
    el.addEventListener('statechange', handler);
    return () => el.removeEventListener('statechange', handler);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!captchaToken) {
      toast.warning('Please complete the captcha verification');
      return;
    }
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd.entries());
    setLoading(true);
    try {
      await api.post('/auth/register', {
        ...data,
        dlNumber: 'pending-verification',
        captchaToken,
      });
      toast.success('Application submitted! You will be notified when reviewed.');
      navigate('/login');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Registration failed';
      toast.error(message);
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('registration.title', 'Membership Application')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('registration.subtitle', 'Apply for membership online')}
        </p>
      </div>

      {/* DL disclaimer */}
      <div className="mb-5 flex gap-2.5 rounded-lg border border-border bg-muted p-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-xs leading-relaxed text-foreground/80">
          Please enter your details{' '}
          <strong className="text-foreground">
            exactly as they appear on your Driver's License
          </strong>
          . You will need to visit the office in person with a valid DL for final identity
          verification before your membership is approved.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">{t('registration.firstName', 'First Name')}</Label>
            <Input id="firstName" name="firstName" placeholder="As on DL" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">{t('registration.lastName', 'Last Name')}</Label>
            <Input id="lastName" name="lastName" placeholder="As on DL" required />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">{t('registration.email', 'Email')}</Label>
          <Input id="email" name="email" type="email" placeholder="you@example.com" required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">{t('registration.phone', 'Phone')}</Label>
          <Input id="phone" name="phone" placeholder="(555) 123-4567" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="dob">{t('registration.dob', 'Date of Birth')}</Label>
            <Input id="dob" name="dob" type="date" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gender">{t('registration.gender', 'Gender')}</Label>
            <select
              id="gender"
              name="gender"
              required
              defaultValue=""
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="" disabled>
                Select
              </option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>
        </div>

        <Separator className="my-2" />

        {/* Address section with voting info */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Address
          </p>
        </div>

        {/* Voting eligibility info */}
        <div className="flex gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="text-xs leading-relaxed text-muted-foreground">
            <p>
              Your address determines your membership type. Members in{' '}
              <strong className="text-foreground">eligible counties and zip codes</strong> qualify
              for <strong className="text-primary">Voting Member</strong> status, which allows
              participation in organizational elections and decision-making.
            </p>
            <p className="mt-1.5">
              All other members are classified as{' '}
              <strong className="text-foreground">General Members</strong> with full access to
              programs and services.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="streetAddress">{t('registration.streetAddress', 'Street Address')}</Label>
          <Input id="streetAddress" name="streetAddress" placeholder="As on DL" required />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="city">{t('registration.city', 'City')}</Label>
            <Input id="city" name="city" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">{t('registration.state', 'State')}</Label>
            <Input id="state" name="state" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zipCode">{t('registration.zipCode', 'Zip Code')}</Label>
            <Input id="zipCode" name="zipCode" required />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="county">{t('registration.county', 'County')}</Label>
            <span className="group relative">
              <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-52 -translate-x-1/2 rounded-lg border border-border bg-popover p-2 text-xs text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                County is used to determine voting eligibility. If you're unsure, check your county
                assessor's website or leave blank.
              </span>
            </span>
          </div>
          <Input id="county" name="county" placeholder="e.g., Cook, Fulton, King" />
        </div>

        <div className="flex justify-center">
          <altcha-widget ref={altchaRef} challengeurl={challengeUrl} hidefooter />
        </div>

        <Button type="submit" className="w-full" disabled={loading || !captchaToken}>
          <UserPlus className="h-4 w-4" />
          {loading
            ? t('registration.submitting', 'Submitting...')
            : t('registration.submitApplication', 'Submit Application')}
        </Button>
      </form>

      {/* Footer info */}
      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground/70">
        {t(
          'registration.privacyNotice',
          'By submitting this application, you agree to provide accurate information. Your personal data is encrypted and stored securely.',
        )}
      </p>

      <div className="mt-4 flex items-center justify-between text-sm">
        <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">
          {t('registration.alreadyMember', 'Already a member?')}
        </Link>
        <Link
          to="/admin/login"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('registration.adminLogin', 'Admin login')}
        </Link>
      </div>
    </AuthLayout>
  );
}
