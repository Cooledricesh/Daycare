'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUpdateActionItems } from '../hooks/useUpdateActionItems';
import { extractApiErrorMessage } from '@/lib/remote/api-client';
import { ACTION_ITEMS_MAX_LENGTH } from '../constants/thresholds';

interface ActionItemsEditorProps {
  year: number;
  month: number;
  initialValue: string;
}

export function ActionItemsEditor({ year, month, initialValue }: ActionItemsEditorProps) {
  const [value, setValue] = useState(initialValue);
  const { toast } = useToast();
  const updateActionItems = useUpdateActionItems();

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const isDirty = value !== initialValue;

  const handleSave = async () => {
    try {
      await updateActionItems.mutateAsync({ year, month, action_items: value });
      toast({
        title: '액션 아이템 저장 완료',
        description: '변경사항이 저장되었습니다.',
      });
    } catch (error) {
      toast({
        title: '저장 실패',
        description: extractApiErrorMessage(error, '다시 시도해주세요.'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-800">액션 아이템</h2>
      <div className="space-y-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="다음 달까지 처리할 액션 아이템을 입력하세요..."
          className="min-h-32 resize-y"
          maxLength={ACTION_ITEMS_MAX_LENGTH}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {value.length} / {ACTION_ITEMS_MAX_LENGTH}자
          </span>
          <Button
            onClick={handleSave}
            disabled={updateActionItems.isPending || !isDirty}
            size="sm"
          >
            {updateActionItems.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                저장
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
