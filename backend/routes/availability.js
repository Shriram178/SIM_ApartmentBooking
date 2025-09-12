import express from 'express';
import {
getCityAvailability,
checkAvailability
} from '../controllers/availabilityController.js';

const router = express.Router();


/**
 * @swagger
 * tags:
 *   name: Availability
 *   description: Accommodation availability APIs
 */

/**
 * @swagger
 * /api/availability/check/{cityId}:
 *   post:
 *     summary: Check availability in a city
 *     tags: [Availability]
 *     parameters:
 *       - in: path
 *         name: cityId
 *         required: true
 *         schema:
 *           type: string
 *         description: City ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               checkInTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-09-10T12:00:00Z"
 *               checkOutTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-09-15T10:00:00Z"
 *     responses:
 *       200:
 *         description: Availability result for the given city
 *         content:
 *           application/json:
 *             schema:
 *       400:
 *         description: Invalid request
 *       404:
 *         description: City not found
 */
router.post("/check/:cityId", checkAvailability);

/**
 * @swagger
 * /api/availability/city/{cityId}:
 *   post:
 *     summary: Get full availability structure for a city
 *     tags: [Availability]
 *     parameters:
 *       - in: path
 *         name: cityId
 *         required: true
 *         schema:
 *           type: string
 *         description: City ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *                DATES:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     checkIn:
 *                       type: string
 *                       format: date-time
 *                       example: "2023-08-10T14:00:00Z"
 *                     checkOut:
 *                       type: string
 *                       format: date-time
 *                       example: "2023-08-15T10:00:00Z"
 *     responses:
 *       200:
 *         description: Returns hierarchical availability for the city
 *         content:
 *           application/json:
 *             schema:
 *            
 *       404:
 *         description: City not found
 */
router.post("/city/:cityId", getCityAvailability);


// router.post('/check/:cityId', checkAvailability);
// router.post('/city/:cityId', getCityAvailability);

export default router;