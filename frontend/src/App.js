import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage    from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import PendingPage  from "./pages/PendingPage";
import AdminPage    from "./pages/AdminPage";
import Dashboard    from "./pages/Dashboard";
import PublicPortal from "./pages/PublicPortal";
import "./App.css";

const Loader = () => (
  <div className="full-loader">
    <div className="loader-radar"/>
    <div className="loader-radar"/>
    <div className="loader-radar"/>
    <div className="loader-shield">🛡️</div>
    <div className="loader-brand">VIATRA</div>
    <div className="loader-brand-full">Violation Intelligence And Traffic Real-time Analysis</div>
    <div className="loader-scan-wrap">
      <div className="loader-scan-track"><div className="loader-scan-bar"/></div>
    </div>
    <div className="loader-text">Initializing system</div>
    <div className="loader-tech">
      <div className="loader-tech-item"><div className="loader-tech-dot"/>YOLO11</div>
      <div className="loader-tech-item"><div className="loader-tech-dot"/>ByteTrack</div>
      <div className="loader-tech-item"><div className="loader-tech-dot"/>Plate API</div>
      <div className="loader-tech-item"><div className="loader-tech-dot"/>Gemini AI</div>
    </div>
  </div>
);

function PrivateRoute({ children, adminOnly = false }) {
  const { officer, loading } = useAuth();
  if (loading) return <Loader/>;
  if (!officer) return <Navigate to="/" replace/>;
  if (adminOnly && officer.role !== "admin") return <Navigate to="/dashboard" replace/>;
  return children;
}

function PublicRoute({ children }) {
  const { officer, loading } = useAuth();
  if (loading) return <Loader/>;
  if (officer) {
    if (officer.role === "admin")      return <Navigate to="/admin"     replace/>;
    if (officer.status === "approved") return <Navigate to="/dashboard" replace/>;
    return <Navigate to="/pending" replace/>;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public — no auth needed */}
      <Route path="/public/challan" element={<PublicPortal/>}/>
      <Route path="/public/*"       element={<PublicPortal/>}/>

      {/* Auth pages */}
      <Route path="/"         element={<PublicRoute><LoginPage/></PublicRoute>}/>
      <Route path="/register" element={<PublicRoute><RegisterPage/></PublicRoute>}/>
      <Route path="/pending"  element={<PendingPage/>}/>

      {/* Protected */}
      <Route path="/dashboard" element={<PrivateRoute><Dashboard/></PrivateRoute>}/>
      <Route path="/admin"     element={<PrivateRoute adminOnly><AdminPage/></PrivateRoute>}/>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes/>
      </BrowserRouter>
    </AuthProvider>
  );
}
