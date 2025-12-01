'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export function useLogout() {
    const router = useRouter();

    const logout = useCallback(async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
            });
            router.push('/login');
            router.refresh(); // Refresh to ensure middleware/proxy catches the missing cookie
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }, [router]);

    return { logout };
}
