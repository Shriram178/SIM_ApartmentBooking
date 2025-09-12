import pool from '../db.js';

export const createUser = async (req, res) => {
  const { name, email, role} = req.body;

  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Name, email, and role are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO users (name, email, role) VALUES ($1, $2, $3) RETURNING *',
      [name, email, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

export const updateUserGender = async (req, res) => {
  const client = await pool.connect();

  try {
    const { userId } = req.params;
    const { gender } = req.body;

    // Validate input
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required"
      });
    }

    if (!gender) {
      return res.status(400).json({
        success: false,
        error: "Gender is required"
      });
    }

    // Validate gender type
    const validGenders = ['male', 'female', 'other'];
    if (!validGenders.includes(gender)) {
      return res.status(400).json({
        success: false,
        error: "Invalid gender. Must be one of: male, female, other"
      });
    }

    // Check if user exists
    const userCheck = await client.query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // Update user gender
    const result = await client.query(
      `UPDATE users 
       SET gender = $1 
       WHERE id = $2 
       RETURNING id, name, email, gender, role, access`,
      [gender, userId]
    );

    res.status(200).json({
      success: true,
      message: "User gender updated successfully",
      data: result.rows[0]
    });

  } catch (err) {
    console.error("Update gender error:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to update user gender" 
    });
  } finally {
    client.release();
  }
};

export const getUserById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching user by ID:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

export const getUserByName = async (req, res) => {
  const { name } = req.params;

  try {
    const result = await pool.query('SELECT * FROM users WHERE LOWER(name) = LOWER($1)', [name]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching user by name:', err);
    res.status(500).json({ error: 'Failed to fetch user(s)' });
  }
};

export const getUsersByRole = async (req, res) => {
  const { role } = req.params;

  try {
    const result = await pool.query('SELECT * FROM users WHERE role = $1', [role]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching users by role:', err);
    res.status(500).json({ error: 'Failed to fetch users by role' });
  }
};

export const getAllUsers = async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY id');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching all users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};
