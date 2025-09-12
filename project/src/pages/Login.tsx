import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { apiService } from '../services/api';
import { LogIn } from 'lucide-react';

export function Login() {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  

  useEffect(() => {
    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      handleLogin(code);
    }
  }, []);

  const handleLogin = async (code?: string) => {
  if (!code) {
    // Redirect to Microsoft SSO
    try {
      setIsLoading(true);
      const response = await apiService.getAuthUrl();
      window.location.href = response.url;
    } catch (err) {
      setError('Failed to initialize login');
      setIsLoading(false);
    }
  } else {
    try {
      setIsLoading(true);
      // Exchange code for JWT
      const response = await apiService.login(code); // call your backend /login
      const { token, user } = response;

      // Save token and user locally
      apiService.setToken(token);
      localStorage.setItem('user', JSON.stringify(user));

      // Optionally, update auth context if you have one
      // setUser(user); // not needed if useAuth manages state

      // Remove code from URL
      window.history.replaceState({}, document.title, window.location.pathname);

      setIsLoading(false);
    } catch (err) {
      console.error(err);
      setError('Authentication Failed!');
      setIsLoading(false);
    }
  }
};

  const handleRetry = () => {
    setError(null);
    handleLogin();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Welcome</h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your organization account
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow-sm rounded-lg">
          {error ? (
            <div className="text-center space-y-4">
              <div className="text-red-600 text-sm font-medium">
                {error}
              </div>
              <button
                onClick={handleRetry}
                className="w-full flex justify-center items-center px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleLogin()}
              disabled={isLoading}
              className="w-full flex justify-center items-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Sign-in using Outlook</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}