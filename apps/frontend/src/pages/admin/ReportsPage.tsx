import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Users, Vote, MapPin } from 'lucide-react';
import { api } from '../../lib/api';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/loading-state';
import { useTheme } from '@/components/theme-provider';

const PALETTE = {
  indigo: '#6366f1',
  emerald: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  violet: '#8b5cf6',
  cyan: '#06b6d4',
  rose: '#f43f5e',
};

const STATUS_COLORS: Record<string, string> = {
  APPROVED: PALETTE.emerald,
  PENDING: PALETTE.amber,
  REJECTED: PALETTE.red,
  SUSPENDED: PALETTE.rose,
  INACTIVE: '#6b7280',
};

const TYPE_COLORS: Record<string, string> = {
  VOTING: PALETTE.indigo,
  GENERAL: PALETTE.cyan,
};

const TIME_RANGES = [
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: '2y', label: '2Y' },
  { key: 'all', label: 'All' },
] as const;

// Custom tick renderer — uses inline style to guarantee fill color
// Recharts overrides the fill= attribute, but style={{fill}} always wins
function makeTick(color: string, size = 11) {
  return ({ x, y, payload, textAnchor, verticalAnchor }: any) => (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor || 'middle'}
      dominantBaseline={verticalAnchor === 'start' ? 'hanging' : 'auto'}
      style={{ fill: color, fontSize: size }}
    >
      {payload?.value}
    </text>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-xl">
      {label && <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color || entry.fill }}
          />
          <span className="text-popover-foreground">
            {entry.name}: <span className="font-semibold">{entry.value}</span>
            {entry.dataKey === 'attendance_pct' ? '%' : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

function makeDonutLabel(color: string) {
  return ({ cx, cy, midAngle, outerRadius, name, value }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 28;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    // Use style={{fill}} instead of fill= attribute — style has higher CSS specificity
    // and won't be overridden by Recharts parent <g> fill attributes
    return (
      <text
        x={x}
        y={y}
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        style={{ fill: color, fontSize: 13, fontWeight: 600 }}
      >
        {name} ({value})
      </text>
    );
  };
}

export default function ReportsPage() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const [range, setRange] = useState('1y');
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const tickColor = isDark ? '#d1d5db' : '#4b5563'; // gray-300 / gray-600
  const fgColor = isDark ? '#f3f4f6' : '#111827'; // gray-100 / gray-900

  const { data: memberStats, isLoading: loadingMembers } = useQuery({
    queryKey: ['reports', 'membership-stats', range],
    queryFn: () => api.get(`/reports/membership-stats?range=${range}`).then((r) => r.data),
  });

  if (loadingMembers) return <LoadingState text="Loading reports..." />;

  const totalMembers = memberStats?.byStatus?.reduce((s: number, r: any) => s + r.count, 0) ?? 0;
  const votingCount = memberStats?.byType?.find((t: any) => t.memberType === 'VOTING')?.count ?? 0;

  const cityData = (memberStats?.byCity || []).map((c: any) => ({ ...c, count: Number(c.count) }));

  return (
    <div>
      <PageHeader
        title={t('reports.title', 'Reports & Analytics')}
        description={t('reports.description', 'Membership and voting insights')}
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-0.5">
            {TIME_RANGES.map((r) => (
              <Button
                key={r.key}
                variant={range === r.key ? 'default' : 'ghost'}
                size="sm"
                className={`h-7 px-2.5 text-xs ${range === r.key ? '' : 'text-muted-foreground'}`}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        }
      />

      {/* KPI Summary */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: t('reports.totalMembers', 'Total Members'),
            value: totalMembers,
            icon: Users,
            color: 'text-primary bg-primary/15',
          },
          {
            label: t('reports.votingMembers', 'Voting Members'),
            value: votingCount,
            icon: Vote,
            color: 'text-emerald-500 dark:text-emerald-400 bg-emerald-500/10',
          },
        ].map((kpi) => (
          <Card
            key={kpi.label}
            className={`transition-all duration-200 hover:-translate-y-0.5 hover:glow-sm ${'link' in kpi && kpi.link ? 'cursor-pointer' : ''}`}
            onClick={() => {
              if ('link' in kpi && kpi.link) navigate(kpi.link);
            }}
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${kpi.color}`}>
                <kpi.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {kpi.label}
                </p>
                <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Membership Growth */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              {t('reports.membershipGrowth', 'Membership Growth')}
            </CardTitle>
            <CardDescription>
              {t('reports.membershipGrowthDescription', 'New applications per month')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={memberStats?.membersByMonth || []}>
                <defs>
                  <linearGradient id="gradIndigo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PALETTE.indigo} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={PALETTE.indigo} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeOpacity={0.08} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={makeTick(tickColor)}
                  interval="preserveStartEnd"
                />
                <YAxis axisLine={false} tickLine={false} tick={makeTick(tickColor)} width={32} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Applications"
                  stroke={PALETTE.indigo}
                  strokeWidth={2.5}
                  fill="url(#gradIndigo)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              {t('reports.statusBreakdown', 'Status Breakdown')}
            </CardTitle>
            <CardDescription>
              {t('reports.statusBreakdownDescription', 'Current membership status')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={memberStats?.byStatus || []}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  strokeWidth={0}
                  label={makeDonutLabel(fgColor)}
                >
                  {(memberStats?.byStatus || []).map((entry: any, i: number) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.status] || PALETTE.violet} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Members by City */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              {t('reports.membersByCity', 'Members by City')}
            </CardTitle>
            <CardDescription>
              {t('reports.membersByCityDescription', 'Geographic distribution of approved members')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cityData.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                <MapPin className="mr-2 h-4 w-4" />{' '}
                {t('reports.noLocationData', 'No location data available')}
              </div>
            ) : (
              <div>
                <ResponsiveContainer width="100%" height={Math.max(300, cityData.length * 36)}>
                  <BarChart
                    data={cityData}
                    layout="vertical"
                    barCategoryGap="20%"
                    onClick={(data: any) => {
                      if (data?.activeLabel) navigate(`/admin/members?search=${data.activeLabel}`);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <defs>
                      <linearGradient id="gradViolet" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={PALETTE.violet} stopOpacity={0.7} />
                        <stop offset="100%" stopColor={PALETTE.indigo} stopOpacity={0.9} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid horizontal={false} strokeOpacity={0.08} />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={makeTick(tickColor)}
                    />
                    <YAxis
                      dataKey="city"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      width={90}
                      tick={makeTick(fgColor, 12)}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar
                      dataKey="count"
                      name="Members"
                      fill="url(#gradViolet)"
                      radius={[0, 6, 6, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-2 text-center text-[10px] text-muted-foreground/60">
                  {t('reports.clickCityHint', 'Click a city to view its members')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Member Type Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              {t('reports.memberTypes', 'Member Types')}
            </CardTitle>
            <CardDescription>
              {t('reports.memberTypesDescription', 'Voting vs General split')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={memberStats?.byType || []}
                  dataKey="count"
                  nameKey="memberType"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  strokeWidth={0}
                  label={makeDonutLabel(fgColor)}
                >
                  {(memberStats?.byType || []).map((entry: any, i: number) => (
                    <Cell key={i} fill={TYPE_COLORS[entry.memberType] || PALETTE.violet} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  formatter={(value: string) => (
                    <span className="text-xs text-muted-foreground">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
