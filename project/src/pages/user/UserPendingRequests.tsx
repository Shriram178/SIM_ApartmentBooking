import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { apiService } from '../../services/api';
import { BookingRequest } from '../../types';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { StatusBadge } from '../../components/StatusBadge';
import { Calendar, Users, User as UserIcon, X } from 'lucide-react';

export function UserPendingRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRequests, setExpandedRequests] = useState<Set<number>>(new Set());
  const [cancellingRequest, setCancellingRequest] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      loadPendingRequests();
    }
  }, [user]);

  const loadPendingRequests = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const response = await apiService.getUserPendingRequests(user.id);
      setRequests(response.data || []);
    } catch (error) {
      console.error('Failed to load pending requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelRequest = async (requestId: number, userId: number) => {
    if (cancellingRequest) return;
    
    try {
      setCancellingRequest(requestId);
      await apiService.cancelUserFromRequest(requestId, userId);
      await loadPendingRequests();
      alert('Request cancelled successfully');
    } catch (error) {
      alert('Failed to cancel request');
    } finally {
      setCancellingRequest(null);
    }
  };

  const handleCancelEntireRequest = async (requestId: number) => {
    if (cancellingRequest) return;
    
    try {
      setCancellingRequest(requestId);
      await apiService.deleteEntireRequest(requestId);
      await loadPendingRequests();
      alert('Entire request cancelled successfully');
    } catch (error) {
      alert('Failed to cancel entire request');
    } finally {
      setCancellingRequest(null);
    }
  };

  const toggleExpanded = (requestId: number) => {
    const newExpanded = new Set(expandedRequests);
    if (newExpanded.has(requestId)) {
      newExpanded.delete(requestId);
    } else {
      newExpanded.add(requestId);
    }
    setExpandedRequests(newExpanded);
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Pending Requests</h2>
        
        {requests.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No pending requests found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const isExpanded = expandedRequests.has(request.requestId);
              const isRequester = request.requestedUser.id === user?.id;
              const userInRequest = request.bookingMembers.find(member => member.userId === user?.id);
              
              return (
                <div key={request.requestId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <StatusBadge status="pending" />
                        <span className="text-sm font-medium text-gray-900">
                          {request.bookingType === 'individual' ? 'Individual' : 'Team'} Booking
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDateTime(request.requestedAt).date}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-3">
                        <div>
                          <span className="font-medium text-gray-700">City:</span>
                          <span className="ml-2 text-gray-900">{request.cityName}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Requester:</span>
                          <span className="ml-2 text-gray-900">{request.requestedUser.name}</span>
                        </div>
                        {request.bookingType === 'team' && (
                          <div>
                            <span className="font-medium text-gray-700">Team Size:</span>
                            <span className="ml-2 text-gray-900">{request.bookingMembers.length} members</span>
                          </div>
                        )}
                      </div>

                      {userInRequest && (
                        <div className="bg-gray-50 p-3 rounded-md mb-3">
                          <div className="text-sm">
                            <span className="font-medium text-gray-700">Your booking:</span>
                            <div className="mt-1 text-gray-900">
                              {formatDateTime(userInRequest.checkIn || '').date} at {formatDateTime(userInRequest.checkIn || '').time} - {formatDateTime(userInRequest.checkOut || '').date} at {formatDateTime(userInRequest.checkOut || '').time}
                            </div>
                          </div>
                        </div>
                      )}

                      {request.bookingType === 'team' && (
                        <button
                          onClick={() => toggleExpanded(request.requestId)}
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                        >
                          <Users size={14} />
                          <span>{isExpanded ? 'Hide' : 'View'} Team Members</span>
                        </button>
                      )}

                      {isExpanded && request.bookingType === 'team' && (
                        <div className="mt-4 space-y-2">
                          {request.bookingMembers.map((member, index) => (
                            <div key={index} className="bg-gray-50 p-3 rounded-md">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{member.username}</div>
                                  <div className="text-xs text-gray-500">{member.role}</div>
                                </div>
                                <div className="text-xs text-gray-600">
                                  {formatDateTime(member.checkIn || '').date} - {formatDateTime(member.checkOut || '').date}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col space-y-2 ml-4">
                      {isRequester ? (
                        // Requester options
                        request.bookingType === 'team' ? (
                          <>
                            <button
                              onClick={() => handleCancelRequest(request.requestId, user!.id)}
                              disabled={cancellingRequest === request.requestId}
                              className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {cancellingRequest === request.requestId ? 'Cancelling...' : 'Cancel Request'}
                            </button>
                            <button
                              onClick={() => handleCancelEntireRequest(request.requestId)}
                              disabled={cancellingRequest === request.requestId}
                              className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {cancellingRequest === request.requestId ? 'Cancelling...' : 'Cancel Team Request'}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleCancelRequest(request.requestId, user!.id)}
                            disabled={cancellingRequest === request.requestId}
                            className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {cancellingRequest === request.requestId ? 'Cancelling...' : 'Cancel Request'}
                          </button>
                        )
                      ) : userInRequest ? (
                        // Non-requester but in the request
                        <button
                          onClick={() => handleCancelRequest(request.requestId, user!.id)}
                          disabled={cancellingRequest === request.requestId}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {cancellingRequest === request.requestId ? 'Cancelling...' : 'Cancel Request'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}