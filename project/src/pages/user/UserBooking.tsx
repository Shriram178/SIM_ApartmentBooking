import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { apiService } from '../../services/api';
import { City, User } from '../../types';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { StatusBadge } from '../../components/StatusBadge';
import { Plus, X, Calendar, Clock } from 'lucide-react';

export function UserBooking() {
  const { user } = useAuth();
  const [cities, setCities] = useState<City[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedCity, setSelectedCity] = useState<number | null>(null);
  const [bookingType, setBookingType] = useState<'individual' | 'team'>('individual');
  const [teamMembers, setTeamMembers] = useState<Array<{ 
    user: User; 
    checkIn: string; 
    checkOut: string; 
    availability: string 
  }>>([]);
  const [commonCheckIn, setCommonCheckIn] = useState('');
  const [commonCheckOut, setCommonCheckOut] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showUserSelect, setShowUserSelect] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState<Set<number>>(new Set());

  // Set current user as default for individual booking
  useEffect(() => {
    if (user && bookingType === 'individual') {
      setSelectedUserId(user.id);
    }
  }, [user, bookingType]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [citiesData, usersData] = await Promise.all([
        apiService.getCities(),
        apiService.getAllUsers(),
      ]);
      setCities(citiesData);
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addTeamMember = (selectedUser: User) => {
    const exists = teamMembers.some(member => member.user.id === selectedUser.id);
    if (!exists) {
      setTeamMembers([...teamMembers, {
        user: selectedUser,
        checkIn: commonCheckIn,
        checkOut: commonCheckOut,
        availability: 'available'
      }]);
    }
    setShowUserSelect(false);
    setSearchTerm('');
  };

  const removeTeamMember = (userId: number) => {
    setTeamMembers(teamMembers.filter(member => member.user.id !== userId));
  };

  const updateMemberDateTime = async (userId: number, field: 'checkIn' | 'checkOut', value: string) => {
    setTeamMembers(teamMembers.map(member => 
      member.user.id === userId ? { ...member, [field]: value } : member
    ));

    // Check availability for this member
    const member = teamMembers.find(m => m.user.id === userId);
    if (member && selectedCity) {
      const checkIn = field === 'checkIn' ? value : member.checkIn;
      const checkOut = field === 'checkOut' ? value : member.checkOut;
      
      if (checkIn && checkOut) {
        await checkMemberAvailability(userId, checkIn, checkOut);
      }
    }
  };

  const checkMemberAvailability = async (userId: number, checkIn: string, checkOut: string) => {
    if (!selectedCity) return;

    try {
      setCheckingAvailability(prev => new Set(prev).add(userId));
      const response = await apiService.checkAvailability(selectedCity, {
        checkInTime: checkIn,
        checkOutTime: checkOut
      });
      
      let availability = 'available';
      if (response.availableBeds === 0) availability = 'unavailable';
      else if (response.availableBeds <= 3) availability = 'few left';

      setTeamMembers(prev => prev.map(member => 
        member.user.id === userId ? { ...member, availability } : member
      ));
    } catch (error) {
      console.error('Failed to check availability:', error);
    } finally {
      setCheckingAvailability(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const applyCommonDateTime = async () => {
    if (commonCheckIn && commonCheckOut) {
      setTeamMembers(teamMembers.map(member => ({
        ...member,
        checkIn: commonCheckIn,
        checkOut: commonCheckOut
      })));

      // Check availability for all members
      if (selectedCity) {
        for (const member of teamMembers) {
          await checkMemberAvailability(member.user.id, commonCheckIn, commonCheckOut);
        }
      }
    }
  };

  const checkIndividualAvailability = async () => {
    if (!selectedCity || !commonCheckIn || !commonCheckOut) return;

    try {
      const response = await apiService.checkAvailability(selectedCity, {
        checkInTime: commonCheckIn,
        checkOutTime: commonCheckOut
      });
      
      // You can show this availability to the user
      console.log('Available beds:', response.availableBeds);
    } catch (error) {
      console.error('Failed to check availability:', error);
    }
  };

  useEffect(() => {
    if (bookingType === 'individual' && commonCheckIn && commonCheckOut) {
      checkIndividualAvailability();
    }
  }, [commonCheckIn, commonCheckOut, selectedCity, bookingType]);

  const validateBookingDates = (checkIn: string, checkOut: string) => {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const now = new Date();
    const maxAdvanceDate = new Date();
    maxAdvanceDate.setMonth(maxAdvanceDate.getMonth() + 1);
    const minAdvanceDate = new Date();
    minAdvanceDate.setDate(minAdvanceDate.getDate() + 1);

    // Check if check-out is after check-in
    if (checkOutDate <= checkInDate) {
      return 'Check-out must be after check-in';
    }

    // Check if booking is within advance limits
    if (checkInDate < minAdvanceDate) {
      return 'Booking must be at least 1 day in advance';
    }

    if (checkInDate > maxAdvanceDate) {
      return 'Booking cannot be more than 1 month in advance';
    }

    // Check if duration is within 2 weeks
    const diffTime = checkOutDate.getTime() - checkInDate.getTime();
    const diffDays = diffTime / (1000 * 3600 * 24);
    if (diffDays > 14) {
      return 'Booking duration cannot exceed 2 weeks';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCity || !user) return;

    // For individual booking, ensure a user is selected
    if (bookingType === 'individual' && !selectedUserId) {
      alert('Please select a user for individual booking');
      return;
    }

    const members = bookingType === 'individual' 
      ? [{ user: users.find(u => u.id === selectedUserId) || user, checkIn: commonCheckIn, checkOut: commonCheckOut, availability: 'available' }]
      : teamMembers;

    if (members.length === 0) return;

    // Validate team booking has at least 2 members
    if (bookingType === 'team' && members.length < 2) {
      alert('Team booking requires at least 2 members');
      return;
    }

    // Validate all dates
    for (const member of members) {
      const validation = validateBookingDates(member.checkIn, member.checkOut);
      if (validation) {
        alert(`${member.user.name}: ${validation}`);
        return;
      }
    }

    try {
      setIsLoading(true);
      
      const bookingMembers = members.map(member => ({
        memberUserId: member.user.id,
        checkInTime: member.checkIn,
        checkOutTime: member.checkOut
      }));

      await apiService.createBooking({
        requesterId: user.id,
        cityId: selectedCity,
        bookingType,
        BookingMembers: bookingMembers
      });

      alert('Your request was submitted successfully');
      // Reset form
      setSelectedCity(null);
      setBookingType('individual');
      setTeamMembers([]);
      setCommonCheckIn('');
      setCommonCheckOut('');
    } catch (error: any) {
      alert(error.message || 'Failed to submit request');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 space-y-6">
        {/* City Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select City *
          </label>
          <select
            value={selectedCity || ''}
            onChange={(e) => setSelectedCity(Number(e.target.value))}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="">Choose a city</option>
            {cities.map(city => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </div>

        {/* Booking Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Booking Type *
          </label>
          <select
            value={bookingType}
            onChange={(e) => setBookingType(e.target.value as 'individual' | 'team')}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="individual">Individual</option>
            <option value="team">Team</option>
          </select>
        </div>

        {/* Common Date Time for Team */}
        {bookingType === 'team' && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              Set Common Check-in & Check-out
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">From:</label>
                <input
                  type="date"
                  value={commonCheckIn.split('T')[0] || ''}
                  onChange={(e) => setCommonCheckIn(e.target.value ? `${e.target.value}T09:00` : '')}
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Time:</label>
                <input
                  type="time"
                  value={commonCheckIn.split('T')[1] || '09:00'}
                  onChange={(e) => setCommonCheckIn(commonCheckIn.split('T')[0] ? `${commonCheckIn.split('T')[0]}T${e.target.value}` : '')}
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">To:</label>
                <input
                  type="date"
                  value={commonCheckOut.split('T')[0] || ''}
                  onChange={(e) => setCommonCheckOut(e.target.value ? `${e.target.value}T18:00` : '')}
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Time:</label>
                <input
                  type="time"
                  value={commonCheckOut.split('T')[1] || '18:00'}
                  onChange={(e) => setCommonCheckOut(commonCheckOut.split('T')[0] ? `${commonCheckOut.split('T')[0]}T${e.target.value}` : '')}
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <button
                type="button"
                onClick={applyCommonDateTime}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              >
                Apply to all
              </button>
            </div>
          </div>
        )}

        {/* Team Members */}
        {bookingType === 'team' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-900">
                Team Members ({teamMembers.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowUserSelect(true)}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50"
              >
                <Plus size={14} />
                <span>Add Team Members</span>
              </button>
            </div>

            <div className="space-y-3">
              {teamMembers.map((member) => (
                <div key={member.user.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{member.user.name}</h4>
                          <p className="text-xs text-gray-500">{member.user.role}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {checkingAvailability.has(member.user.id) ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <StatusBadge status={member.availability} />
                          )}
                          <button
                            type="button"
                            onClick={() => removeTeamMember(member.user.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">From:</label>
                          <input
                            type="date"
                            value={member.checkIn.split('T')[0] || ''}
                            onChange={(e) => updateMemberDateTime(member.user.id, 'checkIn', e.target.value ? `${e.target.value}T09:00` : '')}
                            className="w-full p-2 border border-gray-300 rounded text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Time:</label>
                          <input
                            type="time"
                            value={member.checkIn.split('T')[1] || '09:00'}
                            onChange={(e) => updateMemberDateTime(member.user.id, 'checkIn', `${member.checkIn.split('T')[0]}T${e.target.value}`)}
                            className="w-full p-2 border border-gray-300 rounded text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">To:</label>
                          <input
                            type="date"
                            value={member.checkOut.split('T')[0] || ''}
                            onChange={(e) => updateMemberDateTime(member.user.id, 'checkOut', e.target.value ? `${e.target.value}T18:00` : '')}
                            className="w-full p-2 border border-gray-300 rounded text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Time:</label>
                          <input
                            type="time"
                            value={member.checkOut.split('T')[1] || '18:00'}
                            onChange={(e) => updateMemberDateTime(member.user.id, 'checkOut', `${member.checkOut.split('T')[0]}T${e.target.value}`)}
                            className="w-full p-2 border border-gray-300 rounded text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Individual Date Selection */}
        {bookingType === 'individual' && (
          <div className="space-y-4">
            {/* User Selection for Individual Booking */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select User *
              </label>
              <select
                value={selectedUserId || ''}
                onChange={(e) => setSelectedUserId(Number(e.target.value))}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Choose a user</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} - {u.role}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Date *
              </label>
              <input
                type="date"
                value={commonCheckIn.split('T')[0] || ''}
                onChange={(e) => setCommonCheckIn(e.target.value ? `${e.target.value}T09:00` : '')}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time *
              </label>
              <input
                type="time"
                value={commonCheckIn.split('T')[1] || '09:00'}
                onChange={(e) => setCommonCheckIn(commonCheckIn.split('T')[0] ? `${commonCheckIn.split('T')[0]}T${e.target.value}` : '')}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Date *
              </label>
              <input
                type="date"
                value={commonCheckOut.split('T')[0] || ''}
                onChange={(e) => setCommonCheckOut(e.target.value ? `${e.target.value}T18:00` : '')}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time *
              </label>
              <input
                type="time"
                value={commonCheckOut.split('T')[1] || '18:00'}
                onChange={(e) => setCommonCheckOut(commonCheckOut.split('T')[0] ? `${commonCheckOut.split('T')[0]}T${e.target.value}` : '')}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={isLoading || !selectedCity || (bookingType === 'team' && teamMembers.length < 2)}
            className="w-full flex justify-center items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? <LoadingSpinner size="sm" /> : 'Submit'}
          </button>
        </div>
      </form>

      {/* User Selection Modal */}
      {showUserSelect && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-96 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Add Team Members</h3>
              <button
                onClick={() => setShowUserSelect(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 border-b">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredUsers.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => addTeamMember(u)}
                  disabled={teamMembers.some(member => member.user.id === u.id)}
                  className="w-full text-left p-3 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="text-sm font-medium text-gray-900">{u.name}</div>
                  <div className="text-xs text-gray-500">{u.role}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}