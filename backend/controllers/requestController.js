import pool from '../db.js';
import db from '../db.js';

export const getUserPendingRequests = async (req, res) => {
  const { userId } = req.params;
  
  try {
    const query = `
    SELECT 
        r.id as request_id,
        r.booking_type,
        r.timestamp as requested_at,
        r.remarks,
        c.name as city_name,
        -- Requested User details
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role,
        u.gender as user_gender,
        -- Booking Member details
        bm.id as booking_member_id,
        bm.user_id as member_user_id,
        bm.check_in,
        bm.check_out,
        mu.name as member_name,
        mu.email as member_email,
        mu.role as member_role,
        mu.gender as member_gender
        FROM requests r
        JOIN cities c ON r.city_id = c.id
      JOIN users u ON r.user_id = u.id
      LEFT JOIN booking_members bm ON r.id = bm.request_id
      LEFT JOIN users mu ON bm.user_id = mu.id
      WHERE r.status = 'pending'
      AND (r.user_id = $1 OR bm.user_id = $1)
      ORDER BY r.timestamp DESC, r.id, bm.id
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        status: 'pending',
        data: []
      });
    }

    // Group the results by request
    const requestsMap = new Map();

    result.rows.forEach(row => {
      const requestId = row.request_id;
      
      if (!requestsMap.has(requestId)) {
        requestsMap.set(requestId, {
          requestId: row.request_id,
          cityName: row.city_name,
          bookingType: row.booking_type,
          requestedAt: row.requested_at,
          remarks: row.remarks,
          requestedUser: {
            id: row.user_id,
            name: row.user_name,
            mail: row.user_email,
            role: row.user_role,
            gender: row.user_gender
          },
          bookingMembers: []
        });
      }
      
      // Add booking member if exists (for team bookings)
      if (row.booking_member_id) {
        const request = requestsMap.get(requestId);
        request.bookingMembers.push({
          userId: row.member_user_id,
          username: row.member_name,
          role: row.member_role,
          gender: row.member_gender,
          mail: row.member_email,
          checkIn: row.check_in,
          checkOut: row.check_out
        });
      }
    });

    const pendingRequests = Array.from(requestsMap.values());

    return res.status(200).json({
      success: true,
      status: 'pending',
      data: pendingRequests
    });
    
  } catch (err) {
    console.error('Error fetching user pending requests:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pending requests'
    });
  }
};

export const removeUserFromRequest = async (req, res) => {
  const { requestId, userId } = req.params;

  try {
    // First, check if the user exists in the booking members for this request
    const checkUserQuery = `
      SELECT id FROM booking_members 
      WHERE request_id = $1 AND user_id = $2
    `;
    
    const userCheckResult = await pool.query(checkUserQuery, [requestId, userId]);
    
    if (userCheckResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found in booking members for this request'
      });
    }

    // Start a transaction
    await pool.query('BEGIN');

    try {
      // Remove the user from booking_members
      const deleteMemberQuery = `
        DELETE FROM booking_members 
        WHERE request_id = $1 AND user_id = $2
        RETURNING id
      `;
      
      const deleteResult = await pool.query(deleteMemberQuery, [requestId, userId]);

      // Check if there are any remaining booking members for this request
      const remainingMembersQuery = `
        SELECT COUNT(*) as remaining_count 
        FROM booking_members 
        WHERE request_id = $1
      `;
      
      const remainingResult = await pool.query(remainingMembersQuery, [requestId]);
      const remainingCount = parseInt(remainingResult.rows[0].remaining_count);
      console.log('Remaining booking members count:', remainingCount);
      let deletedRequest = false;

      // If no more booking members and it's a team booking, delete the entire request
      if (remainingCount === 0) {
          const deleteRequestQuery = `
            DELETE FROM requests WHERE id = $1 RETURNING id
          `;
          await pool.query(deleteRequestQuery, [requestId]);
          deletedRequest = true;
      }

      await pool.query('COMMIT');

      if (deletedRequest) {
        return res.status(200).json({
          success: true,
          message: 'User removed from booking members and request deleted successfully',
          deletedRequest: true
        });
      } else {
        return res.status(200).json({
          success: true,
          message: 'User removed from booking members successfully',
          deletedRequest: false
        });
      }

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (err) {
    console.error('Error removing user from request:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove user from request'
    });
  }
};

export const getAllPendingRequests = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        r.id AS request_id,
        r.status,
        r.booking_type,
        r.processed_at,
        r.timestamp AS requested_at,

        c.name AS city_name,

        u.id AS requested_user_id,
        u.name AS requested_user_name,
        u.email AS requested_user_email,
        u.role AS requested_user_role,
        u.gender AS requested_user_gender,

        bm.id AS booking_member_id,
        bm.check_in,
        bm.check_out,

        mu.name AS member_name,
        mu.email AS member_email,
        mu.gender AS member_gender

      FROM requests r
      JOIN cities c ON r.city_id = c.id
      JOIN users u ON r.user_id = u.id
      JOIN booking_members bm ON bm.request_id = r.id
      JOIN users mu ON mu.id = bm.user_id
      WHERE r.status = 'pending'
      ORDER BY r.id;
    `);

    const rows = result.rows;

    const groupedRequests = {};

    for (const row of rows) {
      const requestId = row.request_id;

      if (!groupedRequests[requestId]) {
        groupedRequests[requestId] = {
          requestId: requestId,
          city: row.city_name,
          requestedBy: {
            userId: row.requested_user_id,
            name: row.requested_user_name,
            email: row.requested_user_email,
            role: row.requested_user_role,
            gender: row.requested_user_gender
          },
          status: row.status,
          bookingType: row.booking_type,
          requestedAt: row.requested_at,
          bookingMembers: []
        };
      }

      groupedRequests[requestId].bookingMembers.push({
        bookingMemberId: row.booking_member_id,
        name: row.member_name,
        email: row.member_email,
        gender: row.member_gender,
        checkIn: row.check_in,
        checkOut: row.check_out
      });
    }

    const finalData = Object.values(groupedRequests);

    res.status(200).json({
      success: true,
      data: finalData
    });

  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteRequest = async (req, res) => {
  const { requestId } = req.params;

  try {
    const deleteRequestQuery = `
      DELETE FROM requests WHERE id = $1 RETURNING id
    `;
    
    const result = await pool.query(deleteRequestQuery, [requestId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Request deleted successfully'
    });

  } catch (err) {
    console.error('Error deleting request:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete request'
    });
  }
};

export const approveRequest = async (req, res) => {
  const requestId = parseInt(req.params.requestId);
  const { allocatedAccommodation = [] } = req.body;

  if (!requestId || !Array.isArray(allocatedAccommodation)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid request parameters' 
    });
  }

  const client = await db.connect(); // Get a DB client for transactions

  try {
    await client.query('BEGIN'); // Start transaction

    // 1. Validate and lock the request
    const requestRes = await client.query(
      `SELECT id, city_id, status 
       FROM requests 
       WHERE id = $1 
       FOR UPDATE`, // Lock row for update
      [requestId]
    );

    if (requestRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        message: 'Request not found' 
      });
    }

    const request = requestRes.rows[0];
    
    if (request.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        success: false, 
        message: 'Request already processed' 
      });
    }

    // 2. Validate all booking members belong to this request
    const bookingMemberIds = allocatedAccommodation.map(a => a.bookingMemberId);
    const membersRes = await client.query(
      `SELECT id FROM booking_members 
       WHERE id = ANY($1::int[]) 
       AND request_id = $2`,
      [bookingMemberIds, requestId]
    );

    if (membersRes.rows.length !== allocatedAccommodation.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking member assignments' 
      });
    }

    // 3. Process accommodations
    for (const allocation of allocatedAccommodation) {
      const { bookingMemberId, assignedAccommodation } = allocation;
      const { apartmentId, flatId, roomId, bedId } = assignedAccommodation;

      // Validate accommodation hierarchy
      if (bedId && !roomId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          message: 'Bed assignment requires room ID' 
        });
      }

      if (roomId && !flatId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          message: 'Room assignment requires flat ID' 
        });
      }

      // Insert assignment
      await client.query(
        `INSERT INTO assigned_accommodations (
          booking_members_id,
          city_id,
          apartment_id,
          flat_id,
          room_id,
          bed_id
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          bookingMemberId,
          request.city_id,
          apartmentId || null,
          flatId || null,
          roomId || null,
          bedId || null
        ]
      );
    }

    // 4. Update request status
    const processedAt = new Date();
    await client.query(
      `UPDATE requests
       SET status = 'approved', 
           processed_at = $1,
           remarks = $2
       WHERE id = $3`,
      [processedAt, req.body.remarks || null, requestId]
    );

    // 5. Update booking members status to 'approved'
    await client.query(
      `UPDATE booking_members 
       SET status = 'approved'
       WHERE request_id = $1`,
      [requestId]
    );

    await client.query('COMMIT'); // Commit transaction

    // 6. Send notifications (could be moved to background job)
    // await sendApprovalNotifications(requestId);

    return res.status(200).json({
      success: true,
      message: "Request approved successfully",
      data: {
        requestId,
        processedAt,
        assignedCount: allocatedAccommodation.length
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error approving request:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while processing request",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release(); // Release client back to pool
  }
};

export const rejectRequest = async (req, res) => {
  const requestId = parseInt(req.params.requestId);
  const { remarks } = req.body;

  // Validate mandatory remarks
  if (!remarks || remarks.trim().length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'Remarks are mandatory when rejecting a request' 
    });
  }

  const client = await db.connect(); // Get a DB client for transaction

  try {
    await client.query('BEGIN'); // Start transaction

    // 1. Validate and lock the request
    const requestRes = await client.query(
      `SELECT id, status, booking_type 
       FROM requests 
       WHERE id = $1 
       FOR UPDATE`, // Lock row for update
      [requestId]
    );

    if (requestRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        message: 'Request not found' 
      });
    }

    const request = requestRes.rows[0];
    
    if (request.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        success: false, 
        message: 'Request already processed' 
      });
    }

    // 2. Update request status to rejected
    const processedAt = new Date();
    await client.query(
      `UPDATE requests
       SET status = 'rejected', 
           processed_at = $1,
           remarks = $2
       WHERE id = $3`,
      [processedAt, remarks, requestId]
    );

    // 3. Update booking_members status to rejected for all members in this request
    await client.query(
      `UPDATE booking_members 
       SET status = 'rejected'
       WHERE request_id = $1`,
      [requestId]
    );

    await client.query('COMMIT'); // Commit transaction

    // 4. Send rejection notification (could be moved to background job)
    // await sendRejectionNotification(requestId, remarks);

    return res.status(200).json({
      success: true,
      message: "Request rejected successfully",
      data: {
        requestId,
        processedAt,
        remarks,
        bookingType: request.booking_type
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error rejecting request:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while processing rejection",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release(); // Release client back to pool
  }
};




