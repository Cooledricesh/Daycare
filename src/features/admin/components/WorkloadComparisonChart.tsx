'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { CoordinatorWorkloadItem } from '@/features/admin/backend/schema';

interface WorkloadComparisonChartProps {
  coordinators: CoordinatorWorkloadItem[];
}

const CHART_HEIGHT_PER_COORDINATOR = 60;
const MIN_CHART_HEIGHT = 200;

export function WorkloadComparisonChart({ coordinators }: WorkloadComparisonChartProps) {
  const [isOpen, setIsOpen] = useState(false);

  const chartData = coordinators.map((c) => ({
    name: c.coordinator_name,
    등록환자수: c.patient_count,
    일평균출석: c.avg_daily_attendance,
  }));

  const chartHeight = Math.max(
    MIN_CHART_HEIGHT,
    coordinators.length * CHART_HEIGHT_PER_COORDINATOR,
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      <Button
        variant="ghost"
        className="w-full flex items-center justify-between px-4 py-3 h-auto text-left hover:bg-gray-50"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="font-medium text-sm">등록 vs 실질 업무량 비교</span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </Button>

      {isOpen && (
        <div className="p-4 border-t">
          {coordinators.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              데이터가 없습니다.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                barGap={2}
                barCategoryGap="30%"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  fontSize={12}
                  tickFormatter={(v: number) => `${v}`}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={70}
                  fontSize={12}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload as typeof chartData[number];
                    return (
                      <div className="bg-white border rounded-lg shadow-lg p-3">
                        <p className="font-medium mb-2">{d.name}</p>
                        <div className="space-y-1 text-sm">
                          <p style={{ color: '#c4b5fd' }}>
                            등록 환자 수: {d.등록환자수}명
                          </p>
                          <p style={{ color: '#2563eb' }}>
                            일평균 출석 수: {d.일평균출석.toFixed(1)}명
                          </p>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend />
                <Bar
                  dataKey="등록환자수"
                  fill="#c4b5fd"
                  name="등록 환자 수"
                  radius={[0, 2, 2, 0]}
                />
                <Bar
                  dataKey="일평균출석"
                  fill="#2563eb"
                  name="일평균 출석 수"
                  radius={[0, 2, 2, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}
