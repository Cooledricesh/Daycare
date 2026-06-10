'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { WaitingPatient } from '../backend/schema';
import { doctorKeys } from './query-keys';

type UseWaitingPatientsParams = {
  date?: string;
};

/**
 * 폴링 주기와 staleTime을 동일하게 설정하는 근거:
 * staleTime=0(기본값)일 때 refetchOnWindowFocus가 발생하면 폴링과 별개로 즉시 refetch가 트리거된다.
 * staleTime을 refetchInterval과 같은 값으로 맞추면, 폴링으로 데이터가 갱신된 직후에는
 * "fresh" 상태가 되어 windowFocus refetch가 스킵되므로 중복 요청이 제거된다.
 */
const WAITING_PATIENTS_REFETCH_INTERVAL_MS = 30_000;
const WAITING_PATIENTS_STALE_TIME_MS = WAITING_PATIENTS_REFETCH_INTERVAL_MS;

export function useWaitingPatients(params: UseWaitingPatientsParams = {}) {
  return useQuery({
    queryKey: doctorKeys.waitingPatients.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.date) {
        searchParams.set('date', params.date);
      }

      const queryString = searchParams.toString();
      const url = `/api/doctor/waiting-patients${queryString ? `?${queryString}` : ''}`;

      const response = await apiClient.get<WaitingPatient[]>(url);
      return response.data;
    },
    refetchInterval: WAITING_PATIENTS_REFETCH_INTERVAL_MS,
    staleTime: WAITING_PATIENTS_STALE_TIME_MS,
  });
}
