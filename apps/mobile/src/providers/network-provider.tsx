import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type NetworkContextValue = { isOnline: boolean };

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: PropsWithChildren) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const nextOnline =
        state.isConnected !== false && state.isInternetReachable !== false;
      setIsOnline(nextOnline);
      onlineManager.setOnline(nextOnline);
    });
    return unsubscribe;
  }, []);

  const value = useMemo(() => ({ isOnline }), [isOnline]);
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetworkStatus(): NetworkContextValue {
  const value = useContext(NetworkContext);
  if (!value) throw new Error("useNetworkStatus must be used inside NetworkProvider.");
  return value;
}
