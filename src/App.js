import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./Login";
import Dashboard from "./Dashboard";
import UserLogin from "./User-Login";
import SuccessScreen from "./Success";
import TicData from "./TicData";
import { auth } from "./firebase";
import "bootstrap/dist/css/bootstrap.min.css";

// ProtectedRoute component
const ProtectedRoute = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    // You can replace this with a spinner or skeleton loader
    return <div>Loading...</div>;
  }

  // If no user, redirect to login page
  if (!user) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const App = () => {
  return (
    <Router>
      <Routes>
        {/* Public Route: Login */}
        <Route path="/" element={<Login />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/userlogin"
          element={
              <UserLogin />
          }
        />
        <Route
          path="/success"
          element={
            <ProtectedRoute>
              <SuccessScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:patientId"
          element={
            <ProtectedRoute>
              <TicData />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
