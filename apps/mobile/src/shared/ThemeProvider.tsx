import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { Platform } from "react-native";
import { ThemeContext, themes, type ThemeMode } from "./theme";

const storageKey = "mindguard.appearance.v1";

export function ThemeProvider({ children }: PropsWithChildren) {
  const [selectedMode, setSelectedMode] = useState<ThemeMode | null>(null);
  const pendingWrite = useRef(Promise.resolve());
  const mode = selectedMode ?? "light";

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey)
      .then((saved) => {
        if (active && (saved === "light" || saved === "dark")) {
          setSelectedMode((current) => current ?? saved);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.style.colorScheme = mode;
      document.documentElement.style.backgroundColor = themes[mode].colors.paper;
    }
  }, [mode]);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setSelectedMode(nextMode);
    pendingWrite.current = pendingWrite.current
      .then(() => AsyncStorage.setItem(storageKey, nextMode))
      .catch(() => {});
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
