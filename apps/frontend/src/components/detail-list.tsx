import { cn } from '@/lib/utils';

interface DetailItem {
  label: string;
  value: React.ReactNode;
}

interface DetailListProps {
  items: DetailItem[];
  columns?: 1 | 2;
}

export function DetailList({ items, columns = 2 }: DetailListProps) {
  return (
    <div className={cn('grid gap-4', columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1')}>
      {items.map((item, i) => (
        <div key={i} className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {item.label}
          </p>
          <div className="text-sm font-medium text-foreground">
            {item.value || <span className="text-muted-foreground">—</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
