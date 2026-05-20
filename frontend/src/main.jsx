import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Bestätigung from "./Bestätigung.jsx";
import AdminLogin from "./AdminLogin.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";

function RequireAdminAuth({ children }) {
  const token = localStorage.getItem("admin_token");
  if (!token) return <Navigate to="/admin" replace />;
  return children;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/bestaetigung/:uuid" element={<Bestätigung />} />
      <Route path="/bearbeiten/:uuid" element={<App />} />
      <Route path="/admin" element={<AdminLogin />} />
      <Route
        path="/admin/dashboard"
        element={
          <RequireAdminAuth>
            <AdminDashboard />
          </RequireAdminAuth>
        }
      />
    </Routes>
  </BrowserRouter>
);
