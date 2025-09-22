import React from 'react';
import { X } from 'lucide-react';

interface TeamMember {
  bookingMemberId?: number;
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  gender?: string;
  checkIn?: string;
  checkOut?: string;
}

interface TeamMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: TeamMember[];
  title?: string;
}

export function TeamMembersModal({ isOpen, onClose, members, title = "Team Members:" }: TeamMembersModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          {members.map((member, index) => (
            <div key={member.bookingMemberId || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {member.name || member.username || `User${index + 1}`}
                </div>
                {member.email && (
                  <div className="text-xs text-gray-500">{member.email}</div>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs font-medium text-gray-700 bg-white px-2 py-1 rounded">
                  {member.role || 'Member'}
                </div>
                {member.gender && (
                  <div className="text-xs text-gray-500 mt-1 capitalize">{member.gender}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}