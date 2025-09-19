import pool from '../db.js';
import db from '../db.js';
import { sendMail } from "../utils/mailer.js";

export const approveRequest = async (req, res) => {
  const requestId = parseInt(req.params.requestId);
  const { allocatedAccommodation = [] } = req.body;

  if (!requestId || !Array.isArray(allocatedAccommodation)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid request parameters' 
    });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // 1. Lock and validate request
    const requestRes = await client.query(
      `SELECT id, city_id, status 
       FROM requests 
       WHERE id = $1 FOR UPDATE`,
      [requestId]
    );

    if (requestRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const request = requestRes.rows[0];
    if (request.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Request already processed' });
    }

    // 2. Validate members
    const bookingMemberIds = allocatedAccommodation.map(a => a.bookingMemberId);
    const membersRes = await client.query(
      `SELECT bm.id, bm.user_id, u.email, u.name
       FROM booking_members bm
       JOIN users u ON u.id = bm.user_id
       WHERE bm.id = ANY($1::int[]) AND bm.request_id = $2`,
      [bookingMemberIds, requestId]
    );

    if (membersRes.rows.length !== allocatedAccommodation.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Invalid booking member assignments' });
    }

    const memberMap = Object.fromEntries(
      membersRes.rows.map(m => [m.id, m]) // Map bookingMemberId → user details
    );

    // 3. Process allocations
    const assignedDetails = [];

    for (const allocation of allocatedAccommodation) {
      const { bookingMemberId, assignedAccommodation } = allocation;
      const { apartmentId, flatId, roomId, bedId } = assignedAccommodation;

      if (bedId && !roomId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Bed assignment requires room ID' });
      }

      if (roomId && !flatId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Room assignment requires flat ID' });
      }

      // Insert into DB
      await client.query(
        `INSERT INTO assigned_accommodations (
          booking_members_id, city_id, apartment_id, flat_id, room_id, bed_id
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [bookingMemberId, request.city_id, apartmentId || null, flatId || null, roomId || null, bedId || null]
      );

      // Fetch accommodation names for email
      const accRes = await client.query(`
        SELECT 
          c.name AS city, a.name AS apartment, f.name AS flat, r.name AS room, b.name AS bed
        FROM cities c
        LEFT JOIN apartments a ON a.id = $2
        LEFT JOIN flats f ON f.id = $3
        LEFT JOIN rooms r ON r.id = $4
        LEFT JOIN beds b ON b.id = $5
        WHERE c.id = $1
      `, [request.city_id, apartmentId, flatId, roomId, bedId]);

      const acc = accRes.rows[0];
      assignedDetails.push({
        user: memberMap[bookingMemberId],
        accommodation: acc
      });
    }

    // 4. Update statuses
    const processedAt = new Date();
    await client.query(
      `UPDATE requests SET status = 'approved', processed_at = $1, remarks = $2 WHERE id = $3`,
      [processedAt, req.body.remarks || null, requestId]
    );

    await client.query(
      `UPDATE booking_members SET status = 'approved' WHERE request_id = $1`,
      [requestId]
    );

    await client.query('COMMIT');

    // 5. Send polite emails
    for (const detail of assignedDetails) {
      const { user, accommodation } = detail;
      const emailHtml = `
        <p>Dear ${user.name},</p>
        <p>We are delighted to inform you that your accommodation request has been <b>approved</b>.</p>
        <p><b>Accommodation Details:</b></p>
        <ul>
          <li>City: ${accommodation.city || 'N/A'}</li>
          <li>Apartment: ${accommodation.apartment || 'N/A'}</li>
          <li>Flat: ${accommodation.flat || 'N/A'}</li>
          <li>Room: ${accommodation.room || 'N/A'}</li>
          <li>Bed: ${accommodation.bed || 'N/A'}</li>
        </ul>
        <p>Please ensure to check in as per your allocated schedule. If you have any questions, feel free to reach out.</p>
        <p>Wishing you a pleasant stay,<br/>Accommodation Management Team</p>
      `;

      await sendMail({
        to: user.email,
        subject: "Accommodation Request Approved",
        html: emailHtml
      });
    }

    return res.status(200).json({
      success: true,
      message: "Request approved successfully and notifications sent",
      data: { requestId, processedAt, assignedCount: allocatedAccommodation.length }
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
    client.release();
  }
};

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
    // 1. Check if the user exists in booking members for this request
    const checkUserQuery = `
      SELECT bm.id, u.name, u.email, r.id AS request_id, ru.name AS requester_name
      FROM booking_members bm
      JOIN users u ON bm.user_id = u.id
      JOIN requests r ON bm.request_id = r.id
      JOIN users ru ON r.user_id = ru.id
      WHERE bm.request_id = $1 AND bm.user_id = $2
    `;
    const userCheckResult = await pool.query(checkUserQuery, [requestId, userId]);

    if (userCheckResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found in booking members for this request",
      });
    }

    const removedUser = userCheckResult.rows[0];

    // Start a transaction
    await pool.query("BEGIN");

    let deletedRequest = false;

    try {
      // 2. Remove the user from booking_members
      const deleteMemberQuery = `
        DELETE FROM booking_members 
        WHERE request_id = $1 AND user_id = $2
        RETURNING id
      `;
      await pool.query(deleteMemberQuery, [requestId, userId]);

      // 3. Check remaining booking members
      const remainingMembersQuery = `
        SELECT u.email, u.name
        FROM booking_members bm
        JOIN users u ON bm.user_id = u.id
        WHERE bm.request_id = $1
      `;
      const remainingResult = await pool.query(remainingMembersQuery, [requestId]);
      const remainingMembers = remainingResult.rows;

      // If no more booking members → delete the request
      if (remainingMembers.length === 0) {
        const deleteRequestQuery = `
          DELETE FROM requests WHERE id = $1 RETURNING id
        `;
        await pool.query(deleteRequestQuery, [requestId]);
        deletedRequest = true;
      }

      await pool.query("COMMIT");

      // 4. Send notifications
      if (deletedRequest) {
        // Notify removed user + requester (since whole request deleted)
        await sendMail({
          to: removedUser.email,
          subject: "Accommodation Request Canceled",
          html: `
            <p>Dear ${removedUser.name},</p>
            <p>The accommodation request you were part of has been canceled by <b>${removedUser.requester_name}</b>.</p>
            <p>Regards,<br/>Accommodation Team</p>
          `,
        });

        // Notify all other members (in case they existed before removal)
        for (const member of remainingMembers) {
          await sendMail({
            to: member.email,
            subject: "Accommodation Request Canceled",
            html: `
              <p>Dear ${member.name},</p>
              <p>The accommodation request has been canceled by <b>${removedUser.requester_name}</b>.</p>
              <p>Regards,<br/>Accommodation Team</p>
            `,
          });
        }

        return res.status(200).json({
          success: true,
          message: "User removed and request deleted. Notifications sent.",
          deletedRequest: true,
        });
      } else {
        // Notify only the removed user
        await sendMail({
          to: removedUser.email,
          subject: "Removed from Accommodation Request",
          html: `
            <p>Dear ${removedUser.name},</p>
            <p>You have been removed from the accommodation request by <b>${removedUser.requester_name}</b>.</p>
            <p>Regards,<br/>Accommodation Team</p>
          `,
        });

        return res.status(200).json({
          success: true,
          message: "User removed from booking members successfully. Notification sent.",
          deletedRequest: false,
        });
      }
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  } catch (err) {
    console.error("Error removing user from request:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to remove user from request",
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
    // 1. Check if request exists
    const requestCheckQuery = `
      SELECT r.id, u.name AS requester_name, u.email AS requester_email
      FROM requests r
      JOIN users u ON r.user_id = u.id
      WHERE r.id = $1
    `;
    const requestResult = await pool.query(requestCheckQuery, [requestId]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }

    const request = requestResult.rows[0];

    // 2. Fetch all booking members linked to this request
    const membersQuery = `
      SELECT u.email, u.name
      FROM booking_members bm
      JOIN users u ON bm.user_id = u.id
      WHERE bm.request_id = $1
    `;
    const membersResult = await pool.query(membersQuery, [requestId]);
    const members = membersResult.rows;

    // 3. Delete the request
    const deleteRequestQuery = `
      DELETE FROM requests WHERE id = $1 RETURNING id
    `;
    const deleteResult = await pool.query(deleteRequestQuery, [requestId]);

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }

    // 4. Notify booking members via email
    if (members.length > 0) {
      for (const member of members) {
        await sendMail({
          to: member.email,
          subject: "Accommodation Request Canceled",
          html: `
            <p>Dear ${member.name},</p>
            <p>The accommodation request that included you has been canceled by <b>${request.requester_name}</b>.</p>
            <p>If you have any questions, please reach out to the Accommodation Team.</p>
            <br/>
            <p>Best Regards,<br/>Accommodation Team</p>
          `,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Request deleted successfully and members notified",
    });
  } catch (err) {
    console.error("Error deleting request:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete request",
    });
  }
};

export const rejectRequest = async (req, res) => {
  const requestId = parseInt(req.params.requestId);
  const { remarks } = req.body;

  if (!remarks || remarks.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Remarks are mandatory when rejecting a request'
    });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // 1. Lock request
    const requestRes = await client.query(
      `SELECT id, status, booking_type
       FROM requests
       WHERE id = $1
       FOR UPDATE`,
      [requestId]
    );

    if (requestRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const request = requestRes.rows[0];
    if (request.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Request already processed' });
    }

    // 2. Fetch booking members + users (so we can notify them all)
    const membersRes = await client.query(
      `SELECT bm.id, u.email, u.name
       FROM booking_members bm
       JOIN users u ON u.id = bm.user_id
       WHERE bm.request_id = $1`,
      [requestId]
    );

    // 3. Update statuses
    const processedAt = new Date();
    await client.query(
      `UPDATE requests
       SET status = 'rejected', processed_at = $1, remarks = $2
       WHERE id = $3`,
      [processedAt, remarks, requestId]
    );

    await client.query(
      `UPDATE booking_members
       SET status = 'rejected'
       WHERE request_id = $1`,
      [requestId]
    );

    await client.query('COMMIT');

    // 4. Send polite rejection emails
    for (const member of membersRes.rows) {
      const emailHtml = `
        <p>Dear ${member.name},</p>
        <p>We regret to inform you that your accommodation request has been <b>rejected</b>.</p>
        <p><b>Reason:</b> ${remarks}</p>
        <p>If you need further assistance, please reach out to our support team.</p>
        <p>Thank you for your understanding,<br/>Accommodation Management Team</p>
      `;

      await sendMail({
        to: member.email,
        subject: "Accommodation Request Rejected",
        html: emailHtml
      });
    }

    return res.status(200).json({
      success: true,
      message: "Request rejected successfully and notifications sent",
      data: { requestId, processedAt, remarks, bookingType: request.booking_type }
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
    client.release();
  }
};




