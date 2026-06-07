'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface PageHeaderState {
  title: string;
  description?: string;
  actions?: ReactNode;
}

interface PageHeaderContextValue {
  header: PageHeaderState;
  setHeader: (state: PageHeaderState) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue>({
  header: { title: '' },
  setHeader: () => {},
});

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeaderState] = useState<PageHeaderState>({ title: '' });

  const setHeader = useCallback((state: PageHeaderState) => {
    setHeaderState(state);
  }, []);

  return (
    <PageHeaderContext.Provider value={{ header, setHeader }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeader() {
  return useContext(PageHeaderContext);
}
