export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  gender?: string | null;
  accessLevel?: string;
}

export interface City {
  id: number;
  name: string;
}

export interface BookingMember {
  userId: number;
  username?: string;
  role?: string;
  gender?: string;
  mail?: string;
  checkIn?: string;
  checkOut?: string;
  checkInTime?: string;
  checkOutTime?: string;
  accommodation?: {
    apartment?: { id: number; name: string } | null;
    flat?: { id: number; name: string } | null;
    room?: { id: number; name: string } | null;
    bed?: { id: number; name: string } | null;
  };
}

export interface BookingRequest {
  requestId: number;
  cityName: string;
  bookingType: 'individual' | 'team';
  requestedAt: string;
  processedAt?: string;
  remarks?: string | null;
  status?: string;
  requestedUser: User;
  bookingMembers: BookingMember[];
}

export interface PendingRequest {
  requestId: number;
  city: string;
  requestedBy: User;
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

export interface Accommodation {
  id: number;
  name: string;
  isAvailable?: boolean;
  gender?: string;
  rooms?: Room[];
  flats?: Flat[];
  beds?: Bed[];
}

export interface Flat {
  id: number;
  name: string;
  isAvailable?: boolean;
  gender?: string;
  rooms?: Room[];
}

export interface Room {
  id: number;
  name: string;
  isAvailable?: boolean;
  beds?: Bed[];
}

export interface Bed {
  id: number;
  name: string;
  isAvailable?: boolean;
}

export interface AvailabilityResponse {
  cityId: number;
  cityName: string;
  data: Array<{
    checkIn: string;
    checkOut: string;
    apartmentsStatus: Accommodation[];
  }>;
}