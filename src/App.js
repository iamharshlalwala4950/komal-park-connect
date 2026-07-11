// src/App.js
import React, { useState, useEffect } from 'react';
import './App.css';
import LoginForm from './features/auth/loginForm';
import DashBoard from './component/dashboard/dashboard';

function App() {
  const AUTH_TOKEN_KEY = "sb-pniuqioremyuomrvntaw-auth-token";
  
  // Set session timeout duration (e.g., 1 Hour = 3600000 Milliseconds)
  const SESSION_TIMEOUT_MS = 3600000; 

  // Helper function to validate session existence and age
  const checkIsAuthenticated = () => {
    try {
      const sessionString = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!sessionString) return false;
      
      const session = JSON.parse(sessionString);
      
      // If no login timestamp exists, consider it invalid
      if (!session.loginTimestamp) return false;

      // Check if the current time has exceeded the session lifespan
      const hasExpired = Date.now() - session.loginTimestamp > SESSION_TIMEOUT_MS;
      if (hasExpired) {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        return false;
      }

      // Check for the inner token layout structure from Supabase
      // It might be data.session.access_token or data.access_token depending on your authService mapping
      return !!(session.access_token || session.data?.session?.access_token || session.data?.access_token);
    } catch (error) {
      console.error("Auth initialization check failed:", error);
      return false;
    }
  };

  const [isAuthenticated, setIsAuthenticated] = useState(checkIsAuthenticated());

  // Handle Manual Logout
  const handleLogout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setIsAuthenticated(false);
  };

  // Handle Seamless Login Success
  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  // Automated Security Monitor: Monitors session age dynamically while app is open
  useEffect(() => {
    if (!isAuthenticated) return;

    try {
      const session = JSON.parse(localStorage.getItem(AUTH_TOKEN_KEY));
      const timeElapsed = Date.now() - session.loginTimestamp;
      const timeLeft = SESSION_TIMEOUT_MS - timeElapsed;

      if (timeLeft <= 0) {
        handleLogout();
      } else {
        // Set an automated timer to log the user out exactly when the timer hits zero
        const logoutTimer = setTimeout(() => {
          alert("Your admin session has expired for security reasons. Please login again.");
          handleLogout();
        }, timeLeft);

        return () => clearTimeout(logoutTimer);
      }
    } catch (e) {
      handleLogout();
    }
  }, [isAuthenticated]);

  return (
    <>
      {isAuthenticated ? (
        <DashBoard onLogout={handleLogout} />
      ) : (
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      )}
    </>
  );
}

export default App;