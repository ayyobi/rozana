import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslations, type Locale } from '@/i18n';
import { formatCents } from '@/lib/finance/money';
import { fmtMonth } from '@/lib/utils/format';

/** Palette validée (CVD + contraste) sur la surface crème. */
export const CHART = { income: '#2475B8', expense: '#C9744A', single: '#C9744A', grid: '#E2D8CB', axis: '#6B6058' };

type T = ReturnType<typeof useTranslations>;

function TooltipBox({ active, payload, label, render }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string; render: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lift">
      {label && <p className="mb-1 font-semibold text-ink">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-ink">
          <span className="size-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
          {p.name} : <span className="font-semibold tabular-nums">{render(Number(p.value ?? 0))}</span>
        </p>
      ))}
    </div>
  );
}

/** Revenus vs dépenses par mois (barres groupées). */
export function IncomeExpenseChart({ data, locale, currency, t }: { data: Array<{ month: string; incomeCents: number; expenseCents: number }>; locale: Locale; currency: string; t: T }) {
  const short = new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR-u-ca-gregory' : 'fr-FR', { month: 'short', timeZone: 'UTC' });
  const rows = data.map((d) => ({ label: short.format(new Date(`${d.month}-01T12:00:00Z`)), full: fmtMonth(`${d.month}-01`, locale), income: d.incomeCents, expense: d.expenseCents }));
  const money = (v: number) => formatCents(v, currency, locale);
  const compact = (v: number) => new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(v / 100);
  return (
    <figure>
      <div className="h-64" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: CHART.axis, fontSize: 12 }} reversed={locale === 'fa'} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: CHART.axis, fontSize: 11 }} width={44} tickFormatter={compact} orientation={locale === 'fa' ? 'right' : 'left'} />
            <Tooltip cursor={{ fill: 'rgb(47 41 37 / 0.05)' }} content={<TooltipBox render={money} />} />
            <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: CHART.axis }} />
            <Bar dataKey="income" name={t('finance.income')} fill={CHART.income} radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name={t('finance.expense')} fill={CHART.expense} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{t('finance.overview.evolution')}</caption>
        <thead><tr><th>{t('finance.month')}</th><th>{t('finance.income')}</th><th>{t('finance.expense')}</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.full}><td>{r.full}</td><td>{money(r.income)}</td><td>{money(r.expense)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

/** Dépenses par catégorie : barres horizontales, une seule teinte, valeurs étiquetées. */
export function CategoryBars({ data, locale, currency, caption }: { data: Array<{ name: string; cents: number }>; locale: Locale; currency: string; t?: T; caption: string }) {
  const money = (v: number) => formatCents(v, currency, locale);
  const total = data.reduce((a, b) => a + b.cents, 0);
  const rows = [...data].sort((a, b) => b.cents - a.cents).slice(0, 8);
  return (
    <figure>
      <ul className="flex flex-col gap-2" aria-hidden>
        {rows.map((r) => (
          <li key={r.name} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2 text-sm">
            <span className="truncate">{r.name}</span>
            <span className="h-3 rounded-e-[4px] bg-ink/5">
              <span className="block h-3 rounded-e-[4px]" style={{ width: `${total ? Math.max(2, (r.cents / rows[0]!.cents) * 100) : 0}%`, background: CHART.single }} />
            </span>
            <span className="text-end tabular-nums text-ink-2">{money(r.cents)}</span>
          </li>
        ))}
      </ul>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>{rows.map((r) => <tr key={r.name}><td>{r.name}</td><td>{money(r.cents)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

/** Série simple (ex. tâches terminées par semaine). */
export function SimpleBars({ data, label, valueFormat }: { data: Array<{ label: string; value: number }>; label: string; valueFormat?: (v: number) => string }) {
  const fmt = valueFormat ?? ((v: number) => String(v));
  return (
    <figure>
      <div className="h-56" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: CHART.axis, fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: CHART.axis, fontSize: 11 }} width={32} allowDecimals={false} tickFormatter={fmt} />
            <Tooltip cursor={{ fill: 'rgb(47 41 37 / 0.05)' }} content={<TooltipBox render={fmt} />} />
            <Bar dataKey="value" name={label} radius={[4, 4, 0, 0]} fill={CHART.single} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>{data.map((d) => <tr key={d.label}><td>{d.label}</td><td>{fmt(d.value)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
