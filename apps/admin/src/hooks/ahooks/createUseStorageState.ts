import { useState, useCallback } from 'react';

type StorageStateResult<T> = [
  T | undefined,
  (value: T | undefined | ((prev: T | undefined) => T | undefined)) => void,
];

export function createUseStorageState(getStorage: () => Storage | undefined) {
  return function useStorageState<T>(key: string, defaultValue?: T): StorageStateResult<T> {
    const storage = getStorage();

    const getStoredValue = useCallback((): T | undefined => {
      if (!storage) return defaultValue;
      try {
        const raw = storage.getItem(key);
        if (raw === null) return defaultValue;
        return JSON.parse(raw) as T;
      } catch {
        return defaultValue;
      }
    }, [key, storage]); // eslint-disable-line react-hooks/exhaustive-deps

    const [state, setState] = useState<T | undefined>(getStoredValue);

    const updateState = useCallback(
      (value: T | undefined | ((prev: T | undefined) => T | undefined)) => {
        const newValue = typeof value === 'function'
          ? (value as (prev: T | undefined) => T | undefined)(state)
          : value;
        if (!storage) return;
        try {
          if (newValue === undefined) {
            storage.removeItem(key);
          } else {
            storage.setItem(key, JSON.stringify(newValue));
          }
          setState(newValue);
        } catch {
          // ignore storage errors
        }
      },
      [key, state, storage],
    );

    return [state, updateState];
  };
}
