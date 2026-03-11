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
import { Heart } from 'lucide-react';
import { CHART_COLORS, BP_THRESHOLDS } from '../constants/vitals-ranges';
import { classifyBloodPressure } from '../lib/vitals-utils';
import type { VitalsRecord } from '../backend/schema';

interface BloodPressureChartProps {
  records: VitalsRecord[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const systolic = payload.find((p: any) => p.dataKey === 'systolic')?.value;
  const diastolic = payload.find((p: any) => p.dataKey === 'diastolic')?.value;

  const classification = systolic != null && diastolic != null
    ? classifyBloodPressure(systolic, diastolic)
    : null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {systolic != null && (
        <p className="text-red-500">수축기: {systolic} mmHg</p>
      )}
      {diastolic != null && (
        <p className="text-blue-500">이완기: {diastolic} mmHg</p>
      )}
      {classification && (
        <p className={`mt-1 font-medium ${classification.color}`}>
          {classification.label}
        </p>
      )}
    </div>
  );
}

export function BloodPressureChart({ records }: BloodPressureChartProps) {
  const chartData = records
    .filter(r => r.systolic !== null || r.diastolic !== null)
    .map(r => ({
      date: format(new Date(r.date), 'MM/dd'),
      systolic: r.systolic,
      diastolic: r.diastolic,
    }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-red-400" />
            혈압 추이
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400 text-center py-8">혈압 데이터가 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <Heart className="w-4 h-4 text-red-400" />
          혈압 추이
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            {/* 참조 범위 밴드 */}
            <ReferenceArea
              y1={0}
              y2={BP_THRESHOLDS.NORMAL_SYSTOLIC}
              fill={CHART_COLORS.REFERENCE_NORMAL}
              fillOpacity={1}
            />
            <ReferenceArea
              y1={BP_THRESHOLDS.NORMAL_SYSTOLIC}
              y2={BP_THRESHOLDS.STAGE1_SYSTOLIC}
              fill={CHART_COLORS.REFERENCE_WARNING}
              fillOpacity={1}
            />
            <ReferenceArea
              y1={BP_THRESHOLDS.STAGE1_SYSTOLIC}
              y2={250}
              fill={CHART_COLORS.REFERENCE_DANGER}
              fillOpacity={1}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              stroke="#9ca3af"
            />
            <YAxis
              domain={[40, 220]}
              tick={{ fontSize: 11 }}
              stroke="#9ca3af"
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="systolic"
              stroke={CHART_COLORS.SYSTOLIC}
              strokeWidth={2}
              dot={{ r: 3, fill: CHART_COLORS.SYSTOLIC }}
              activeDot={{ r: 5 }}
              connectNulls
              name="수축기"
            />
            <Line
              type="monotone"
              dataKey="diastolic"
              stroke={CHART_COLORS.DIASTOLIC}
              strokeWidth={2}
              dot={{ r: 3, fill: CHART_COLORS.DIASTOLIC }}
              activeDot={{ r: 5 }}
              connectNulls
              name="이완기"
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 rounded bg-red-500 inline-block" />
            수축기
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 rounded bg-blue-500 inline-block" />
            이완기
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
