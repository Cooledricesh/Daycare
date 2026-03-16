'use client';

import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function useHydrated(): boolean {
  return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);
}
