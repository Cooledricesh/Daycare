'use client';

import { useState, useRef } from 'react';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZE_MAP = {
  sm: { container: 'w-7 h-7', icon: 'w-3.5 h-3.5' },
  lg: { container: 'w-10 h-10', icon: 'w-5 h-5' },
} as const;

interface PatientAvatarProps {
  avatarUrl: string | null | undefined;
  size: 'sm' | 'lg';
  fallbackColorClass: string;
  iconColorClass: string;
}

export function PatientAvatar({
  avatarUrl,
  size,
  fallbackColorClass,
  iconColorClass,
}: PatientAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const cacheBustRef = useRef(Date.now());
  const sizeClasses = SIZE_MAP[size];
  const showImage = avatarUrl && !imgError;
  const imgSrc = avatarUrl ? `${avatarUrl}?t=${cacheBustRef.current}` : null;

  return (
    <div
      className={cn(
        'rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden',
        sizeClasses.container,
        !showImage && fallbackColorClass,
      )}
    >
      {showImage ? (
        <img
          src={imgSrc!}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <User className={cn(sizeClasses.icon, iconColorClass)} />
      )}
    </div>
  );
}
