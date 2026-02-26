'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, TrendingUp, TrendingDown, Calculator, Loader2 } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useStatsSummary, useDailyStats, useBatchRecalculateStats } from '@/features/admin/hooks/useStats';
import { useBatchGenerateSchedules } from '@/features/admin/hooks/useSchedule';
import { useToast } from '@/hooks/use-toast';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function StatsPage() {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');

  const { data: summary, isLoading: summaryLoading } = useStatsSummary({
    start_date: startDateStr,
    end_date: endDateStr,
  });

  const { data: dailyStats, isLoading: dailyLoading } = useDailyStats({
    start_date: startDateStr,
    end_date: endDateStr,
  });

  const batchGenerateSchedules = useBatchGenerateSchedules();
  const batchRecalculateStats = useBatchRecalculateStats();
  const { toast } = useToast();

  const handleRecalculate = async () => {
    try {
      // 1. 스케줄 먼저 생성 (통계 계산에 필요)
      await batchGenerateSchedules.mutateAsync({
        start_date: startDateStr,
        end_date: endDateStr,
      });
      // 2. 통계 재계산
      const result = await batchRecalculateStats.mutateAsync({
        start_date: startDateStr,
        end_date: endDateStr,
      });
      toast({
        title: '통계 재계산 완료',
        description: `${result.processed}일 처리됨`,
      });
    } catch (error: any) {
      toast({
        title: '통계 재계산 실패',
        description: error.response?.data?.message || '다시 시도해주세요.',
        variant: 'destructive',
      });
    }
  };

  const isRecalculating = batchGenerateSchedules.isPending || batchRecalculateStats.isPending;

  // 차트 데이터 변환
  const chartData =
    dailyStats?.map((stat) => ({
      date: format(new Date(stat.date), 'MM/dd'),
      fullDate: stat.date,
      attendanceRate: stat.attendance_rate || 0,
      consultationRate: stat.consultation_rate || 0,
      scheduled: stat.scheduled_count,
      attendance: stat.attendance_count,
      consultation: stat.consultation_count,
    })) || [];

  const isLoading = summaryLoading || dailyLoading;

  // 증감률 계산
  const attendanceChange = summary
    ? summary.average_attendance_rate - summary.previous_period.average_attendance_rate
    : 0;
  const consultationChange = summary
    ? summary.average_consultation_rate -
      summary.previous_period.average_consultation_rate
    : 0;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">통계</h1>
          <p className="text-sm text-gray-600 mt-1">
            출석률 및 진찰 참석률 통계
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(startDate, 'yyyy-MM-dd')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => date && setStartDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <span className="text-gray-500">~</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(endDate, 'yyyy-MM-dd')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date) => date && setEndDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            onClick={handleRecalculate}
            disabled={isRecalculating}
          >
            {isRecalculating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Calculator className="mr-2 h-4 w-4" />
            )}
            통계 재계산
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">
          불러오는 중...
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* 평균 출석률 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">평균 출석률</CardTitle>
                {attendanceChange !== 0 && (
                  <div
                    className={`flex items-center text-xs ${
                      attendanceChange >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {attendanceChange >= 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {Math.abs(attendanceChange).toFixed(1)}%
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary?.average_attendance_rate.toFixed(1)}%
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  전월 대비 {attendanceChange >= 0 ? '+' : ''}
                  {attendanceChange.toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            {/* 평균 진찰 참석률 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">평균 진찰 참석률</CardTitle>
                {consultationChange !== 0 && (
                  <div
                    className={`flex items-center text-xs ${
                      consultationChange >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {consultationChange >= 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {Math.abs(consultationChange).toFixed(1)}%
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary?.average_consultation_rate.toFixed(1)}%
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  전월 대비 {consultationChange >= 0 ? '+' : ''}
                  {consultationChange.toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            {/* 오늘 출석 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">오늘 출석</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary?.today.attendance} / {summary?.today.scheduled}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  진찰: {summary?.today.consultation}명
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>일별 추이</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white border rounded-lg shadow-lg p-3">
                          <p className="font-medium mb-2">{data.fullDate}</p>
                          <div className="space-y-1 text-sm">
                            <p>예정: {data.scheduled}명</p>
                            <p>출석: {data.attendance}명</p>
                            <p>진찰: {data.consultation}명</p>
                            <p className="text-blue-600">
                              출석률: {data.attendanceRate.toFixed(1)}%
                            </p>
                            <p className="text-green-600">
                              진찰 참석률: {data.consultationRate.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="attendanceRate"
                    stroke="#2563EB"
                    name="출석률 (%)"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="consultationRate"
                    stroke="#16A34A"
                    name="진찰 참석률 (%)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Detailed Table */}
          <Card>
            <CardHeader>
              <CardTitle>상세 통계</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>날짜</TableHead>
                      <TableHead className="text-right">예정</TableHead>
                      <TableHead className="text-right">출석</TableHead>
                      <TableHead className="text-right">진찰</TableHead>
                      <TableHead className="text-right">출석률</TableHead>
                      <TableHead className="text-right">진찰 참석률</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyStats?.map((stat) => (
                      <TableRow key={stat.id}>
                        <TableCell>{stat.date}</TableCell>
                        <TableCell className="text-right">
                          {stat.scheduled_count}
                        </TableCell>
                        <TableCell className="text-right">
                          {stat.attendance_count}
                        </TableCell>
                        <TableCell className="text-right">
                          {stat.consultation_count}
                        </TableCell>
                        <TableCell className="text-right">
                          {stat.attendance_rate?.toFixed(1) || '-'}%
                        </TableCell>
                        <TableCell className="text-right">
                          {stat.consultation_rate?.toFixed(1) || '-'}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
