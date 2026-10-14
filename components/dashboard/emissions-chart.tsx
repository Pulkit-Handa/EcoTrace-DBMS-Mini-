'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatNumber } from '@/lib/format';
import type { ScopeBreakdownRow } from '@/lib/types';

export function EmissionsChart({ data }: { data: ScopeBreakdownRow[] }) {
  return (
    <div className="h-[318px] w-full" aria-label="Emissions by department and scope">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 12, right: 8, left: -12, bottom: 0 }}
          barGap={3}
        >
          <CartesianGrid
            strokeDasharray="3 4"
            vertical={false}
            stroke="#e7ede9"
          />
          <XAxis
            dataKey="department"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: '#688176' }}
            dy={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: '#8fa79b' }}
            tickFormatter={(value: number) => formatNumber(value)}
            width={52}
          />
          <Tooltip
            cursor={{ fill: 'rgba(5, 150, 105, 0.045)' }}
            contentStyle={{
              borderRadius: 14,
              border: '1px solid #dce5e0',
              boxShadow: '0 16px 40px -24px rgba(16,24,21,0.45)',
              fontSize: 12,
              padding: '10px 12px',
            }}
            labelStyle={{
              color: '#101815',
              fontWeight: 600,
              marginBottom: 6,
            }}
            formatter={(value, name) => [
              `${formatNumber(Number(value))} kg`,
              String(name),
            ]}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={34}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: '#52675e' }}
          />
          <Bar
            dataKey="scope1"
            name="Scope 1"
            stackId="emissions"
            fill="#047857"
            maxBarSize={46}
          />
          <Bar
            dataKey="scope2"
            name="Scope 2"
            stackId="emissions"
            fill="#34d399"
            maxBarSize={46}
          />
          <Bar
            dataKey="scope3"
            name="Scope 3"
            stackId="emissions"
            fill="#f59e0b"
            maxBarSize={46}
            radius={[4, 4, 0, 0]}
          />
          <Line
            type="monotone"
            dataKey="cap"
            name="Annual cap"
            stroke="#1f2a26"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
            activeDot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
