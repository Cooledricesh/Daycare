'use client';

import { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isSameDay,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarOff, Trash2, Plus, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useClinicClosures,
  useCreateClinicClosure,
  useDeleteClinicClosure,
} from '@/features/admin/hooks/useClinicClosures';
import { useToast } from '@/hooks/use-toast';
import { DAY_NAMES_KO, getDayName } from '@/features/shared/constants/stats';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 3 }, (_, i) => CURRENT_YEAR - 1 + i);

function MiniCalendar({
  selectedDate,
  onSelect,
  closures,
}: {
  selectedDate: Date | undefined;
  onSelect: (date: Date) => void;
  closures: Set<string>;
}) {
  const [viewDate, setViewDate] = useState(new Date());

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-sm font-medium">
          {format(viewDate, 'yyyy년 M월', { locale: ko })}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES_KO.map((day, i) => (
          <div
            key={day}
            className={cn(
              'text-center text-[11px] font-medium py-1',
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
            )}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const inMonth = isSameMonth(day, viewDate);
          const today = isToday(day);
          const selected = selectedDate && isSameDay(day, selectedDate);
          const isClosure = closures.has(dateStr);
          const dow = day.getDay();

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => inMonth && onSelect(day)}
              disabled={!inMonth}
              className={cn(
                'aspect-square flex items-center justify-center text-[12px] rounded-md transition-colors',
                !inMonth && 'text-gray-200 cursor-default',
                inMonth && !selected && !isClosure && 'hover:bg-gray-100 cursor-pointer',
                inMonth && dow === 0 && !selected && 'text-red-500',
                inMonth && dow === 6 && !selected && 'text-blue-500',
                today && !selected && 'font-bold ring-1 ring-gray-300',
                selected && 'bg-blue-600 text-white font-medium',
                isClosure && !selected && 'bg-green-100 text-green-700 font-medium',
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>

      <div className="flex gap-3 mt-2 text-[10px] text-gray-500 justify-center">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-100 border border-green-300 inline-block" />
          휴진일
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" />
          선택
        </span>
      </div>
    </div>
  );
}

export function ClinicClosureManageDialog() {
  const [open, setOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(String(CURRENT_YEAR));
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [reason, setReason] = useState('');

  const year = Number(selectedYear);
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const { data: closures, isLoading } = useClinicClosures({
    start_date: startDate,
    end_date: endDate,
  });

  const createClosure = useCreateClinicClosure();
  const deleteClosure = useDeleteClinicClosure();
  const { toast } = useToast();

  const closureDateSet = useMemo(() => new Set((closures || []).map((c) => c.date)), [closures]);

  const handleAdd = async () => {
    if (!selectedDate || !reason.trim()) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    try {
      await createClosure.mutateAsync({ date: dateStr, reason: reason.trim() });
      toast({ title: '휴진일 등록 완료', description: `${dateStr} - ${reason.trim()}` });
      setSelectedDate(undefined);
      setReason('');
    } catch (error: any) {
      const message = error.response?.data?.message || '등록에 실패했습니다.';
      toast({ title: '휴진일 등록 실패', description: message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string, date: string) => {
    try {
      await deleteClosure.mutateAsync(id);
      toast({ title: '휴진일 삭제 완료', description: date });
    } catch (error: any) {
      const message = error.response?.data?.message || '삭제에 실패했습니다.';
      toast({ title: '휴진일 삭제 실패', description: message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarOff className="mr-2 h-4 w-4" />
          휴진일 관리
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>휴진일(진찰 없는 날) 관리</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            주치의 휴가 등으로 진찰만 없는 날을 등록합니다. 휴진일에는 <strong>출석은 정상 집계</strong>되지만
            <strong> 진찰 참석률 계산에서는 제외</strong>되어 진찰 불참으로 기록되지 않습니다.
            (병원 전체가 쉬는 공휴일은 &lsquo;공휴일 관리&rsquo;를 사용하세요.)
            이미 생성된 월간 리포트는 휴진일 변경 후 <strong>재생성</strong>해야 반영됩니다.
          </p>

          {/* 연도 선택 */}
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}년
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 등록된 휴진일 목록 */}
          <div className="border rounded-lg overflow-auto max-h-[200px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 bg-white">날짜</TableHead>
                  <TableHead className="sticky top-0 bg-white">요일</TableHead>
                  <TableHead className="sticky top-0 bg-white">사유</TableHead>
                  <TableHead className="sticky top-0 bg-white w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-400 py-4">
                      불러오는 중...
                    </TableCell>
                  </TableRow>
                ) : !closures || closures.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-400 py-4">
                      등록된 휴진일이 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  closures.map((closure) => (
                    <TableRow key={closure.id}>
                      <TableCell className="font-mono text-sm">{closure.date}</TableCell>
                      <TableCell>{getDayName(closure.date)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{closure.reason}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-700"
                          onClick={() => handleDelete(closure.id, closure.date)}
                          disabled={deleteClosure.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 휴진일 추가 폼 */}
          <div className="border rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium">휴진일 추가</p>
            <MiniCalendar
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
              closures={closureDateSet}
            />
            {selectedDate && (
              <p className="text-sm text-center text-gray-600">
                {format(selectedDate, 'yyyy-MM-dd (EEEE)', { locale: ko })}
              </p>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="사유 (예: 원장 휴가, 학회 참석)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={100}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && selectedDate && reason.trim()) {
                    handleAdd();
                  }
                }}
              />
              <Button
                onClick={handleAdd}
                disabled={!selectedDate || !reason.trim() || createClosure.isPending}
                size="sm"
              >
                {createClosure.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
