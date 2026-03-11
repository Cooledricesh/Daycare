'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Heart, Droplets, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { classifyBloodPressure, classifyBloodSugar } from '../lib/vitals-utils';
import type { VitalsStats, VitalsRecord } from '../backend/schema';

interface VitalsSummaryCardsProps {
  stats: VitalsStats;
  records: VitalsRecord[];
  latestBPStatus: string | null;
  latestBSStatus: string | null;
}

function getTrendIcon(records: VitalsRecord[], field: 'systolic' | 'blood_sugar') {
  const values = records
    .map(r => r[field])
    .filter((v): v is number => v !== null);

  if (values.length < 2) return <Minus className="w-3.5 h-3.5 text-gray-400" />;

  const recent = values.slice(-3);
  const earlier = values.slice(0, Math.max(1, values.length - 3));
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
  const diff = recentAvg - earlierAvg;

  if (Math.abs(diff) < 3) return <Minus className="w-3.5 h-3.5 text-gray-400" />;
  if (diff > 0) return <TrendingUp className="w-3.5 h-3.5 text-red-500" />;
  return <TrendingDown className="w-3.5 h-3.5 text-blue-500" />;
}

export function VitalsSummaryCards({ stats, records, latestBPStatus, latestBSStatus }: VitalsSummaryCardsProps) {
  const latestRecord = records.length > 0 ? records[records.length - 1] : null;
  const hasBP = latestRecord?.systolic !== null && latestRecord?.diastolic !== null;
  const hasBS = latestRecord?.blood_sugar !== null;

  const bpClass = hasBP
    ? classifyBloodPressure(latestRecord!.systolic!, latestRecord!.diastolic!)
    : null;
  const bsClass = hasBS
    ? classifyBloodSugar(latestRecord!.blood_sugar!)
    : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* 최근 혈압 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600">
              <Heart className="w-4 h-4 text-red-400" />
              최근 혈압
            </div>
            {getTrendIcon(records, 'systolic')}
          </div>
          {hasBP ? (
            <>
              <p className="text-2xl font-bold">
                {latestRecord!.systolic}/{latestRecord!.diastolic}
                <span className="text-xs font-normal text-gray-400 ml-1">mmHg</span>
              </p>
              <Badge variant="secondary" className={cn('mt-1 text-xs', bpClass?.bgColor, bpClass?.color)}>
                {bpClass?.label}
              </Badge>
            </>
          ) : (
            <p className="text-sm text-gray-400">데이터 없음</p>
          )}
        </CardContent>
      </Card>

      {/* 최근 혈당 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600">
              <Droplets className="w-4 h-4 text-purple-400" />
              최근 혈당
            </div>
            {getTrendIcon(records, 'blood_sugar')}
          </div>
          {hasBS ? (
            <>
              <p className="text-2xl font-bold">
                {latestRecord!.blood_sugar}
                <span className="text-xs font-normal text-gray-400 ml-1">mg/dL</span>
              </p>
              <Badge variant="secondary" className={cn('mt-1 text-xs', bsClass?.bgColor, bsClass?.color)}>
                {bsClass?.label}
              </Badge>
            </>
          ) : (
            <p className="text-sm text-gray-400">데이터 없음</p>
          )}
        </CardContent>
      </Card>

      {/* 기간 통계 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-2">
            <BarChart3 className="w-4 h-4 text-gray-400" />
            기간 통계
          </div>
          <div className="space-y-1.5 text-xs">
            {stats.systolic && (
              <div className="flex justify-between">
                <span className="text-gray-500">수축기</span>
                <span className="font-medium">
                  {stats.systolic.min}~{stats.systolic.max}
                  <span className="text-gray-400 ml-1">(평균 {stats.systolic.avg})</span>
                </span>
              </div>
            )}
            {stats.diastolic && (
              <div className="flex justify-between">
                <span className="text-gray-500">이완기</span>
                <span className="font-medium">
                  {stats.diastolic.min}~{stats.diastolic.max}
                  <span className="text-gray-400 ml-1">(평균 {stats.diastolic.avg})</span>
                </span>
              </div>
            )}
            {stats.blood_sugar && (
              <div className="flex justify-between">
                <span className="text-gray-500">혈당</span>
                <span className="font-medium">
                  {stats.blood_sugar.min}~{stats.blood_sugar.max}
                  <span className="text-gray-400 ml-1">(평균 {stats.blood_sugar.avg})</span>
                </span>
              </div>
            )}
            {!stats.systolic && !stats.diastolic && !stats.blood_sugar && (
              <p className="text-gray-400">데이터 없음</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
