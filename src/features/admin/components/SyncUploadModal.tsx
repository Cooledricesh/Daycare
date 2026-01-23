'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, FileSpreadsheet, CheckCircle, XCircle } from 'lucide-react';
import { useRunSync } from '../hooks/useSync';

interface SyncUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SyncStep = 'upload' | 'preview' | 'result';

export function SyncUploadModal({ isOpen, onClose }: SyncUploadModalProps) {
  const [step, setStep] = useState<SyncStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const runSync = useRunSync();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDryRun = async () => {
    if (!selectedFile) return;

    try {
      const result = await runSync.mutateAsync({
        file: selectedFile,
        dryRun: true,
      });
      setPreviewResult(result);
      setStep('preview');
    } catch (error) {
      console.error('Dry run failed:', error);
    }
  };

  const handleSync = async () => {
    if (!selectedFile) return;

    try {
      const result = await runSync.mutateAsync({
        file: selectedFile,
        dryRun: false,
      });
      setSyncResult(result);
      setStep('result');
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setSelectedFile(null);
    setPreviewResult(null);
    setSyncResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const renderUploadStep = () => (
    <>
      <DialogHeader>
        <DialogTitle>환자 데이터 동기화</DialogTitle>
        <DialogDescription>
          Excel 파일을 업로드하여 환자 데이터를 동기화합니다.
        </DialogDescription>
      </DialogHeader>

      <div className="py-6">
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
          <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          {selectedFile ? (
            <div>
              <p className="text-sm font-medium text-gray-900">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600">
                클릭하여 Excel 파일 선택
              </p>
              <p className="text-xs text-gray-400 mt-1">
                .xlsx 또는 .xls 파일만 지원
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            <strong>주의:</strong> B열(호실)이 3000 이상인 환자만 동기화됩니다.
            호실 매핑에 따라 담당 코디네이터가 자동 배정됩니다.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={handleClose}>
          취소
        </Button>
        <Button
          onClick={handleDryRun}
          disabled={!selectedFile || runSync.isPending}
        >
          {runSync.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          미리보기
        </Button>
      </DialogFooter>
    </>
  );

  const renderPreviewStep = () => (
    <>
      <DialogHeader>
        <DialogTitle>동기화 미리보기</DialogTitle>
        <DialogDescription>
          아래 변경사항을 확인하고 동기화를 진행하세요.
        </DialogDescription>
      </DialogHeader>

      <div className="py-4 max-h-96 overflow-y-auto">
        {/* 요약 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-700">
              {previewResult?.summary.inserted || 0}
            </p>
            <p className="text-xs text-green-600">신규 추가</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">
              {previewResult?.summary.updated || 0}
            </p>
            <p className="text-xs text-blue-600">정보 수정</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-orange-700">
              {previewResult?.summary.discharged || 0}
            </p>
            <p className="text-xs text-orange-600">퇴원 처리</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-purple-700">
              {previewResult?.summary.reactivated || 0}
            </p>
            <p className="text-xs text-purple-600">재입원</p>
          </div>
        </div>

        <div className="text-sm text-gray-500 mb-4">
          총 {previewResult?.summary.totalInSource || 0}건 중{' '}
          {previewResult?.summary.totalProcessed || 0}건 처리,{' '}
          {previewResult?.summary.unchanged || 0}건 변경 없음,{' '}
          {previewResult?.summary.skipped || 0}건 건너뜀
        </div>

        {/* 변경 내역 */}
        {previewResult?.changes?.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-gray-700">변경 내역</h4>
            <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
              {previewResult.changes.slice(0, 20).map((change: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{change.name}</span>
                    <span className="text-gray-400 ml-2 text-xs">
                      ({change.patientIdNo})
                    </span>
                  </div>
                  <Badge
                    variant={
                      change.action === 'insert'
                        ? 'default'
                        : change.action === 'discharge'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {change.action === 'insert'
                      ? '신규'
                      : change.action === 'update'
                      ? '수정'
                      : change.action === 'discharge'
                      ? '퇴원'
                      : '재입원'}
                  </Badge>
                </div>
              ))}
              {previewResult.changes.length > 20 && (
                <div className="px-3 py-2 text-sm text-gray-500 text-center">
                  외 {previewResult.changes.length - 20}건...
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => setStep('upload')}>
          뒤로
        </Button>
        <Button onClick={handleSync} disabled={runSync.isPending}>
          {runSync.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          동기화 실행
        </Button>
      </DialogFooter>
    </>
  );

  const renderResultStep = () => (
    <>
      <DialogHeader>
        <DialogTitle>
          {syncResult?.success ? (
            <span className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              동기화 완료
            </span>
          ) : (
            <span className="flex items-center gap-2 text-red-700">
              <XCircle className="h-5 w-5" />
              동기화 실패
            </span>
          )}
        </DialogTitle>
      </DialogHeader>

      <div className="py-4">
        {syncResult?.success ? (
          <>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-700">
                  {syncResult.summary.inserted}
                </p>
                <p className="text-xs text-green-600">신규 추가</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">
                  {syncResult.summary.updated}
                </p>
                <p className="text-xs text-blue-600">정보 수정</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-orange-700">
                  {syncResult.summary.discharged}
                </p>
                <p className="text-xs text-orange-600">퇴원 처리</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-purple-700">
                  {syncResult.summary.reactivated}
                </p>
                <p className="text-xs text-purple-600">재입원</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 text-center">
              동기화 ID: {syncResult.syncId}
            </p>
          </>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{syncResult?.errorMessage || '알 수 없는 오류'}</p>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button onClick={handleClose}>닫기</Button>
      </DialogFooter>
    </>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        {step === 'upload' && renderUploadStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'result' && renderResultStep()}
      </DialogContent>
    </Dialog>
  );
}
