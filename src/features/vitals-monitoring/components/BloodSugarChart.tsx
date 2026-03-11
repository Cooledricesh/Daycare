'use client';

import { format } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Droplets } from 'lucide-react';
import { CHART_COLORS, BS_THRESHOLDS } from '../constants/vitals-ranges';
import { classifyBloodSugar } from '../lib/vitals-utils';
import type { VitalsRecord } from '../backend/schema';

interface BloodSugarChartProps {
  records: VitalsRecord[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const value = payload[0]?.value;
  const classification = value != null ? classifyBloodSugar(value) : null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {value != null && (
        <p className="text-purple-600">혈당: {value} mg/dL</p>
      )}
      {classification && (
        <p className={`mt-1 font-medium ${classification.color}`}>
          {classification.label}
        </p>
      )}
    </div>
  );
}

export function BloodSugarChart({ records }: BloodSugarChartProps) {
  const chartData = records
    .filter(r => r.blood_sugar !== null)
    .map(r => ({
      date: format(new Date(r.date), 'MM/dd'),
      blood_sugar: r.blood_sugar,
    }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Droplets className="w-4 h-4 text-purple-400" />
            혈당 추이
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400 text-center py-8">혈당 데이터가 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <Droplets className="w-4 h-4 text-purple-400" />
          혈당 추이
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            {/* 참조 범위 밴드 */}
            <ReferenceArea
              y1={0}
              y2={BS_THRESHOLDS.LOW}
              fill="rgba(59, 130, 246, 0.06)"
              fillOpacity={1}
            />
            <ReferenceArea
              y1={BS_THRESHOLDS.LOW}
              y2={BS_THRESHOLDS.NORMAL}
              fill={CHART_COLORS.REFERENCE_NORMAL}
              fillOpacity={1}
            />
            <ReferenceArea
              y1={BS_THRESHOLDS.NORMAL}
              y2={BS_THRESHOLDS.PREDIABETES}
              fill={CHART_COLORS.REFERENCE_WARNING}
              fillOpacity={1}
            />
            <ReferenceArea
              y1={BS_THRESHOLDS.PREDIABETES}
              y2={400}
              fill={CHART_COLORS.REFERENCE_DANGER}
              fillOpacity={1}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              stroke="#9ca3af"
            />
            <YAxis
              domain={[30, 300]}
              tick={{ fontSize: 11 }}
              stroke="#9ca3af"
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="blood_sugar"
              stroke={CHART_COLORS.BLOOD_SUGAR}
              strokeWidth={2}
              dot={{ r: 3, fill: CHART_COLORS.BLOOD_SUGAR }}
              activeDot={{ r: 5 }}
              connectNulls
              name="혈당"
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 rounded bg-purple-500 inline-block" />
            혈당
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
