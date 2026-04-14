'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Upload, Eye, RefreshCw } from 'lucide-react';
import { useSyncLogs, useSyncLogById } from '@/features/admin/hooks/useSync';
import { useSyncStore } from '@/features/admin/stores/useSyncStore';
import { SyncUploadModal } from '@/features/admin/components/SyncUploadModal';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

const statusLabels: Record<string, { label: string; color: string }> = {
  running: { label: '진행 중', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: '완료', color: 'bg-green-100 text-green-700' },
  failed: { label: '실패', color: 'bg-red-100 text-red-700' },
};

const sourceLabels: Record<string, string> = {
  google_sheets: 'Google Sheets',
  excel_upload: 'Excel 업로드',
};

export default function SyncPage() {
  const {
    page,
    limit,
    selectedLogId,
    isDetailModalOpen,
    isUploadModalOpen,
    setPage,
    openDetailModal,
    closeDetailModal,
    openUploadModal,
    closeUploadModal,
  } = useSyncStore();

  const { data, isLoading, refetch } = useSyncLogs({ page, limit });
  const { data: selectedLog } = useSyncLogById(selectedLogId);

  const logs = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">데이터 동기화</h1>
          <p className="text-sm text-gray-600 mt-1">
            Excel 파일을 업로드하여 환자 데이터를 동기화합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            새로고침
          </Button>
          <Button onClick={openUploadModal}>
            <Upload className="mr-2 h-4 w-4" />
            동기화 실행
          </Button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-blue-900 mb-2">동기화 안내</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>
            - Excel 파일의 B열(호실)이 3000 이상인 환자만 낮병원 환자로
            인식됩니다.
          </li>
          <li>
            - 병록번호(C열/IDNO)를 기준으로 신규/수정/퇴원을 판단합니다.
          </li>
          <li>
            - 동기화 전 &quot;미리보기&quot;로 변경 사항을 확인할 수 있습니다.
          </li>
          <li>
            - 호실 매핑 설정에 따라 담당 코디네이터가 자동 배정됩니다.
          </li>
        </ul>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="font-semibold">동기화 이력</h2>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">불러오는 중...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>실행 시간</TableHead>
                <TableHead>소스</TableHead>
                <TableHead>실행자</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-center">처리</TableHead>
                <TableHead className="text-center">추가</TableHead>
                <TableHead className="text-center">수정</TableHead>
                <TableHead className="text-center">퇴원</TableHead>
                <TableHead className="w-[80px]">상세</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-gray-500 py-8"
                  >
                    동기화 이력이 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm">{formatDate(log.started_at)}</p>
                        <p className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(log.started_at), {
                            addSuffix: true,
                            locale: ko,
                          })}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{sourceLabels[log.source] || log.source}</TableCell>
                    <TableCell>{log.triggered_by}</TableCell>
                    <TableCell>
                      <Badge className={statusLabels[log.status]?.color || ''}>
                        {statusLabels[log.status]?.label || log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {log.total_processed}
                    </TableCell>
                    <TableCell className="text-center text-green-600">
                      +{log.inserted}
                    </TableCell>
                    <TableCell className="text-center text-blue-600">
                      {log.updated}
                    </TableCell>
                    <TableCell className="text-center text-orange-600">
                      {log.discharged}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDetailModal(log.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              이전
            </Button>
            <span className="text-sm text-gray-600">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
            >
              다음
            </Button>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <SyncUploadModal isOpen={isUploadModalOpen} onClose={closeUploadModal} />

      {/* Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={closeDetailModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>동기화 상세</DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">실행 시간:</span>{' '}
                  {formatDate(selectedLog.started_at)}
                </div>
                <div>
                  <span className="text-gray-500">완료 시간:</span>{' '}
                  {selectedLog.completed_at
                    ? formatDate(selectedLog.completed_at)
                    : '-'}
                </div>
                <div>
                  <span className="text-gray-500">소스:</span>{' '}
                  {sourceLabels[selectedLog.source] || selectedLog.source}
                </div>
                <div>
                  <span className="text-gray-500">실행자:</span>{' '}
                  {selectedLog.triggered_by}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold">
                    {selectedLog.total_in_source}
                  </p>
                  <p className="text-xs text-gray-500">소스 총 건수</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-green-700">
                    {selectedLog.inserted}
                  </p>
                  <p className="text-xs text-green-600">신규</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-blue-700">
                    {selectedLog.updated}
                  </p>
                  <p className="text-xs text-blue-600">수정</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-orange-700">
                    {selectedLog.discharged}
                  </p>
                  <p className="text-xs text-orange-600">퇴원</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-purple-700">
                    {selectedLog.reactivated}
                  </p>
                  <p className="text-xs text-purple-600">재입원</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold">
                    {selectedLog.unchanged}
                  </p>
                  <p className="text-xs text-gray-500">변경 없음</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold">
                    {selectedLog.skipped}
                  </p>
                  <p className="text-xs text-gray-500">건너뜀</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold">
                    {selectedLog.total_processed}
                  </p>
                  <p className="text-xs text-gray-500">처리됨</p>
                </div>
              </div>

              {/* Error Message */}
              {selectedLog.error_message && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800 font-medium">오류 메시지</p>
                  <p className="text-sm text-red-700 mt-1">
                    {selectedLog.error_message}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
