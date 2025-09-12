import pool from '../db.js';

export const createBed=async (req, res) => {
  const { name, room_id } = req.body;

  if (!name || !room_id) {
    return res.status(400).json({ success: false, message: "Name and room_id are required" });
  }

  try {
   const result = await pool.query(
  'INSERT INTO beds (name, room_id) VALUES ($1, $2) RETURNING id, name, room_id',
  [name, room_id]
);


    res.status(201).json({
      success: true,
      bed: result.rows[0]
    });
  } catch (error) {
    console.error("Error creating bed:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const editBed=async (req, res) => {
  const bedId = req.params.id;
  const { name } = req.body;

  try {
    const result = await pool.query(
      `UPDATE beds
       SET name = $1
       WHERE id = $2
       RETURNING *`,
      [name, bedId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Bed not found" });
    }

    res.json({
      success: true,
      bed: result.rows[0]
    });
  } catch (error) {
    console.error("Error updating bed:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

export const deleteBed=async (req, res) => {
  const bedId = req.params.id;

  try {
    const result = await pool.query(
      `DELETE FROM beds WHERE id = $1 RETURNING *`,
      [bedId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Bed not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting bed:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

