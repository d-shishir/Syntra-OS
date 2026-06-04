import React, { createContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiClient } from "../../services/apiClient";

export type SessionStatus = "active" | "expiring" | "locked" | "expired" | "idle";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: string;
}

interface AuthContextType {
  token: string | null;
  currentUser: UserProfile | null;
  sessionStatus: SessionStatus;
  sessionTimeRemaining: number; // in seconds
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => Promise<void>;
  extendSession: () => Promise<boolean>;
  setSessionStatus: (status: SessionStatus) => void;
  updateUserPermissions: (userId: string, role: string, status: string) => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const decodeJwt = (jwtToken: string) => {
  try {
    const base64Url = jwtToken.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem("syntra_token"));
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("idle");
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<number>(0);

  const resolveUserFromToken = useCallback((jwtToken: string) => {
    const payload = decodeJwt(jwtToken);
    if (payload) {
      setCurrentUser({
        id: payload.sub,
        name: payload.role === "admin"
          ? "Admin Director"
          : payload.role.replace("_", " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
        email: payload.email || `${payload.role}@syntra.io`,
        role: payload.role,
        department: payload.department || "system",
        status: "active",
      });
      setSessionStatus("active");
    } else {
      localStorage.removeItem("syntra_token");
      setToken(null);
      setCurrentUser(null);
      setSessionStatus("idle");
    }
  }, []);

  // Initialize
  useEffect(() => {
    if (token) {
      resolveUserFromToken(token);
    }
  }, [token, resolveUserFromToken]);

  // Session monitor countdown and auto-refresh
  useEffect(() => {
    if (!token) return;

    const payload = decodeJwt(token);
    if (!payload || !payload.exp) return;

    const expiryTime = payload.exp * 1000; // exp is in seconds

    const checkExpiry = () => {
      const now = Date.now();
      const timeLeft = Math.max(0, Math.floor((expiryTime - now) / 1000));
      setSessionTimeRemaining(timeLeft);

      if (timeLeft <= 0) {
        setSessionStatus("expired");
        localStorage.removeItem("syntra_token");
        setToken(null);
        setCurrentUser(null);
      } else if (timeLeft <= 60 && sessionStatus === "active") {
        setSessionStatus("expiring");
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 1000);

    return () => clearInterval(interval);
  }, [token, sessionStatus]);

  const extendSession = useCallback(async (): Promise<boolean> => {
    const storedToken = localStorage.getItem("syntra_token");
    if (!storedToken) return false;

    // Use current session/refresh tokens from store
    // Since API refresh takes refresh_token, let's query it
    // For simplicity of simulation, we can refresh with the access_token in headers
    try {
      const res = await apiClient.post("/api/v1/auth/refresh", {
        refresh_token: storedToken // Using access_token as refresh simulation key in db
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("syntra_token", data.access_token);
        setToken(data.access_token);
        resolveUserFromToken(data.access_token);
        setSessionStatus("active");
        return true;
      }
    } catch (e) {
      console.error("Token auto-refresh failed:", e);
    }
    return false;
  }, [resolveUserFromToken]);

  // Auto-refresh token if expiring
  useEffect(() => {
    if (sessionStatus === "expiring") {
      extendSession();
    }
  }, [sessionStatus, extendSession]);

  const login = async (email: string, pass: string): Promise<boolean> => {
    try {
      const res = await apiClient.post("/api/v1/auth/login", { email, password: pass });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("syntra_token", data.access_token);
        setToken(data.access_token);
        resolveUserFromToken(data.access_token);
        setSessionStatus("active");
        return true;
      }
    } catch (e) {
      console.error("Login request failed:", e);
    }
    return false;
  };

  const logout = async () => {
    try {
      if (token) {
        await apiClient.post("/api/v1/auth/logout");
      }
    } catch (e) {
      console.error("Logout request failed:", e);
    } finally {
      localStorage.removeItem("syntra_token");
      setToken(null);
      setCurrentUser(null);
      setSessionStatus("idle");
    }
  };

  const updateUserPermissions = async (userId: string, role: string, status: string): Promise<boolean> => {
    try {
      const res = await apiClient.post("/api/v1/auth/permissions/assign", {
        user_id: userId,
        role,
        status,
      });
      return res.ok;
    } catch (e) {
      console.error("Failed to update user privileges:", e);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        currentUser,
        sessionStatus,
        sessionTimeRemaining,
        login,
        logout,
        extendSession,
        setSessionStatus,
        updateUserPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
