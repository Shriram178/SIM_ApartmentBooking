import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from './LoadingSpinner';
import { X } from 'lucide-react';

interface GenderSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GenderSelectionModal({ isOpen, onClose }: GenderSelectionModalProps) {
  const { updateUserGender } = useAuth();
  const [selectedGender, setSelectedGender] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGender) return;

    try {
      setIsLoading(true);
      setError(null);
      await updateUserGender(selectedGender);
      onClose();
    } catch (error) {
      setError('Failed to update gender');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Select Gender</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="gender"
                value="male"
                checked={selectedGender === 'male'}
                onChange={(e) => setSelectedGender(e.target.value)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm font-medium text-gray-900">Male</span>
            </label>

            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="gender"
                value="female"
                checked={selectedGender === 'female'}
                onChange={(e) => setSelectedGender(e.target.value)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm font-medium text-gray-900">Female</span>
            </label>
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={!selectedGender || isLoading}
            className="w-full flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? <LoadingSpinner size="sm" /> : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}