import pool from "../db.js";
import ExcelJS from 'exceljs';

export const getBookingTypes = async (req, res) => {
  try {
    // Query to get enum values from PostgreSQL
    const query = `
      SELECT unnest(enum_range(NULL::booking_type)) AS booking_type;
    `;

    const result = await pool.query(query);
    
    // Extract the enum values from the result
    const bookingTypes = result.rows.map(row => row.booking_type);
    
    return res.status(200).json({
      success: true,
      bookingTypes: bookingTypes
    });
  } catch (err) {
    console.error('Error fetching booking types:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch booking types'
    });
  }
};

export const createBooking = async (req, res) => {
  const client = await pool.connect();

  try {
    const { requesterId, cityId, bookingType, BookingMembers } = req.body;

    await client.query("BEGIN");
    
    // 1. Check for overlapping accommodations for each booking member
    for (const member of BookingMembers) {
      const { memberUserId, checkInTime, checkOutTime } = member;
      
      const overlapCheck = await client.query(
        `SELECT COUNT(*) 
         FROM assigned_accommodations aa
         JOIN booking_members bm ON aa.booking_members_id = bm.id
         WHERE bm.user_id = $1 
         AND (
           (bm.check_in <= $3 AND bm.check_out >= $2) OR
           (bm.check_in >= $2 AND bm.check_in <= $3) OR
           (bm.check_out >= $2 AND bm.check_out <= $3)
         )
         AND bm.status IN ('approved', 'accommodated')`,
        [memberUserId, checkInTime, checkOutTime]
      );

      if (parseInt(overlapCheck.rows[0].count) > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: `User ${memberUserId} already has an active or upcoming accommodation during the requested time period`
        });
      }

      // Optional: Also check for overlapping pending requests
      const pendingOverlapCheck = await client.query(
        `SELECT COUNT(*) 
         FROM booking_members 
         WHERE user_id = $1 
         AND status = 'pending'
         AND (
           (check_in <= $3 AND check_out >= $2) OR
           (check_in >= $2 AND check_in <= $3) OR
           (check_out >= $2 AND check_out <= $3)
         )`,
        [memberUserId, checkInTime, checkOutTime]
      );

      if (parseInt(pendingOverlapCheck.rows[0].count) > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: `User ${memberUserId} already has a pending request for the same time period`
        });
      }
    }

    // 2. Insert into requests table
    const requestRes = await client.query(
      `INSERT INTO requests (user_id, city_id, booking_type)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [requesterId, cityId, bookingType]
    );
    
    const requestId = requestRes.rows[0].id;
    
    // 3. Insert each booking member into booking_members
    for (const member of BookingMembers) {
      const { memberUserId, checkInTime, checkOutTime } = member;
      
      await client.query(
        `INSERT INTO booking_members (request_id, user_id, check_in, check_out, status)
        VALUES ($1, $2, $3, $4, 'pending')`,
        [requestId, memberUserId, checkInTime, checkOutTime]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Booking request submitted successfully.",
      requestId,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Booking error:", err);
    res.status(500).json({ success: false, error: "Failed to create booking request" });
  } finally {
    client.release();
  }
};

export const getUserUpcomingBookings = async (req, res) => {
  const { userId } = req.params;
  const currentDate = new Date().toISOString();

  try {
    const query = `
    SELECT 
    r.id AS request_id,
    r.booking_type,
    r.timestamp AS requested_at,
    c.name AS city_name,
        ru.id AS requester_id,
        ru.name AS requester_name,
        ru.email AS requester_email,
        ru.role AS requester_role,
        ru.gender AS requester_gender,
        bm.id AS member_id,
        bm.check_in,
        bm.check_out,
        mu.id AS member_user_id,
        mu.name AS member_name,
        mu.email AS member_email,
        mu.role AS member_role,
        mu.gender AS member_gender,
        aa.apartment_id,
        apt.name AS apartment_name,
        aa.flat_id,
        f.name AS flat_name,
        aa.room_id,
        ro.name AS room_name,
        aa.bed_id,
        b.name AS bed_name
      FROM booking_members bm
      JOIN requests r ON r.id = bm.request_id
      JOIN cities c ON c.id = r.city_id
      JOIN users ru ON ru.id = r.user_id
      JOIN users mu ON mu.id = bm.user_id
      LEFT JOIN assigned_accommodations aa ON aa.booking_members_id = bm.id
      LEFT JOIN apartments apt ON apt.id = aa.apartment_id
      LEFT JOIN flats f ON f.id = aa.flat_id
      LEFT JOIN rooms ro ON ro.id = aa.room_id
      LEFT JOIN beds b ON b.id = aa.bed_id
      WHERE r.status = 'approved'
        AND bm.user_id = $1
        AND bm.check_in > $2
      ORDER BY bm.check_in ASC
      `;

    const { rows } = await pool.query(query, [userId, currentDate]);
    
    const bookingsMap = new Map();

    for (const row of rows) {
      if (!bookingsMap.has(row.request_id)) {
        bookingsMap.set(row.request_id, {
          requestId: row.request_id,
          cityName: row.city_name,
          bookingType: row.booking_type,
          requestedAt: row.requested_at,
          requestedUser: {
            id: row.requester_id,
            name: row.requester_name,
            mail: row.requester_email,
            role: row.requester_role,
            gender: row.requester_gender
          },
          bookingMembers: []
        });
      }

      const booking = bookingsMap.get(row.request_id);
      
      // Add the booking member (this will be the user themselves since we filtered by bm.user_id)
      booking.bookingMembers.push({
        userId: row.member_user_id,
        username: row.member_name,
        role: row.member_role,
        gender: row.member_gender,
        mail: row.member_email,
        checkIn: row.check_in,
        checkOut: row.check_out,
        accommodation: {
          apartment: row.apartment_id ? { 
            id: row.apartment_id, 
            name: row.apartment_name 
          } : null,
          flat: row.flat_id ? { 
            id: row.flat_id, 
            name: row.flat_name 
          } : null,
          room: row.room_id ? { 
            id: row.room_id, 
            name: row.room_name 
          } : null,
          bed: row.bed_id ? { 
            id: row.bed_id, 
            name: row.bed_name 
          } : null
        }
      });
    }

    return res.status(200).json({
      success: true,
      status: 'approved',
      data: Array.from(bookingsMap.values())
    });

  } catch (error) {
    console.error('Error fetching upcoming bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const cancelBooking = async (req, res) => {
  const { requestId, userId } = req.params;

  try {
    await pool.query('BEGIN');

    // 1. Get request details with FOR UPDATE lock
    const requestQuery = `
      SELECT id, booking_type 
      FROM requests 
      WHERE id = $1 AND status = 'approved'
      FOR UPDATE
      `;
      const requestResult = await pool.query(requestQuery, [requestId]);
      
      if (requestResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Approved booking not found'
      });
    }

    const request = requestResult.rows[0];

    // 2. Find the member's booking
    const memberQuery = `
    SELECT id FROM booking_members
    WHERE request_id = $1 AND user_id = $2 AND status != 'cancelled'
    `;
    const memberResult = await pool.query(memberQuery, [requestId, userId]);
    
    if (memberResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Active user booking not found'
      });
    }

    const memberId = memberResult.rows[0].id;

    // 3. Release accommodation
    await pool.query(
      'DELETE FROM assigned_accommodations WHERE booking_members_id = $1',
      [memberId]
    );

    // 4. Update member status to cancelled (instead of deleting)
    await pool.query(
      `UPDATE booking_members SET status = 'cancelled' WHERE id = $1`,
      [memberId]
    );

    // 5. Check if all members are cancelled, then cancel entire request
    const activeMembersQuery = `
    SELECT COUNT(*) FROM booking_members 
    WHERE request_id = $1 AND status != 'cancelled'
    `;
    const activeResult = await pool.query(activeMembersQuery, [requestId]);
    
    if (activeResult.rows[0].count === '0') {
      await pool.query(
        `UPDATE requests SET status = 'cancelled', processed_at = NOW() 
         WHERE id = $1`,
         [requestId]
      );
    }

    await pool.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully'
    });

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error cancelling booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getUserBookingHistory = async (req, res) => {
  const { userId } = req.params;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const now = new Date();

    // 1. First update booking member statuses based on current time for this specific user
    await client.query(
      `UPDATE booking_members 
       SET status = 'accommodated'
       WHERE user_id = $1
       AND status IN ('approved')
       AND check_in <= $2 AND check_out > $2`,
      [userId, now]
    );

    await client.query(
      `UPDATE booking_members 
       SET status = 'completed'
       WHERE user_id = $1
       AND status IN ('approved', 'accommodated')
       AND check_out <= $2`,
      [userId, now]
    );

    // 2. Now fetch the updated booking history
    const query = `
      SELECT 
        r.id AS request_id,
        r.status AS request_status,
        r.booking_type,
        r.timestamp AS requested_at,
        r.processed_at,
        r.remarks,
        c.id AS city_id,
        c.name AS city_name,
        ru.id AS requester_id,
        ru.name AS requester_name,
        ru.email AS requester_email,
        ru.role AS requester_role,
        ru.gender AS requester_gender,
        bm.id AS member_id,
        bm.status AS member_status,
        bm.check_in,
        bm.check_out,
        mu.id AS member_user_id,
        mu.name AS member_name,
        mu.email AS member_email,
        mu.role AS member_role,
        mu.gender AS member_gender,
        aa.apartment_id,
        apt.name AS apartment_name,
        aa.flat_id,
        f.name AS flat_name,
        aa.room_id,
        ro.name AS room_name,
        aa.bed_id,
        b.name AS bed_name
      FROM booking_members bm
      JOIN requests r ON r.id = bm.request_id
      JOIN cities c ON c.id = r.city_id
      JOIN users ru ON ru.id = r.user_id
      JOIN users mu ON mu.id = bm.user_id
      LEFT JOIN assigned_accommodations aa ON aa.booking_members_id = bm.id
      LEFT JOIN apartments apt ON apt.id = aa.apartment_id
      LEFT JOIN flats f ON f.id = aa.flat_id
      LEFT JOIN rooms ro ON ro.id = aa.room_id
      LEFT JOIN beds b ON b.id = aa.bed_id
      WHERE bm.user_id = $1
      AND r.status IN ('approved', 'rejected', 'cancelled', 'accommodated', 'completed')
      ORDER BY r.timestamp DESC
    `;

    const { rows } = await client.query(query, [userId]);

    await client.query('COMMIT');

    const historyMap = new Map();

    for (const row of rows) {
      if (!historyMap.has(row.request_id)) {
        historyMap.set(row.request_id, {
          requestId: row.request_id,
          status: row.request_status,
          processedAt: row.processed_at,
          remarks: row.remarks,
          city: {
            id: row.city_id,
            name: row.city_name
          },
          requestedAt: row.requested_at,
          bookingType: row.booking_type,
          requestedUser: {
            id: row.requester_id,
            name: row.requester_name,
            email: row.requester_email,
            role: row.requester_role,
            gender: row.requester_gender
          },
          bookingMembers: []
        });
      }

      const booking = historyMap.get(row.request_id);
      
      // Add the booking member with their individual status
      booking.bookingMembers.push({
        userId: row.member_user_id,
        name: row.member_name,
        email: row.member_email,
        role: row.member_role,
        gender: row.member_gender,
        status: row.member_status,
        checkIn: row.check_in,
        checkOut: row.check_out,
        accommodation: {
          apartment: row.apartment_id ? { 
            id: row.apartment_id, 
            name: row.apartment_name 
          } : null,
          flat: row.flat_id ? { 
            id: row.flat_id, 
            name: row.flat_name 
          } : null,
          room: row.room_id ? { 
            id: row.room_id, 
            name: row.room_name 
          } : null,
          bed: row.bed_id ? { 
            id: row.bed_id, 
            name: row.bed_name 
          } : null
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: "User booking history retrieved with automatic status updates",
      data: Array.from(historyMap.values())
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error fetching user booking history:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};

export const getBookingHistory = async (req, res) => {
  const { city, status, role, search, checkIn, checkOut } = req.query;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. First update booking member statuses based on current time
    const now = new Date();
    
    // Update booking members to 'accommodated' where check-in passed but check-out not reached
    await client.query(
      `UPDATE booking_members 
       SET status = 'accommodated'
       WHERE status IN ('approved')
       AND check_in <= $1 AND check_out > $1`,
      [now]
    );

    // Update booking members to 'completed' where check-out has passed
    await client.query(
      `UPDATE booking_members 
       SET status = 'completed'
       WHERE status IN ('approved', 'accommodated')
       AND check_out <= $1`,
      [now]
    );

    // 2. Update request statuses based on all booking members' statuses
    const requestUpdateQuery = `
      WITH member_statuses AS (
        SELECT 
          request_id,
          COUNT(*) as total_members,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
          COUNT(CASE WHEN status = 'accommodated' THEN 1 END) as accommodated_count,
          COUNT(CASE WHEN status IN ('pending', 'approved') THEN 1 END) as pending_count
        FROM booking_members
        GROUP BY request_id
      )
      UPDATE requests r
      SET status = CASE 
        WHEN ms.completed_count = ms.total_members THEN 'completed'
        WHEN ms.accommodated_count = ms.total_members THEN 'accommodated'
        WHEN ms.accommodated_count > 0 AND ms.pending_count = 0 THEN 'accommodated'
        ELSE r.status
      END,
      processed_at = CASE 
        WHEN ms.completed_count = ms.total_members AND r.processed_at IS NULL THEN $1
        WHEN ms.accommodated_count = ms.total_members AND r.processed_at IS NULL THEN $1
        ELSE r.processed_at
      END
      FROM member_statuses ms
      WHERE r.id = ms.request_id
      AND r.status NOT IN ('rejected', 'cancelled')
      AND (
        (ms.completed_count = ms.total_members AND r.status != 'completed') OR
        (ms.accommodated_count = ms.total_members AND r.status != 'accommodated') OR
        (ms.accommodated_count > 0 AND ms.pending_count = 0 AND r.status != 'accommodated')
      )
    `;

    await client.query(requestUpdateQuery, [now]);

    // 3. Now fetch the booking history with updated statuses
    let query = `
      SELECT 
        r.id AS request_id,
        r.status AS request_status,
        r.booking_type,
        r.timestamp AS requested_at,
        r.processed_at,
        r.remarks,
        c.name AS city,
        ru.id AS requester_id,
        ru.name AS requester_name,
        ru.email AS requester_email,
        ru.role AS requester_role,
        ru.gender AS requester_gender,
        
        bm.id AS member_id,
        bm.status AS member_status,
        bm.check_in,
        bm.check_out,
        mu.id AS member_user_id,
        mu.name AS member_name,
        mu.email AS member_email,
        mu.role AS member_role,
        mu.gender AS member_gender,

        aa.apartment_id, apt.name AS apartment_name,
        aa.flat_id, f.name AS flat_name,
        aa.room_id, ro.name AS room_name,
        aa.bed_id, b.name AS bed_name

      FROM requests r
      JOIN users ru ON ru.id = r.user_id
      JOIN cities c ON c.id = r.city_id
      JOIN booking_members bm ON bm.request_id = r.id
      JOIN users mu ON mu.id = bm.user_id
      LEFT JOIN assigned_accommodations aa ON aa.booking_members_id = bm.id
      LEFT JOIN apartments apt ON apt.id = aa.apartment_id
      LEFT JOIN flats f ON f.id = aa.flat_id
      LEFT JOIN rooms ro ON ro.id = aa.room_id
      LEFT JOIN beds b ON b.id = aa.bed_id
      WHERE 1=1
    `;

    const params = [];
    const appliedFilters = {};

    if (city) {
      query += ` AND r.city_id = $${params.length + 1}`;
      params.push(city);
      appliedFilters.city = city;
    }

    if (status) {
      query += ` AND r.status = $${params.length + 1}`;
      params.push(status);
      appliedFilters.status = status;
    }

    if (role) {
      query += ` AND ru.role = $${params.length + 1}`;
      params.push(role);
      appliedFilters.role = role;
    }

    if (search) {
      query += ` AND (LOWER(ru.name) LIKE LOWER($${params.length + 1}) OR LOWER(ru.email) LIKE LOWER($${params.length + 1}) OR LOWER(mu.name) LIKE LOWER($${params.length + 1}))`;
      params.push(`%${search}%`);
      appliedFilters.search = search;
    }

    if (checkIn && checkOut) {
      query += ` AND bm.check_in >= $${params.length + 1} AND bm.check_out <= $${params.length + 2}`;
      params.push(checkIn, checkOut);
      appliedFilters.checkIn = checkIn;
      appliedFilters.checkOut = checkOut;
    }

    query += ` ORDER BY r.timestamp DESC, bm.check_in ASC`;

    const { rows } = await client.query(query, params);

    await client.query('COMMIT');

    // Group by request
    const requestMap = new Map();

    for (const row of rows) {
      if (!requestMap.has(row.request_id)) {
        requestMap.set(row.request_id, {
          requestId: row.request_id,
          city: row.city,
          requestedBy: {
            id: row.requester_id,
            name: row.requester_name,
            email: row.requester_email,
            role: row.requester_role,
            gender: row.requester_gender,
          },
          status: row.request_status,
          bookingType: row.booking_type,
          processedAt: row.processed_at,
          requestedAt: row.requested_at,
          remarks: row.remarks,
          bookingMembers: [],
        });
      }

      const req = requestMap.get(row.request_id);
      
      // Check if this member already exists (for team bookings)
      const existingMember = req.bookingMembers.find(m => m.id === row.member_user_id);
      if (!existingMember) {
        req.bookingMembers.push({
          id: row.member_user_id,
          name: row.member_name,
          email: row.member_email,
          role: row.member_role,
          gender: row.member_gender,
          status: row.member_status,
          checkIn: row.check_in,
          checkOut: row.check_out,
          assignedAccommodation: {
            apartment: row.apartment_name,
            flat: row.flat_name,
            room: row.room_name,
            bed: row.bed_name,
          },
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Booking history retrieved with automatic status updates",
      filters: appliedFilters,
      data: Array.from(requestMap.values()),
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error fetching booking history:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while processing booking history",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    client.release();
  }
};

export const exportBookingHistoryToExcel = async (req, res) => {
  const { city, status, role, search, checkIn, checkOut } = req.query;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. First update booking member statuses based on current time (same as original)
    const now = new Date();
    
    await client.query(
      `UPDATE booking_members 
       SET status = 'accommodated'
       WHERE status IN ('approved', 'pending')
       AND check_in <= $1 AND check_out > $1`,
      [now]
    );

    await client.query(
      `UPDATE booking_members 
       SET status = 'completed'
       WHERE status IN ('approved', 'pending', 'accommodated')
       AND check_out <= $1`,
      [now]
    );

    // 2. Update request statuses based on all booking members' statuses (same as original)
    const requestUpdateQuery = `
      WITH member_statuses AS (
        SELECT 
          request_id,
          COUNT(*) as total_members,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
          COUNT(CASE WHEN status = 'accommodated' THEN 1 END) as accommodated_count,
          COUNT(CASE WHEN status IN ('pending', 'approved') THEN 1 END) as pending_count
        FROM booking_members
        GROUP BY request_id
      )
      UPDATE requests r
      SET status = CASE 
        WHEN ms.completed_count = ms.total_members THEN 'completed'
        WHEN ms.accommodated_count = ms.total_members THEN 'accommodated'
        WHEN ms.accommodated_count > 0 AND ms.pending_count = 0 THEN 'accommodated'
        ELSE r.status
      END,
      processed_at = CASE 
        WHEN ms.completed_count = ms.total_members AND r.processed_at IS NULL THEN $1
        WHEN ms.accommodated_count = ms.total_members AND r.processed_at IS NULL THEN $1
        ELSE r.processed_at
      END
      FROM member_statuses ms
      WHERE r.id = ms.request_id
      AND r.status NOT IN ('rejected', 'cancelled')
      AND (
        (ms.completed_count = ms.total_members AND r.status != 'completed') OR
        (ms.accommodated_count = ms.total_members AND r.status != 'accommodated') OR
        (ms.accommodated_count > 0 AND ms.pending_count = 0 AND r.status != 'accommodated')
      )
    `;

    await client.query(requestUpdateQuery, [now]);

    // 3. Fetch the booking history data (same query as original)
    let query = `
      SELECT 
        r.id AS request_id,
        r.status AS request_status,
        r.booking_type,
        r.timestamp AS requested_at,
        r.processed_at,
        r.remarks,
        c.name AS city,
        ru.id AS requester_id,
        ru.name AS requester_name,
        ru.email AS requester_email,
        ru.role AS requester_role,
        ru.gender AS requester_gender,
        
        bm.id AS member_id,
        bm.status AS member_status,
        bm.check_in,
        bm.check_out,
        mu.id AS member_user_id,
        mu.name AS member_name,
        mu.email AS member_email,
        mu.role AS member_role,
        mu.gender AS member_gender,

        aa.apartment_id, apt.name AS apartment_name,
        aa.flat_id, f.name AS flat_name,
        aa.room_id, ro.name AS room_name,
        aa.bed_id, b.name AS bed_name

      FROM requests r
      JOIN users ru ON ru.id = r.user_id
      JOIN cities c ON c.id = r.city_id
      JOIN booking_members bm ON bm.request_id = r.id
      JOIN users mu ON mu.id = bm.user_id
      LEFT JOIN assigned_accommodations aa ON aa.booking_members_id = bm.id
      LEFT JOIN apartments apt ON apt.id = aa.apartment_id
      LEFT JOIN flats f ON f.id = aa.flat_id
      LEFT JOIN rooms ro ON ro.id = aa.room_id
      LEFT JOIN beds b ON b.id = aa.bed_id
      WHERE 1=1
    `;

    const params = [];
    const appliedFilters = {};

    if (city) {
      query += ` AND r.city_id = $${params.length + 1}`;
      params.push(city);
      appliedFilters.city = city;
    }

    if (status) {
      query += ` AND r.status = $${params.length + 1}`;
      params.push(status);
      appliedFilters.status = status;
    }

    if (role) {
      query += ` AND ru.role = $${params.length + 1}`;
      params.push(role);
      appliedFilters.role = role;
    }

    if (search) {
      query += ` AND (LOWER(ru.name) LIKE LOWER($${params.length + 1}) OR LOWER(ru.email) LIKE LOWER($${params.length + 1}) OR LOWER(mu.name) LIKE LOWER($${params.length + 1}))`;
      params.push(`%${search}%`);
      appliedFilters.search = search;
    }

    if (checkIn && checkOut) {
      query += ` AND bm.check_in >= $${params.length + 1} AND bm.check_out <= $${params.length + 2}`;
      params.push(checkIn, checkOut);
      appliedFilters.checkIn = checkIn;
      appliedFilters.checkOut = checkOut;
    }

    query += ` ORDER BY r.timestamp DESC, bm.check_in ASC`;

    const { rows } = await client.query(query, params);

    await client.query('COMMIT');

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Booking History');

    // Add filter information at the top
    worksheet.addRow(['Booking History Report - Filter Details']);
    worksheet.addRow(['Generated On', new Date().toLocaleString()]);
    worksheet.addRow(['City Filter', appliedFilters.city || 'All Cities']);
    worksheet.addRow(['Status Filter', appliedFilters.status || 'All Statuses']);
    worksheet.addRow(['Role Filter', appliedFilters.role || 'All Roles']);
    worksheet.addRow(['Search Term', appliedFilters.search || 'None']);
    worksheet.addRow(['Check-in Date', appliedFilters.checkIn || 'Any']);
    worksheet.addRow(['Check-out Date', appliedFilters.checkOut || 'Any']);
    worksheet.addRow([]); // Empty row for spacing

    // Add headers
    const headers = [
      'Request ID', 'Request Status', 'Booking Type', 'Requested At', 'Processed At',
      'City', 'Requester Name', 'Requester Email', 'Requester Role', 'Requester Gender',
      'Member Name', 'Member Email', 'Member Role', 'Member Gender', 'Member Status',
      'Check-in', 'Check-out', 'Apartment', 'Flat', 'Room', 'Bed', 'Remarks'
    ];
    
    worksheet.addRow(headers);

    // Style the headers
    const headerRow = worksheet.getRow(10);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data rows
    rows.forEach(row => {
      worksheet.addRow([
        row.request_id,
        row.request_status,
        row.booking_type,
        new Date(row.requested_at).toLocaleString(),
        row.processed_at ? new Date(row.processed_at).toLocaleString() : 'N/A',
        row.city,
        row.requester_name,
        row.requester_email,
        row.requester_role,
        row.requester_gender,
        row.member_name,
        row.member_email,
        row.member_role,
        row.member_gender,
        row.member_status,
        new Date(row.check_in).toLocaleString(),
        new Date(row.check_out).toLocaleString(),
        row.apartment_name || 'N/A',
        row.flat_name || 'N/A',
        row.room_name || 'N/A',
        row.bed_name || 'N/A',
        row.remarks || 'None'
      ]);
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(maxLength + 2, 30);
    });

    // Add some statistics
    const totalRequests = new Set(rows.map(row => row.request_id)).size;
    const totalMembers = rows.length;
    
    worksheet.addRow([]);
    worksheet.addRow(['Statistics']);
    worksheet.addRow(['Total Requests', totalRequests]);
    worksheet.addRow(['Total Booking Members', totalMembers]);

    // Style statistics
    const statsRow1 = worksheet.getRow(worksheet.rowCount - 3);
    const statsRow2 = worksheet.getRow(worksheet.rowCount - 2);
    const statsRow3 = worksheet.getRow(worksheet.rowCount - 1);
    
    [statsRow1, statsRow2, statsRow3].forEach(row => {
      row.font = { bold: true };
    });

    // Set response headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=booking-history-${Date.now()}.xlsx`);

    // Write Excel to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error exporting booking history to Excel:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export booking history to Excel",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    client.release();
  }
};
