"use client";

import { createContext, useContext, type ReactNode } from "react";

const ZenModeContext = createContext(false);

export function ZenModeProvider({ children }: { children: ReactNode }) {
  return (
    <ZenModeContext.Provider value={true}>{children}</ZenModeContext.Provider>
  );
}

export function useZenMode() {
  return useContext(ZenModeContext);
}
