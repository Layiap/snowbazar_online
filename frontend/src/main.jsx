import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Bestätigung from "./Bestätigung.jsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/bestaetigung/:uuid" element={<Bestätigung />} />
      <Route path="/bearbeiten/:uuid" element={<App />} />
    </Routes>
  </BrowserRouter>
);
