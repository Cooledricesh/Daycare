'use client';

import { useState } from 'react';
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
import { CalendarDays, Trash2, Plus, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { useHolidays, useCreateHoliday, useDeleteHoliday } from '@/features/admin/hooks/useHolidays';
import { useToast } from '@/hooks/use-toast';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 3 }, (_, i) => CURRENT_YEAR - 1 + i);
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function MiniCalendar({
  selectedDate,
  onSelect,
  holidays,
}: {
  selectedDate: Date | undefined;
  onSelect: (date: Date) => void;
  holidays: Set<string>;
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
        {WEEKDAYS.map((day, i) => (
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
          const isHoliday = holidays.has(dateStr);
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
                inMonth && !selected && !isHoliday && 'hover:bg-gray-100 cursor-pointer',
                inMonth && dow === 0 && !selected && 'text-red-500',
                inMonth && dow === 6 && !selected && 'text-blue-500',
                today && !selected && 'font-bold ring-1 ring-gray-300',
                selected && 'bg-blue-600 text-white font-medium',
                isHoliday && !selected && 'bg-orange-100 text-orange-700 font-medium',
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>

      <div className="flex gap-3 mt-2 text-[10px] text-gray-500 justify-center">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-orange-100 border border-orange-300 inline-block" />
          등록됨
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" />
          선택
        </span>
      </div>
    </div>
  );
}

export function HolidayManageDialog() {
  const [open, setOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(String(CURRENT_YEAR));
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [reason, setReason] = useState('');

  const year = Number(selectedYear);
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const { data: holidays, isLoading } = useHolidays({
    start_date: startDate,
    end_date: endDate,
  });

  const createHoliday = useCreateHoliday();
  const deleteHoliday = useDeleteHoliday();
  const { toast } = useToast();

  const holidayDateSet = new Set((holidays || []).map((h) => h.date));

  const handleAdd = async () => {
    if (!selectedDate || !reason.trim()) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    try {
      await createHoliday.mutateAsync({ date: dateStr, reason: reason.trim() });
      toast({ title: '공휴일 등록 완료', description: `${dateStr} - ${reason.trim()}` });
      setSelectedDate(undefined);
      setReason('');
    } catch (error: any) {
      const message = error.response?.data?.message || '등록에 실패했습니다.';
      toast({ title: '공휴일 등록 실패', description: message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string, date: string) => {
    try {
      await deleteHoliday.mutateAsync(id);
      toast({ title: '공휴일 삭제 완료', description: date });
    } catch (error: any) {
      const message = error.response?.data?.message || '삭제에 실패했습니다.';
      toast({ title: '공휴일 삭제 실패', description: message, variant: 'destructive' });
    }
  };

  const getDayName = (dateStr: string): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    const names = ['일', '월', '화', '수', '목', '금', '토'];
    return names[dow];
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarDays className="mr-2 h-4 w-4" />
          공휴일 관리
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>공휴일 관리</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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

          {/* 등록된 공휴일 목록 */}
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
                ) : !holidays || holidays.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-400 py-4">
                      등록된 공휴일이 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  holidays.map((holiday) => (
                    <TableRow key={holiday.id}>
                      <TableCell className="font-mono text-sm">{holiday.date}</TableCell>
                      <TableCell>{getDayName(holiday.date)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{holiday.reason}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-700"
                          onClick={() => handleDelete(holiday.id, holiday.date)}
                          disabled={deleteHoliday.isPending}
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

          {/* 공휴일 추가 폼 */}
          <div className="border rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium">공휴일 추가</p>
            <MiniCalendar
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
              holidays={holidayDateSet}
            />
            {selectedDate && (
              <p className="text-sm text-center text-gray-600">
                {format(selectedDate, 'yyyy-MM-dd (EEEE)', { locale: ko })}
              </p>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="사유 (예: 설날, 추석)"
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
                disabled={!selectedDate || !reason.trim() || createHoliday.isPending}
                size="sm"
              >
                {createHoliday.isPending ? (
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
