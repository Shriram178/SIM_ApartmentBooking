import axios from "axios";
import jwt from "jsonwebtoken";
import pool from '../db.js';

const {
  CLIENT_ID,
  CLIENT_SECRET,
  TENANT_ID,
  REDIRECT_URI,
  JWT_SECRET,
  FRONTEND_URL
} = process.env;


export const getUrl=  async(req, res) => {
  const authUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_mode=query` +
    `&scope=openid profile email User.Read`;

  res.json({ url: authUrl });
};

export const getAccesstoken = async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: "Authorization code required" });
  }

  try {
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: CLIENT_ID,
        scope: "User.Read openid profile email",
        code,
        redirect_uri: REDIRECT_URI, // must match the one registered in Azure
        grant_type: "authorization_code",
        client_secret: CLIENT_SECRET
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    console.log("Token Response:", tokenResponse.data);
    const accessToken = tokenResponse.data.access_token;

    const userResponse = await axios.get("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    console.log("User Profile:", userResponse.data);

    const user = userResponse.data;
    const name = user.displayName;
    const email = user.mail || user.userPrincipalName;
    const jobTitle = user.jobTitle || "Not specified";

    let userId, access,gender ;
    
    const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (userCheck.rows.length === 0) {
      const insertResult = await pool.query(
        "INSERT INTO users (name, email, role) VALUES ($1, $2, $3) RETURNING id, name, email, role, access ,gender",
        [name, email, jobTitle]
      );
      userId = insertResult.rows[0].id;
      access = insertResult.rows[0].access;
      gender=  insertResult.rows[0].gender;
    } else {
      userId = userCheck.rows[0].id;
      access = userCheck.rows[0].access;
      gender=  userCheck.rows[0].gender;
    }

    // Generate JWT
    const token = generateToken({ id: userId, email, name, role: jobTitle,access });

    return res.json({
      success: true,
      token,
      user: {
        id: userId,
        name,
        email,
        role: jobTitle,
        accessLevel: access,
        gender
      }
    });

  } catch (err) {
    console.error("❌ Login Error:", err.response?.data || err.message);
    return res.status(500).json({ success: false, error: "Authentication failed" });
  }
};

export const getAuthCode = async (req, res) => {
    const code = req.query.code;
 
  if (!code) {
    return res.status(400).send("Missing code");
  }
 
  // Redirect to your frontend with the code
  const frontendUrl = `${FRONTEND_URL}/login?code=${encodeURIComponent(code)}`;
  return res.redirect(frontendUrl);
  // return res.json({ code });
};

export const getRefreshToken = async(req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }

    // Generate new token
    const newToken = generateToken(user);
    res.json({ token: newToken });
  });
};

const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      role: user.role, 
      access: user.access
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};
