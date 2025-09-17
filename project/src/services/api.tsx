interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  gender?: string | null;
  access?: string;
}

interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
}

interface City {
  id: number;
  name: string;
}

interface BookingMember {
  userId: number;
  checkInTime: string;
  checkOutTime: string;
}

interface CreateBookingRequest {
  requesterId: number;
  cityId: number;
  bookingType: 'individual' | 'team';
  BookingMembers: BookingMember[];
}

interface AvailabilityRequest {
  checkInTime: string;
  checkOutTime: string;
}

interface AvailabilityResponse {
  availableBeds: number;
}

class ApiService {
  private baseUrl = 'http://localhost:5001';
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('authToken');
  }

  private async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      defaultHeaders.Authorization = `Bearer ${this.token}`;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(fullUrl, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`
        }));
        throw new Error(errorData.error || errorData.message || 'Request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  removeToken() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  // Auth endpoints
  async getAuthUrl(): Promise<{ url: string }> {
    return this.request('/auth/url', { method: 'GET' });
  }

  async login(code: string): Promise<LoginResponse> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async updateUserGender(userId: number, gender: string): Promise<ApiResponse> {
    return this.request(`/api/users/${userId}/gender`, {
      method: 'PATCH',
      body: JSON.stringify({ gender }),
    });
  }

  // User endpoints
  async getAllUsers(): Promise<User[]> {
    return this.request('/api/users');
  }

  async getCities(): Promise<City[]> {
    return this.request('/api/cities');
  }

  async getBookingTypes(): Promise<{ success: boolean; bookingTypes: string[] }> {
    return this.request('/api/bookings/bookingTypes');
  }

  async checkAvailability(cityId: number, data: AvailabilityRequest): Promise<AvailabilityResponse> {
    return this.request(`/api/availability/check/${cityId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createBooking(data: CreateBookingRequest): Promise<ApiResponse> {
    return this.request('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // User pending requests
  async getUserPendingRequests(userId: number): Promise<ApiResponse> {
    return this.request(`/api/requests/pending/user/${userId}`);
  }

  async cancelUserFromRequest(requestId: number, userId: number): Promise<ApiResponse> {
    return this.request(`/api/requests/${requestId}/user/${userId}`, {
      method: 'PATCH',
    });
  }

  async deleteEntireRequest(requestId: number): Promise<ApiResponse> {
    return this.request(`/api/requests/${requestId}`, {
      method: 'DELETE',
    });
  }

  // User upcoming bookings
  async getUserUpcomingBookings(userId: number): Promise<ApiResponse> {
    return this.request(`/api/bookings/upcoming/user/${userId}`);
  }

  async cancelUserBooking(requestId: number, userId: number): Promise<ApiResponse> {
    return this.request(`/api/bookings/${requestId}/cancel/user/${userId}`, {
      method: 'PATCH',
    });
  }

  // User booking history
  async getUserBookingHistory(userId: number): Promise<ApiResponse> {
    return this.request(`/api/bookings/history/user/${userId}`);
  }

  // Admin endpoints
  async getAllPendingRequests(): Promise<ApiResponse> {
    return this.request('/api/requests');
  }

  async getAvailabilityByCity(cityId: number, dates: any[]): Promise<ApiResponse> {
    return this.request(`/api/availability/city/${cityId}`, {
      method: 'POST',
      body: JSON.stringify({ DATES: dates }),
    });
  }

  // Add these methods to your existing apiService class

// Get all flats by apartment ID
async getFlatsByApartment(apartmentId: number): Promise<ApiResponse> {
  return this.request(`/api/flats/apartment/${apartmentId}`);
}

// Get flat details with rooms and beds
async getFlatDetails(flatId: number): Promise<ApiResponse> {
  return this.request(`/api/flats/${flatId}`);
}


  async approveRequest(requestId: number, data: any): Promise<ApiResponse> {
    return this.request(`/api/requests/${requestId}/approve`, {
      method: 'POST',
      body: data,
    });
  }

  async rejectRequest(requestId: number, remarks: string): Promise<ApiResponse> {
    return this.request(`/api/requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  }

  // Admin booking history
  async getBookingHistory(filters?: Record<string, string>): Promise<ApiResponse> {
    const queryParams = filters ? '?' + new URLSearchParams(filters).toString() : '';
    return this.request(`/api/bookings/history${queryParams}`);
  }

  // Occupancy
  async getOccupancy(filters?: Record<string, string>, dateRange?: any): Promise<ApiResponse> {
    const queryParams = filters ? '?' + new URLSearchParams(filters).toString() : '';
    return this.request(`/api/occupancy${queryParams}`, {
      method: 'POST',
      body: dateRange,
    });
  }

  // Resource management
  async createAccommodation(data: any): Promise<ApiResponse> {
    return this.request('/api/accommodation', {
      method: 'POST',
      body: data,
    });
  }

  async getApartmentsByCity(cityId: number): Promise<ApiResponse> {
    return this.request(`/api/apartments/city/${cityId}`);
  }

  async getCityById(cityId: number): Promise<ApiResponse> {
    return this.request(`/api/cities/${cityId}`);
  }

  async createCity(name: string): Promise<ApiResponse> {
    return this.request('/api/cities', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async updateCity(cityId: number, name: string): Promise<ApiResponse> {
    return this.request(`/api/cities/${cityId}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  }

  async deleteCity(cityId: number): Promise<ApiResponse> {
    return this.request(`/api/cities/${cityId}`, {
      method: 'DELETE',
    });
  }

  async createApartment(data: any): Promise<ApiResponse> {
    return this.request('/api/apartments', {
      method: 'POST',
      body: data,
    });
  }

  async updateApartment(apartmentId: number, data: any): Promise<ApiResponse> {
    return this.request(`/api/apartments/${apartmentId}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteApartment(apartmentId: number): Promise<ApiResponse> {
    return this.request(`/api/apartments/${apartmentId}`, {
      method: 'DELETE',
    });
  }

  async createFlat(data: any): Promise<ApiResponse> {
    return this.request('/api/flats', {
      method: 'POST',
      body: data,
    });
  }

  async updateFlat(flatId: number, name: string): Promise<ApiResponse> {
    return this.request(`/api/flats/${flatId}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  }

  async deleteFlat(flatId: number): Promise<ApiResponse> {
    return this.request(`/api/flats/${flatId}`, {
      method: 'DELETE',
    });
  }

  async createRoom(data: any): Promise<ApiResponse> {
    return this.request('/api/rooms', {
      method: 'POST',
      body: data,
    });
  }

  async updateRoom(roomId: number, data: any): Promise<ApiResponse> {
    return this.request(`/api/rooms/${roomId}`, {
      method: 'PATCH',
      body: data,
    });
  }

  async deleteRoom(roomId: number): Promise<ApiResponse> {
    return this.request(`/api/rooms/${roomId}`, {
      method: 'DELETE',
    });
  }

  // Export booking history to Excel
async exportBookingHistory(filters: {
  city?: string;
  status?: string;
  role?: string;
  search?: string;
  checkIn?: string;
  checkOut?: string;
}): Promise<Blob> {
  const queryParams = new URLSearchParams();
  
  // Add filters as query parameters
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value.trim() !== '') {
      queryParams.append(key, value);
    }
  });

  const response = await fetch(`${this.baseUrl}/api/bookings/history/export?${queryParams.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${this.token}`, // Adjust based on your auth implementation
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }

  return response.blob();
}


// Export occupancy data to Excel
async exportOccupancyData(filters: {
  city?: string;
  apartment?: string;
  status?: string;
}, dateRange?: {
  checkIn: string;
  checkOut: string;
}): Promise<Blob> {
  const queryParams = new URLSearchParams();
  
  // Add filters as query parameters
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value.trim() !== '') {
      queryParams.append(key, value);
    }
  });

  const requestBody = dateRange ? {
    checkIn: dateRange.checkIn,
    checkOut: dateRange.checkOut
  } : undefined;

  const response = await fetch(`${this.baseUrl}/api/occupancy/export?${queryParams.toString()}`, {
    method: 'POST', // Changed to POST since we're sending a body
    headers: {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    },
    ...(requestBody && { body: JSON.stringify(requestBody) }),
  });

  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }

  return response.blob();
}




}

export const apiService = new ApiService();
export default apiService;