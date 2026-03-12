'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface KeyboardShortcutHelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUTS = [
  { keys: ['/', 'Ctrl+F'], description: '환자 검색' },
  { keys: ['↑↓ (검색 중)'], description: '환자 목록 탐색' },
  { keys: ['Enter (검색 중)'], description: '선택된 환자 확정' },
  { keys: ['Escape'], description: '검색 해제 / 입력 탈출' },
  { keys: ['↑'], description: '이전 환자' },
  { keys: ['↓'], description: '다음 환자' },
  { keys: ['1', '2', '3'], description: '필터 탭 전환' },
  { keys: ['Ctrl+S'], description: '저장' },
  { keys: ['Ctrl+D'], description: '진찰 체크 (의사)' },
  { keys: ['?'], description: '이 도움말' },
] as const;

export function KeyboardShortcutHelpModal({ open, onOpenChange }: KeyboardShortcutHelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>키보드 단축키</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {SHORTCUTS.map((shortcut, idx) => (
            <div key={idx} className="flex items-center justify-between py-2 border-b last:border-b-0">
              <span className="text-sm text-gray-700">{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, kidx) => (
                  <span key={kidx} className="flex items-center gap-1">
                    {kidx > 0 && <span className="text-xs text-gray-400">또는</span>}
                    <kbd className="px-2 py-0.5 text-xs font-mono bg-gray-100 border border-gray-200 rounded">
                      {key}
                    </kbd>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
