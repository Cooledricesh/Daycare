'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Edit, Calendar } from 'lucide-react';
import { useMySchedulePatterns } from '@/features/staff/hooks/useSchedulePatterns';
import { useScheduleStore } from '@/features/staff/stores/useScheduleStore';
import { SchedulePatternModal } from '@/features/staff/components/SchedulePatternModal';

const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
const dayColors: Record<number, string> = {
  0: 'bg-red-100 text-red-700 border-red-200',
  1: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  2: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  3: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  4: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  5: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  6: 'bg-blue-100 text-blue-700 border-blue-200',
};

export default function StaffSchedulePage() {
  const { data: patterns, isLoading } = useMySchedulePatterns();
  const { openModal } = useScheduleStore();

  const patientsWithSchedule = patterns?.filter((p) => p.schedule_days.length > 0).length || 0;
  const patientsWithoutSchedule = (patterns?.length || 0) - patientsWithSchedule;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">출석 일정 관리</h1>
        <p className="text-gray-600">
          담당 환자들의 기본 출석 요일을 설정합니다
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{patterns?.length || 0}</div>
                <div className="text-sm text-gray-600">전체 환자</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{patientsWithSchedule}</div>
                <div className="text-sm text-gray-600">일정 설정됨</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{patientsWithoutSchedule}</div>
                <div className="text-sm text-gray-600">일정 미설정</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>담당 환자 출석 일정</CardTitle>
          <CardDescription>
            환자별 출석 요일을 설정하면 해당 요일에 자동으로 출석 예정자로 등록됩니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">불러오는 중...</div>
          ) : patterns && patterns.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>환자명</TableHead>
                  <TableHead>출석 요일</TableHead>
                  <TableHead className="w-[100px]">설정</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patterns.map((pattern) => (
                  <TableRow key={pattern.patient_id}>
                    <TableCell className="font-medium">{pattern.patient_name}</TableCell>
                    <TableCell>
                      {pattern.schedule_days.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {pattern.schedule_days.map((day) => (
                            <Badge
                              key={day}
                              variant="outline"
                              className={dayColors[day]}
                            >
                              {dayNames[day]}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">미설정</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openModal(pattern.patient_id, pattern.patient_name)}
                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        수정
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-gray-500">
              담당 환자가 없습니다
            </div>
          )}
        </CardContent>
      </Card>

      <SchedulePatternModal />
    </div>
  );
}
