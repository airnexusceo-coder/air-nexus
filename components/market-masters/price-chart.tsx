'use client'

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency } from '@/lib/market-masters/format'
import type { PricePoint } from '@/lib/market-masters/types'

type PriceChartProps = {
  data: PricePoint[]
  color?: string
  height?: number
  showAxes?: boolean
}

export function PriceChart({ data, color = '#34d399', height = 48, showAxes = false }: PriceChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: showAxes ? 8 : 4, bottom: 0, left: 0 }}>
        {showAxes && <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />}
        {showAxes && <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickLine={false} axisLine={false} />}
        {showAxes && (
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={64}
            domain={['auto', 'auto']}
            tickFormatter={(value: number) => formatCurrency(value)}
          />
        )}
        {showAxes && (
          <Tooltip
            contentStyle={{ background: 'rgba(15,15,20,0.92)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, fontSize: 12, color: 'white' }}
            labelFormatter={(day) => `Day ${day}`}
            formatter={(value) => [formatCurrency(Number(value)), 'Price']}
          />
        )}
        <Line type="monotone" dataKey="price" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
