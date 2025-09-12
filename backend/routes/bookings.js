// routes/cities.js
import express from 'express';
import { createBooking,getUserUpcomingBookings ,getBookingHistory,cancelBooking,exportBookingHistoryToExcel,getUserBookingHistory,getBookingTypes } from '../controllers/bookingController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Bookings
 *   description: Booking management APIs
 */

/**
 * @swagger
 * /api/bookings:
 *   post:
 *     summary: Create a new booking
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               requesterId:
 *                 type: integer
 *                 example: 1
 *               bookingType:
 *                 type: string
 *                 example: "individual"
 *               cityId:
 *                 type: integer
 *                 example: 2
 *               BookingMembers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     memberUserId:
 *                       type: integer
 *                       example: 1
 *                     checkInTime:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-26T08:30:00"
 *                     checkOutTime:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-27T18:50:00"
 *     responses:
 *       201:
 *         description: Booking created successfully
 */
router.post('/', createBooking);

/**
 * @swagger
 * /api/bookings/upcoming/user/{userId}:
 *   get:
 *     summary: Get upcoming bookings for a user
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: List of upcoming bookings
 */
router.get('/upcoming/user/:userId', getUserUpcomingBookings);

/**
 * @swagger
 * /api/bookings/bookingTypes:
 *   get:
 *     summary: Get available booking types
 *     tags: [Bookings]
 *     responses:
 *       200:
 *         description: List of booking types
 */
router.get('/bookingTypes', getBookingTypes);

/**
 * @swagger
 * /api/bookings/{requestId}/cancel/user/{userId}:
 *   patch:
 *     summary: Cancel a booking request for a user
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking request ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
 */
router.patch('/:requestId/cancel/user/:userId', cancelBooking);

/**
 * @swagger
 * /api/bookings/history/user/{userId}:
 *   get:
 *     summary: Get booking history for a specific user
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User booking history
 */
router.get('/history/user/:userId', getUserBookingHistory);

/**
 * @swagger
 * /api/bookings/history:
 *   get:
 *     summary: Get all booking history
 *     tags: [Bookings]
 *     parameters:
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by booking status
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by user role
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering bookings
 *       - in: query
 *         name: checkIn
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by check-in date
 *       - in: query
 *         name: checkOut
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by check-out date
 *     responses:
 *       200:
 *         description: Booking history list
 */
router.get('/history', getBookingHistory);

/**
 * @swagger
 * /api/bookings/history/export:
 *   get:
 *     summary: Export booking history to Excel
 *     tags: [Bookings]
 *     parameters:
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by booking status
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by user role
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering bookings
 *       - in: query
 *         name: checkIn
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by check-in date
 *       - in: query
 *         name: checkOut
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by check-out date
 *     responses:
 *       200:
 *         description: Excel file containing booking history
 */
router.get('/history/export', exportBookingHistoryToExcel);



// router.post('/', createBooking);
// router.get('/upcoming/user/:userId', getUserUpcomingBookings);
// router.get('/bookingTypes', getBookingTypes);
// router.patch('/:requestId/cancel/user/:userId', cancelBooking);
// router.get('/history/user/:userId', getUserBookingHistory);
// router.get('/history', getBookingHistory);
// router.get('/history/export', exportBookingHistoryToExcel);

export default router;