
import pool from '../db.js';
import db from '../db.js';

export const checkAvailability = async (req, res) => {
  const { cityId } = req.params;
  const { checkInTime, checkOutTime } = req.body;

  if (!checkInTime || !checkOutTime) {
    return res.status(400).json({ success: false, message: 'checkInTime and checkOutTime are required' });
  }

  if (new Date(checkOutTime) <= new Date(checkInTime)) {
    return res.status(400).json({ success: false, message: 'checkOutTime must be after checkInTime' });
  }

  try {
    // Query to get all booked beds during the requested period (from approved requests)
    const bookedBedsQuery = `
      SELECT DISTINCT aa.bed_id
      FROM assigned_accommodations aa
      JOIN booking_members bm ON aa.booking_members_id = bm.id
      JOIN requests r ON bm.request_id = r.id
      WHERE aa.city_id = $1
        AND r.status = 'approved'
        AND ($2 < bm.check_out AND $3 > bm.check_in)
        AND aa.bed_id IS NOT NULL
    `;

    // Query to get all beds in the city
    const allBedsQuery = `
      SELECT b.id as bed_id
      FROM beds b
      JOIN rooms r ON b.room_id = r.id
      JOIN flats f ON r.flat_id = f.id
      JOIN apartments a ON f.apartment_id = a.id
      WHERE a.city_id = $1
    `;

    // Query to count pending booking members with overlapping time periods
    const pendingMembersQuery = `
      SELECT COUNT(bm.id) as pending_members_count
      FROM booking_members bm
      JOIN requests r ON bm.request_id = r.id
      WHERE r.city_id = $1
        AND r.status = 'pending'
        AND ($2 < bm.check_out AND $3 > bm.check_in)
    `;

    const [bookedBedsResult, allBedsResult, pendingMembersResult] = await Promise.all([
      pool.query(bookedBedsQuery, [cityId, checkInTime, checkOutTime]),
      pool.query(allBedsQuery, [cityId]),
      pool.query(pendingMembersQuery, [cityId, checkInTime, checkOutTime])
    ]);

    // Calculate available beds
    const totalBeds = allBedsResult.rows.length;
    const bookedBeds = bookedBedsResult.rows.length;
    const pendingMembersCount = parseInt(pendingMembersResult.rows[0].pending_members_count) || 0;

    // Available beds = total beds - booked beds - pending members with overlapping times
    const availableBeds = Math.max(0, totalBeds - bookedBeds - pendingMembersCount);

    return res.status(200).json({
      availableBeds: availableBeds
    });
  } catch (err) {
    console.error('Error checking availability:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getCityAvailability = async (req, res) => {
  const cityId = parseInt(req.params.cityId);
  const { DATES } = req.body;

  try {
    // Validate city exists
    const cityRes = await db.query(
      `SELECT name FROM cities WHERE id = $1`,
      [cityId]
    );
    
    if (cityRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'City not found' });
    }

    const cityName = cityRes.rows[0].name;
    const responseData = [];

    // Process each date range
    for (const dateRange of DATES) {
      const { checkIn, checkOut } = dateRange;
      
      // Get all apartments in the city
      const apartmentsRes = await db.query(
        `SELECT id, name FROM apartments WHERE city_id = $1`,
        [cityId]
      );

      const apartmentsStatus = [];

      for (const apartment of apartmentsRes.rows) {
        // Get ALL flats in the apartment
        const flatsRes = await db.query(
          `SELECT f.id, f.name FROM flats f WHERE f.apartment_id = $1`,
          [apartment.id]
        );

        const flats = [];

        for (const flat of flatsRes.rows) {
          // Check flat availability (entire flat must be free)
          const flatAvailabilityRes = await db.query(
            `SELECT 
              NOT EXISTS (
                SELECT 1 FROM assigned_accommodations aa
                WHERE aa.flat_id = $1
                AND aa.booking_members_id IN (
                  SELECT bm.id FROM booking_members bm
                  JOIN requests r ON r.id = bm.request_id
                  WHERE r.status = 'approved'
                  AND NOT (bm.check_out <= $2 OR bm.check_in >= $3)
                )
              ) as is_available,
              (
                SELECT u.gender 
                FROM assigned_accommodations aa
                JOIN booking_members bm ON bm.id = aa.booking_members_id
                JOIN users u ON u.id = bm.user_id
                JOIN requests r ON r.id = bm.request_id
                WHERE aa.flat_id = $1
                AND r.status = 'approved'
                AND NOT (bm.check_out <= $2 OR bm.check_in >= $3)
                LIMIT 1
              ) as gender
            `,
            [flat.id, new Date(checkIn), new Date(checkOut)]
          );

          const isFlatAvailable = flatAvailabilityRes.rows[0].is_available;
          const flatGender = isFlatAvailable ? null : flatAvailabilityRes.rows[0].gender;

          // Get ALL rooms in the flat
          const roomsRes = await db.query(
            `SELECT r.id, r.name FROM rooms r WHERE r.flat_id = $1`,
            [flat.id]
          );

          const rooms = [];

          for (const room of roomsRes.rows) {
            // Get ALL beds in the room with their availability status
            const bedsRes = await db.query(
              `SELECT 
                b.id, 
                b.name,
                NOT EXISTS (
                  SELECT 1 FROM assigned_accommodations aa
                  WHERE aa.bed_id = b.id
                  AND aa.booking_members_id IN (
                    SELECT bm.id FROM booking_members bm
                    JOIN requests r ON r.id = bm.request_id
                    WHERE r.status = 'approved'
                    AND NOT (bm.check_out <= $2 OR bm.check_in >= $3)
                  )
                ) as is_available
               FROM beds b
               WHERE b.room_id = $1`,
              [room.id, new Date(checkIn), new Date(checkOut)]
            );

            const beds = bedsRes.rows.map(bed => ({
              id: bed.id,
              name: bed.name,
              isAvailable: bed.is_available
            }));

            // Room is available only if ALL beds are available
            const isRoomAvailable = beds.every(bed => bed.isAvailable);

            rooms.push({
              id: room.id,
              name: room.name,
              isAvailable: isRoomAvailable,
              beds
            });
          }

          flats.push({
            id: flat.id,
            name: flat.name,
            isAvailable: isFlatAvailable,
            gender: flatGender,
            rooms
          });
        }

        apartmentsStatus.push({
          id: apartment.id,
          name: apartment.name,
          flats
        });
      }

      responseData.push({
        checkIn,
        checkOut,
        apartmentsStatus
      });
    }

    return res.status(200).json({
      cityId,
      cityName,
      data: responseData
    });

  } catch (error) {
    console.error("Error checking availability:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while checking availability"
    });
  }
};
