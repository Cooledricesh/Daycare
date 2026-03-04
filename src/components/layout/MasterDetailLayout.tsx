'use client';

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface MasterDetailLayoutProps {
  /** 왼쪽 패널 (환자 목록) */
  master: ReactNode;
  /** 오른쪽 패널 (상세 정보) */
  detail: ReactNode;
  /** 상세 패널이 활성화되었는지 (모바일에서 전환용) */
  hasSelection: boolean;
  /** 모바일에서 뒤로가기 시 호출 */
  onBack: () => void;
}

/**
 * 마스터-디테일 레이아웃.
 * - 데스크톱(md 이상): 좌우 분할 (w-[380px] + flex-1)
 * - 모바일(md 미만): 목록 ↔ 상세 전체 화면 전환
 */
export function MasterDetailLayout({
  master,
  detail,
  hasSelection,
  onBack,
}: MasterDetailLayoutProps) {
  return (
    <div className="flex h-full">
      {/* 마스터 패널 (환자 목록) */}
      {/* 모바일: 선택 없으면 전체 표시, 선택 있으면 숨김 */}
      {/* 데스크톱: 항상 w-[380px]로 표시 */}
      <div
        className={`
          ${hasSelection ? 'hidden' : 'flex'} 
          md:flex 
          w-full md:w-[380px] md:flex-shrink-0 
          flex-col border-r border-gray-200
        `}
      >
        {master}
      </div>

      {/* 디테일 패널 (상세 정보) */}
      {/* 모바일: 선택 있으면 전체 표시, 선택 없으면 숨김 */}
      {/* 데스크톱: 항상 표시 */}
      <div
        className={`
          ${hasSelection ? 'flex' : 'hidden'} 
          md:flex 
          flex-1 flex-col overflow-y-auto
        `}
      >
        {/* 모바일 뒤로가기 헤더 */}
        {hasSelection && (
          <div className="md:hidden flex items-center h-11 px-2 border-b border-gray-200 bg-white flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-1 text-gray-600"
            >
              <ArrowLeft className="h-4 w-4" />
              목록으로
            </Button>
          </div>
        )}
        {detail}
      </div>
    </div>
  );
}
