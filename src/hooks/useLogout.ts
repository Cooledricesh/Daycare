'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useLogout() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const logout = useCallback(async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
            });
            // 캐시 전체 초기화 - 이전 사용자 데이터가 남지 않도록
            queryClient.clear();
            router.push('/login');
            router.refresh();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }, [router, queryClient]);

    return { logout };
}
