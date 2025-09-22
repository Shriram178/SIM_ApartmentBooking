import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { PendingRequest, AvailabilityResponse } from '../../types';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { TabNavigation } from '../../components/TabNavigation';
import { StatusBadge } from '../../components/StatusBadge';
import { Users, User as UserIcon, Calendar, MapPin, X } from 'lucide-react';

// Utility function to check if two date ranges overlap
const doDateRangesOverlap = (
  range1Start: string,
  range1End: string,
  range2Start: string,
  range2End: string
): boolean => {
  const start1 = new Date(range1Start);
  const end1 = new Date(range1End);
  const start2 = new Date(range2Start);
  const end2 = new Date(range2End);

  // Check if ranges overlap: start1 < end2 AND start2 < end1
  // This handles all overlap scenarios including:
  // - Complete overlap
  // - Partial overlap
  // - One range completely inside another
  // - Adjacent dates (same day checkout/checkin) are considered non-overlapping
  return start1 < end2 && start2 < end1;
};

// Helper function to get member's date range
const getMemberDateRange = (member: any, processingRequest: any) => {
  const memberData = processingRequest.bookingMembers.find(
    (m: any) => m.bookingMemberId === member.bookingMemberId
  );
  return {
    checkIn: memberData?.checkIn || '',
    checkOut: memberData?.checkOut || ''
  };
};

interface ProcessingRequest {
  requestId: number;
  city: string;
  requestedBy: {
    userId: number;
    name: string;
    email: string;
    role: string;
    gender: string;
  };
  status: string;
  bookingType: 'individual' | 'team';
  requestedAt: string;
  bookingMembers: Array<{
    bookingMemberId: number;
    name: string;
    email: string;
    gender: string;
    checkIn: string;
    checkOut: string;
  }>;
}

export function AdminPendingRequests() {
  const [requests, setRequests] = useState<ProcessingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('individual');
  const [processingRequest, setProcessingRequest] = useState<ProcessingRequest | null>(null);
  const [availableAccommodations, setAvailableAccommodations] = useState<any>(null);
  const [selectedAccommodations, setSelectedAccommodations] = useState<Record<number, any>>({});
  const [remarks, setRemarks] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadPendingRequests();
  }, []);

  const loadPendingRequests = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getAllPendingRequests();
      setRequests(response.data || []);
    } catch (error) {
      console.error('Failed to load pending requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const individualRequests = requests.filter(r => r.bookingType === 'individual');
  const teamRequests = requests.filter(r => r.bookingType === 'team');

  const tabs = [
    {
      key: 'individual',
      label: 'Individual',
      notificationCount: individualRequests.length > 0 ? individualRequests.length : undefined
    },
    {
      key: 'team',
      label: 'Team',
      notificationCount: teamRequests.length > 0 ? teamRequests.length : undefined
    }
  ];

  const processRequest = async (request: ProcessingRequest) => {
    setProcessingRequest(request);
    setSelectedAccommodations({});
    setRemarks('');
    
    // Load availability data for all unique date ranges in the request
    try {
      const cities = await apiService.getCities();
      const city = cities.find(c => c.name === request.city);
      
      if (city) {
        // Get unique date ranges from booking members
        const uniqueDateRanges = new Map();
        request.bookingMembers.forEach(member => {
          const key = `${member.checkIn}-${member.checkOut}`;
          if (!uniqueDateRanges.has(key)) {
            uniqueDateRanges.set(key, {
              checkIn: member.checkIn,
              checkOut: member.checkOut
            });
          }
        });
        
        const dates = Array.from(uniqueDateRanges.values()).map(range => ({
          checkIn: range.checkIn,
          checkOut: range.checkOut
        }));
        
        const availabilityResponse = await apiService.getAvailabilityByCity(city.id, dates);
        setAvailableAccommodations(availabilityResponse);
      }
    } catch (error) {
      console.error('Failed to load availability:', error);
    }
  };

  // Helper function to find availability data for a specific member's date range
  const getAvailabilityForMember = (member: any) => {
    if (!availableAccommodations?.data) return null;
    
    return availableAccommodations.data.find((dateRange: any) => 
      dateRange.checkIn === member.checkIn && dateRange.checkOut === member.checkOut
    );
  };

  const getDefaultAccommodationType = (role: string) => {
    const roleMap: Record<string, string> = {
      'manager': 'flat',
      'lead': 'room',
      'project engineer': 'bed'
    };
    return roleMap[role.toLowerCase()] || 'bed';
  };

  const getAvailableAccommodations = (type: string, memberGender: string, member: any, assignedAccommodations: Record<number, any>) => {
    const memberAvailability = getAvailabilityForMember(member);
    if (!memberAvailability?.apartmentsStatus) return [];

    const apartments = memberAvailability.apartmentsStatus;
    
    // Get current member's date range
    const currentMemberDates = getMemberDateRange(member, processingRequest);
    
    // Get assigned accommodations that have overlapping dates with current member
    const conflictingAssignments = Object.entries(assignedAccommodations)
      .filter(([memberId, accommodation]) => {
        // Don't filter out current member's own assignment
        if (parseInt(memberId) === member.bookingMemberId) return false;
        
        // Get the other member's date range
        const otherMemberDates = getMemberDateRange(
          { bookingMemberId: parseInt(memberId) }, 
          processingRequest
        );
        
        // Only consider this assignment conflicting if dates overlap
        return doDateRangesOverlap(
          currentMemberDates.checkIn,
          currentMemberDates.checkOut,
          otherMemberDates.checkIn,
          otherMemberDates.checkOut
        );
      })
      .map(([_, accommodation]) => accommodation);
    
    let options: any[] = [];

    apartments.forEach((apartment: any) => {
      apartment.flats?.forEach((flat: any) => {
        // Check gender compatibility for flat
        if (flat.gender && flat.gender !== memberGender) return;
        
        if (type === 'flat' && flat.isAvailable) {
          // Check if this specific flat is already assigned to OTHER members with overlapping dates
          const isAssigned = conflictingAssignments.some(acc => acc.flatId === flat.id && acc.type === 'flat');
          if (!isAssigned) {
            options.push({
              id: flat.id,
              name: `${apartment.name} - ${flat.name}`,
              type: 'flat',
              apartmentId: apartment.id,
              flatId: flat.id
            });
          }
        }

        flat.rooms?.forEach((room: any) => {
          if (type === 'room' && room.isAvailable) {
            // Check if this specific room is already assigned OR its parent flat is assigned to OTHER members with overlapping dates
            const isRoomAssigned = conflictingAssignments.some(acc => acc.roomId === room.id && acc.type === 'room');
            const isFlatAssigned = conflictingAssignments.some(acc => acc.flatId === flat.id && acc.type === 'flat');
            const isAssigned = isRoomAssigned || isFlatAssigned;
            
            if (!isAssigned) {
              options.push({
                id: room.id,
                name: `${apartment.name} - ${flat.name} - ${room.name}`,
                type: 'room',
                apartmentId: apartment.id,
                flatId: flat.id,
                roomId: room.id
              });
            }
          }

          room.beds?.forEach((bed: any) => {
            if (type === 'bed' && bed.isAvailable) {
              // Check if this specific bed is already assigned OR its parent room/flat is assigned to OTHER members with overlapping dates
              const isBedAssigned = conflictingAssignments.some(acc => acc.bedId === bed.id && acc.type === 'bed');
              const isRoomAssigned = conflictingAssignments.some(acc => acc.roomId === room.id && acc.type === 'room');
              const isFlatAssigned = conflictingAssignments.some(acc => acc.flatId === flat.id && acc.type === 'flat');
              const isAssigned = isBedAssigned || isRoomAssigned || isFlatAssigned;
              
              if (!isAssigned) {
                options.push({
                  id: bed.id,
                  name: `${apartment.name} - ${flat.name} - ${room.name} - ${bed.name}`,
                  type: 'bed',
                  apartmentId: apartment.id,
                  flatId: flat.id,
                  roomId: room.id,
                  bedId: bed.id
                });
              }
            }
          });
        });
      });
    });

    return options;
  };

  const handleAccommodationChange = (memberId: number, type: string, accommodation: any) => {
    setSelectedAccommodations(prev => ({
      ...prev,
      [memberId]: {
        type,
        ...accommodation
      }
    }));
  };

  const handleApprove = async () => {
    if (!processingRequest) return;

    // Validate all members have accommodations assigned
    const missingAccommodations = processingRequest.bookingMembers.filter(
      member => !selectedAccommodations[member.bookingMemberId]
    );

    if (missingAccommodations.length > 0) {
      alert('Please assign accommodations to all team members before approving');
      return;
    }

    const allocatedAccommodation = processingRequest.bookingMembers.map(member => ({
      bookingMemberId: member.bookingMemberId,
      assignedAccommodation: {
        apartmentId: selectedAccommodations[member.bookingMemberId]?.apartmentId,
        flatId: selectedAccommodations[member.bookingMemberId]?.flatId,
        roomId: selectedAccommodations[member.bookingMemberId]?.roomId,
        bedId: selectedAccommodations[member.bookingMemberId]?.bedId,
      }
    }));

    try {
      setIsProcessing(true);
      await apiService.approveRequest(processingRequest.requestId, {
        remarks: remarks.trim() || undefined,
        allocatedAccommodation
      });
      
      setProcessingRequest(null);
      setSelectedAccommodations({});
      setRemarks('');
      await loadPendingRequests();
      alert('Request approved successfully');
    } catch (error) {
      alert('Failed to approve request');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!processingRequest || !remarks.trim()) {
      alert('Remarks are required for rejection');
      return;
    }

    try {
      setIsProcessing(true);
   const res=await apiService.rejectRequest(processingRequest.requestId, remarks);
   console.log(res);
      setProcessingRequest(null);
      setRemarks('');
      await loadPendingRequests();
      alert('Request rejected successfully');
    } catch (error) {
      alert('Failed to reject request');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const currentRequests = activeTab === 'individual' ? individualRequests : teamRequests;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Pending Requests</h2>
        
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          className="mb-6"
        />

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : currentRequests.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No pending {activeTab} requests found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {currentRequests.map((request) => (
              <div key={request.requestId} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <StatusBadge status="pending" />
                      <span className="text-sm font-medium text-gray-900">
                        {request.city}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDateTime(request.requestedAt).date}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-3">
                      <div>
                        <span className="font-medium text-gray-700">Requester:</span>
                        <div className="text-gray-900">{request.requestedBy.name}</div>
                        <div className="text-xs text-gray-500">{request.requestedBy.role}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Type:</span>
                        <div className="text-gray-900 capitalize">
                          {request.bookingType}
                          {request.bookingType === 'team' && (
                            <span className="text-xs text-gray-500 ml-1">
                              ({request.bookingMembers.length} members)
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Duration:</span>
                        <div className="text-gray-900">
                          {formatDateTime(request.bookingMembers[0]?.checkIn).date} - {formatDateTime(request.bookingMembers[0]?.checkOut).date}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => processRequest(request)}
                    className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Process
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Processing Modal */}
      {processingRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Process Request</h3>
              <button
                onClick={() => setProcessingRequest(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Request Details */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Request Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Requester:</span>
                    <div>{processingRequest.requestedBy.name}</div>
                    <div className="text-xs text-gray-500">{processingRequest.requestedBy.role}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">City:</span>
                    <div>{processingRequest.city}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Type:</span>
                    <div className="capitalize">{processingRequest.bookingType}</div>
                  </div>
                </div>
              </div>

              {/* Team Members */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">
                  {processingRequest.bookingType === 'team' ? 'Team Members' : 'Booking Details'}
                </h4>
                {processingRequest.bookingMembers.map((member, index) => {
                  const defaultType = getDefaultAccommodationType(member.name.includes('Manager') ? 'Manager' : member.name.includes('Lead') ? 'Lead' : 'Project Engineer');
                  const availableOptions = getAvailableAccommodations(
                    selectedAccommodations[member.bookingMemberId]?.type || defaultType,
                    member.gender,
                    member,
                    selectedAccommodations
                  );

                  return (
                    <div key={member.bookingMemberId} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="text-sm font-medium text-gray-900 flex items-center space-x-2">
                            <span>{member.name}</span>
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {member.gender}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">{member.email}</div>
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatDateTime(member.checkIn).date} - {formatDateTime(member.checkOut).date}
                        </div>
                      </div>

                      {/* Accommodation Assignment */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select
                          value={selectedAccommodations[member.bookingMemberId]?.type || defaultType}
                          onChange={(e) => {
                            const newType = e.target.value;
                            setSelectedAccommodations(prev => ({
                              ...prev,
                              [member.bookingMemberId]: { type: newType }
                            }));
                          }}
                          className="p-2 border border-gray-300 rounded text-sm"
                        >
                          <option value="bed">Bed</option>
                          <option value="room">Room</option>
                          <option value="flat">Flat</option>
                        </select>
                        
                        <select
                          value={selectedAccommodations[member.bookingMemberId]?.id || ''}
                          onChange={(e) => {
                            const selectedOption = availableOptions.find(opt => opt.id === parseInt(e.target.value));
                            if (selectedOption) {
                              handleAccommodationChange(member.bookingMemberId, selectedOption.type, selectedOption);
                            }
                          }}
                          className="p-2 border border-gray-300 rounded text-sm"
                        >
                          <option value="">Select Accommodation</option>
                          {availableOptions.map(option => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedAccommodations[member.bookingMemberId] && (
                        <div className="mt-2 text-xs text-green-600">
                          ✓ Assigned: {selectedAccommodations[member.bookingMemberId].name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remarks
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add remarks for approval or rejection..."
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleReject}
                  disabled={isProcessing}
                  className="px-4 py-2 text-red-600 border border-red-600 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {isProcessing ? 'Processing...' : 'Reject'}
                </button>
                <button
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {isProcessing ? 'Processing...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}