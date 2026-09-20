import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);
const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

export function AuthProvider({ children }) {
  const [officer, setOfficer] = useState(null);
  const [token, setToken]     = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verify = async () => {
      if (!token) { setLoading(false); return; }
      try {
        const res = await fetch(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setOfficer(await res.json());
        } else {
          logout();
        }
      } catch (e) {
        console.error("Auth verify error:", e);
        // Don't logout on network error — keep token
        setLoading(false);
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, []);

  const login = async (email, password) => {
    try {
      const res  = await fetch(`${API}/api/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed");
      localStorage.setItem("token", data.access_token);
      setToken(data.access_token);
      setOfficer(data.officer);
      return data.officer;
    } catch (err) {
      // Network error
      if (err.message === "Failed to fetch") {
        throw new Error("Cannot connect to backend. Make sure server is running on port 8000.");
      }
      throw err;
    }
  };

  const register = async (formData) => {
    try {
      const res  = await fetch(`${API}/api/auth/register`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed");
      return data;
    } catch (err) {
      if (err.message === "Failed to fetch") {
        throw new Error("Cannot connect to backend. Make sure server is running on port 8000.");
      }
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setOfficer(null);
  };

  return (
    <AuthContext.Provider value={{ officer, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
