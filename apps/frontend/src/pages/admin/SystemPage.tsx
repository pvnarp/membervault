import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Activity, Database, Server, Cpu, WifiOff, RefreshCw, Shield } from 'lucide-react';
import { api } from '../../lib/api';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/loading-state';

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'healthy'
      ? 'bg-emerald-500'
      : status === 'warning'
        ? 'bg-amber-500'
        : status === 'degraded'
          ? 'bg-amber-500'
          : 'bg-red-500';
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color} animate-pulse`} />;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function SystemPage() {
  const { t } = useTranslation('admin');
  const { data, isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => api.get('/health/ready').then((r) => r.data),
    refetchInterval: 30_000, // Auto-refresh every 30 seconds
  });

  if (isLoading) return <LoadingState text="Checking system health..." />;

  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '';

  return (
    <div>
      <PageHeader
        title={t('system.title', 'System Health')}
        description={t('system.description', 'Infrastructure status and diagnostics')}
        actions={
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-muted-foreground">
                {t('system.lastCheck', 'Last check')}: {lastRefresh}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              {t('system.refresh', 'Refresh')}
            </Button>
          </div>
        }
      />

      {isError ? (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-4 p-6">
            <WifiOff className="h-8 w-8 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">
                {t('system.unreachable', 'Unable to reach health endpoint')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('system.unreachableDescription', 'The backend API may be down or unreachable.')}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Overall Status Banner */}
          <Card
            className={`mb-6 ${data.status === 'ok' ? 'border-emerald-500/30' : 'border-amber-500/30'}`}
          >
            <CardContent className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                    data.status === 'ok'
                      ? 'bg-emerald-500/15 text-emerald-500'
                      : 'bg-amber-500/15 text-amber-500'
                  }`}
                >
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">
                      {data.status === 'ok'
                        ? t('system.allOperational', 'All Systems Operational')
                        : t('system.degraded', 'Degraded Performance')}
                    </h2>
                    <StatusDot status={data.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    v{data.version} &middot; Node {data.nodeVersion} &middot; {data.environment}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tracking-tight">{formatUptime(data.uptime)}</p>
                <p className="text-xs text-muted-foreground">{t('system.uptime', 'Uptime')}</p>
              </div>
            </CardContent>
          </Card>

          {/* Service Cards */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Database */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Database className="h-4 w-4 text-primary" />
                  PostgreSQL
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusDot status={data.checks.database?.status || 'unhealthy'} />
                    <Badge
                      variant="outline"
                      className={
                        data.checks.database?.status === 'healthy'
                          ? 'border-emerald-500/30 text-emerald-500'
                          : 'border-red-500/30 text-red-500'
                      }
                    >
                      {data.checks.database?.status || 'unknown'}
                    </Badge>
                  </div>
                  {data.checks.database?.latencyMs != null && (
                    <span className="text-sm font-mono text-muted-foreground">
                      {data.checks.database.latencyMs}ms
                    </span>
                  )}
                </div>
                {data.checks.database?.error && (
                  <p className="mt-2 text-xs text-destructive">{data.checks.database.error}</p>
                )}
              </CardContent>
            </Card>

            {/* Redis */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Server className="h-4 w-4 text-violet-500" />
                  Redis
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.checks.redis ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusDot status={data.checks.redis.status} />
                      <Badge
                        variant="outline"
                        className={
                          data.checks.redis.status === 'healthy'
                            ? 'border-emerald-500/30 text-emerald-500'
                            : 'border-amber-500/30 text-amber-500'
                        }
                      >
                        {data.checks.redis.status}
                      </Badge>
                    </div>
                    {data.checks.redis.latencyMs != null && (
                      <span className="text-sm font-mono text-muted-foreground">
                        {data.checks.redis.latencyMs}ms
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <WifiOff className="h-3.5 w-3.5" />
                    {t(
                      'system.redisNotConfigured',
                      'Not configured (using in-memory rate limiting)',
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Memory */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Cpu className="h-4 w-4 text-amber-500" />
                  {t('system.memory', 'Memory')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusDot status={data.checks.memory?.status || 'healthy'} />
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-500">
                      {data.checks.memory?.status || 'healthy'}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {t('system.heapUsed', 'Heap Used')}
                    </span>
                    <span className="font-mono">{data.memory.heapUsedMB} MB</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-primary transition-all"
                      style={{
                        width: `${Math.min(100, (data.memory.heapUsedMB / data.memory.heapTotalMB) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {t('system.heapTotal', 'Heap Total')}
                    </span>
                    <span className="font-mono">{data.memory.heapTotalMB} MB</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">RSS</span>
                    <span className="font-mono">{data.memory.rssMB} MB</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Security Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Shield className="h-4 w-4 text-primary" />
                {t('system.securityConfiguration', 'Security Configuration')}
              </CardTitle>
              <CardDescription>
                {t('system.currentSecuritySettings', 'Current security settings')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: t('system.piiEncryption', 'PII Encryption'),
                    value: 'AES-256-GCM',
                    ok: true,
                  },
                  {
                    label: t('system.passwordHashing', 'Password Hashing'),
                    value: 'Argon2id',
                    ok: true,
                  },
                  {
                    label: t('system.rateLimiting', 'Rate Limiting'),
                    value: data.checks.redis ? 'Redis-backed' : 'In-memory',
                    ok: true,
                  },
                  {
                    label: 'TLS',
                    value: data.environment === 'production' ? "Let's Encrypt" : 'Self-signed',
                    ok: true,
                  },
                  { label: 'CAPTCHA', value: 'Altcha (PoW)', ok: true },
                  {
                    label: t('system.jwtExpiry', 'JWT Expiry'),
                    value: '4h access / 7d refresh',
                    ok: true,
                  },
                  {
                    label: t('system.multiTenant', 'Multi-tenant'),
                    value: 'Org-scoped queries',
                    ok: true,
                  },
                  {
                    label: t('system.auditTrail', 'Audit Trail'),
                    value: 'All mutations logged',
                    ok: true,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start gap-2 rounded-lg border border-border p-3"
                  >
                    <StatusDot status="healthy" />
                    <div>
                      <p className="text-xs font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
