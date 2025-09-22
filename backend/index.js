import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import jwt from "jsonwebtoken";
import pool from './db.js';

import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import requestRoutes from './routes/requests.js' 
import accommodationsRoute from './routes/accommodations.js'
import cityRoutes from './routes/cities.js';
import occupancyRoutes from './routes/occupancy.js';
import userRoutes from './routes/users.js';
import apartmentRoutes from './routes/apartments.js';
import flatRoutes from './routes/flats.js';
import roomRoutes from './routes/rooms.js';
import bedRoutes from './routes/beds.js';
import availabilityRoutes from './routes/availability.js';
import swaggerJsDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const {
  PORT,
  JWT_SECRET
} = process.env;

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());


const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "My Node API",
      version: "1.0.0",
      description: "API documentation for my Node.js server",
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
     schemas: {
    // ENUMS
    RequestStatus: {
      type: "string",
      enum: ["pending", "approved", "rejected", "cancelled", "accommodated", "completed"],
    },
    BookingType: {
      type: "string",
      enum: ["individual", "team"],
    },
    GenderType: {
      type: "string",
      enum: ["male", "female", "other"],
    },
    AccessLevel: {
      type: "string",
      enum: ["user", "admin"],
    },

    // TABLE SCHEMAS
    City: {
      type: "object",
      properties: {
        id: { type: "integer" },
        name: { type: "string", example: "New York" }
      }
    },
    User: {
      type: "object",
      properties: {
        id: { type: "integer" },
        name: { type: "string", example: "John Doe" },
        email: { type: "string", example: "john.doe@example.com" },
        role: { type: "string", example: "Engineer" },
        gender: { $ref: "#/components/schemas/GenderType" },
        access: { $ref: "#/components/schemas/AccessLevel" }
      }
    },
    Apartment: {
      type: "object",
      properties: {
        id: { type: "integer" },
        name: { type: "string", example: "Sky Tower" },
        city_id: { type: "integer" },
        google_map_link: { type: "string", example: "https://maps.example.com/skytower" }
      }
    },
    Flat: {
      type: "object",
      properties: {
        id: { type: "integer" },
        name: { type: "string", example: "Floor 5" },
        apartment_id: { type: "integer" }
      }
    },
    Room: {
      type: "object",
      properties: {
        id: { type: "integer" },
        name: { type: "string", example: "Room 501" },
        flat_id: { type: "integer" }
      }
    },
    Bed: {
      type: "object",
      properties: {
        id: { type: "integer" },
        name: { type: "string", example: "Bed 1" },
        room_id: { type: "integer" }
      }
    },
    BookingRequest: {
      type: "object",
      properties: {
        id: { type: "integer" },
        user_id: { type: "integer" },
        city_id: { type: "integer" },
        status: { $ref: "#/components/schemas/RequestStatus" },
        booking_type: { $ref: "#/components/schemas/BookingType" },
        remarks: { type: "string" },
        processed_at: { type: "string", format: "date-time" },
        timestamp: { type: "string", format: "date-time" }
      }
    },
    BookingMember: {
      type: "object",
      properties: {
        id: { type: "integer" },
        request_id: { type: "integer" },
        user_id: { type: "integer" },
        check_in: { type: "string", format: "date-time" },
        check_out: { type: "string", format: "date-time" },
        status: { $ref: "#/components/schemas/RequestStatus" }
      }
    },
    AssignedAccommodation: {
      type: "object",
      properties: {
        id: { type: "integer" },
        booking_members_id: { type: "integer" },
        city_id: { type: "integer", nullable: true },
        apartment_id: { type: "integer", nullable: true },
        flat_id: { type: "integer", nullable: true },
        room_id: { type: "integer", nullable: true },
        bed_id: { type: "integer", nullable: true }
      }
    }
  },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./routes/*.js"], // path to your route files
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const authorizeAccess = (...allowedAccess) => {
  return (req, res, next) => {
    if (!req.user || !allowedAccess.includes(req.user.access)) {
      return res.status(403).json({ error: "Forbidden: Access denied" });
    }
    next();
  };
};

async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Database Connected! Current time:', res.rows[0]);
  } catch (err) {
    console.error('Database Connection Failed:', err);
  }
}

testConnection();


const swaggerDocs = swaggerJsDoc(swaggerOptions);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));


app.use('/auth', authRoutes);
app.use('/api/cities', authenticateToken,authorizeAccess('user','admin'), cityRoutes);
app.use('/api/users', authenticateToken,authorizeAccess('user','admin'), userRoutes); 
app.use('/api/apartments',authenticateToken,authorizeAccess('user','admin'), apartmentRoutes);
app.use('/api/flats',authenticateToken,authorizeAccess('user','admin'),flatRoutes);
app.use('/api/rooms',authenticateToken,authorizeAccess('user','admin'),roomRoutes);
app.use('/api/occupancy', authenticateToken,authorizeAccess('user','admin'), occupancyRoutes);
app.use('/api/availability', authenticateToken,authorizeAccess('user','admin'), availabilityRoutes);
app.use('/api/bookings', authenticateToken,authorizeAccess('user','admin'), bookingRoutes);
app.use('/api/requests', authenticateToken,authorizeAccess('user','admin'), requestRoutes);
app.use('/api/accommodation', authenticateToken,authorizeAccess('user','admin'), accommodationsRoute);
app.use('/api/beds', authenticateToken,authorizeAccess('user','admin'),bedRoutes);

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost: ${PORT} `);
});

