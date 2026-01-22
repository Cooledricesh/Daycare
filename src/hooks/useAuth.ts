'use client';

import { useQuery } from '@tanstack/react-query';

export interface AuthUser {
  id: string;
  name: string;
  role: string;
}

async function fetchMe(): Promise<AuthUser> {
  const response = await fetch('/api/me', {
    credentials: 'include', // 쿠키를 포함하여 요청
  });
  if (!response.ok) {
    throw new Error('Failed to fetch user');
  }
  // respond() 함수는 success 시 data 객체를 직접 반환함
  const json = await response.json();
  return json as AuthUser;
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    staleTime: 1000 * 60 * 5, // 5분
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}
