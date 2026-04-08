'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, User, Camera, Trash2 } from 'lucide-react';
import { useUpdateDisplayName } from '../hooks/useUpdateDisplayName';
import { useUploadAvatar, useDeleteAvatar } from '../hooks/usePatientAvatar';
import { useToast } from '@/hooks/use-toast';
import { extractApiErrorMessage } from '@/lib/remote/api-client';
import { AVATAR_ALLOWED_MIME_TYPES, AVATAR_MAX_FILE_SIZE } from '../constants/avatar';

interface DisplayNameEditButtonProps {
  patientId: string;
  patientName: string;
  currentDisplayName: string | null;
  currentAvatarUrl: string | null;
  variant?: 'icon' | 'text';
}

export function DisplayNameEditButton({
  patientId,
  patientName,
  currentDisplayName,
  currentAvatarUrl,
  variant = 'icon',
}: DisplayNameEditButtonProps) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(currentDisplayName || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [wantsDelete, setWantsDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: updateName, isPending: isNamePending } = useUpdateDisplayName();
  const { mutateAsync: uploadAvatar, isPending: isUploadPending } = useUploadAvatar();
  const { mutateAsync: deleteAvatar, isPending: isDeletePending } = useDeleteAvatar();
  const isPending = isNamePending || isUploadPending || isDeletePending;

  const { toast } = useToast();

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setDisplayName(currentDisplayName || '');
      setSelectedFile(null);
      setPreviewUrl(null);
      setWantsDelete(false);
    } else if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setOpen(isOpen);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > AVATAR_MAX_FILE_SIZE) {
      toast({
        title: '파일 크기 초과',
        description: '2MB 이하 파일만 업로드 가능합니다.',
        variant: 'destructive',
      });
      return;
    }

    if (!(AVATAR_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      toast({
        title: '지원하지 않는 형식',
        description: 'jpg, png, webp 파일만 가능합니다.',
        variant: 'destructive',
      });
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setWantsDelete(false);
  };

  const handleDeletePhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setWantsDelete(true);
  };

  const handleSave = async () => {
    const trimmed = displayName.trim();
    const nameValue = trimmed === '' || trimmed === patientName ? null : trimmed;

    try {
      await updateName({ patientId, displayName: nameValue });
      toast({
        title: '표시명 변경 완료',
        description: nameValue
          ? `"${patientName}" → "${nameValue}" 로 변경되었습니다.`
          : `표시명이 원래 이름으로 복원되었습니다.`,
      });
    } catch (error) {
      const message = extractApiErrorMessage(error, '표시명 변경에 실패했습니다.');
      toast({ title: '변경 실패', description: message, variant: 'destructive' });
      return;
    }

    if (selectedFile) {
      try {
        await uploadAvatar({ patientId, file: selectedFile });
        toast({ title: '사진 업로드 완료' });
      } catch (error) {
        const message = extractApiErrorMessage(error, '사진 업로드에 실패했습니다.');
        toast({ title: '사진 업로드 실패', description: message, variant: 'destructive' });
      }
    } else if (wantsDelete && currentAvatarUrl) {
      try {
        await deleteAvatar({ patientId });
        toast({ title: '사진 삭제 완료' });
      } catch (error) {
        const message = extractApiErrorMessage(error, '사진 삭제에 실패했습니다.');
        toast({ title: '사진 삭제 실패', description: message, variant: 'destructive' });
      }
    }

    setOpen(false);
  };

  const handleReset = async () => {
    try {
      await updateName({ patientId, displayName: null });
      toast({
        title: '표시명 초기화',
        description: `원래 이름 "${patientName}" 으로 복원되었습니다.`,
      });
      setDisplayName('');
      setOpen(false);
    } catch (error) {
      const message = extractApiErrorMessage(error, '초기화에 실패했습니다.');
      toast({ title: '초기화 실패', description: message, variant: 'destructive' });
    }
  };

  const displayAvatarUrl = wantsDelete ? null : (previewUrl || currentAvatarUrl);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {variant === 'icon' ? (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600">
            <Pencil className="h-3 w-3" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Pencil className="h-3 w-3 mr-1" />
            표시명 변경
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>환자 프로필 편집</DialogTitle>
          <DialogDescription>
            프로필 사진과 표시명을 변경합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* 아바타 미리보기 + 업로드 */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
              {displayAvatarUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- 외부 Supabase Storage URL이라 next/image 불필요 */}
                  <img src={displayAvatarUrl} alt="" className="w-full h-full object-cover" />
                </>
              ) : (
                <User className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending}
              >
                <Camera className="h-3 w-3 mr-1" />
                사진 변경
              </Button>
              {(currentAvatarUrl || previewUrl) && !wantsDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600"
                  onClick={handleDeletePhoto}
                  disabled={isPending}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  사진 삭제
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={AVATAR_ALLOWED_MIME_TYPES.join(',')}
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </div>
          <div>
            <Label className="text-sm text-gray-500">실제 이름 (병록)</Label>
            <p className="text-sm font-medium mt-1">{patientName}</p>
          </div>
          <div>
            <Label htmlFor="display-name">표시명</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={`예: ${patientName}A, ${patientName}B`}
              className="mt-1"
              maxLength={100}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isPending) {
                  void handleSave();
                }
              }}
            />
            <p className="text-xs text-gray-400 mt-1">
              비워두면 원래 이름으로 표시됩니다.
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {currentDisplayName && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isPending}
            >
              원래 이름으로 복원
            </Button>
          )}
          <Button onClick={handleSave} disabled={isPending} size="sm">
            {isPending ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
