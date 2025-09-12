// routes/cities.js
import express from 'express';
import {getAllPendingRequests,approveRequest,rejectRequest,deleteRequest ,removeUserFromRequest,getUserPendingRequests } from '../controllers/requestController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Requests
 *   description: Booking request management APIs
 */

/**
 * @swagger
 * /api/requests/pending/user/{userId}:
 *   get:
 *     summary: Get all pending requests for a specific user
 *     tags: [Requests]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: List of pending requests
 */
router.get('/pending/user/:userId', getUserPendingRequests);

/**
 * @swagger
 * /api/requests/{requestId}/user/{userId}:
 *   patch:
 *     summary: Remove a user from a request
 *     tags: [Requests]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Request ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID to remove from request
 *     responses:
 *       200:
 *         description: User removed from request successfully
 */
router.patch('/:requestId/user/:userId', removeUserFromRequest);

/**
 * @swagger
 * /api/requests/{requestId}:
 *   delete:
 *     summary: Delete a request
 *     tags: [Requests]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Request ID
 *     responses:
 *       200:
 *         description: Request deleted successfully
 */
router.delete('/:requestId', deleteRequest);

/**
 * @swagger
 * /api/requests:
 *   get:
 *     summary: Get all pending requests
 *     tags: [Requests]
 *     responses:
 *       200:
 *         description: List of all pending requests
 */
router.get('/', getAllPendingRequests);

/**
 * @swagger
 * /api/requests/{requestId}/approve:
 *   post:
 *     summary: Approve a booking request
 *     tags: [Requests]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the request to approve
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               remarks:
 *                 type: string
 *                 description: Optional remarks for the approval
 *                 example: "Approved for engineering offsite"
 *               allocatedAccommodation:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     bookingMemberId:
 *                       type: integer
 *                       example: 10
 *                     assignedAccommodation:
 *                       type: object
 *                       properties:
 *                         apartmentId:
 *                           type: integer
 *                           example: 1
 *                         flatId:
 *                           type: integer
 *                           example: 1
 *                         roomId:
 *                           type: integer
 *                           example: 1
 *     responses:
 *       200:
 *         description: Request approved successfully
 */
router.post('/:requestId/approve', approveRequest);

/**
 * @swagger
 * /api/requests/{requestId}/reject:
 *   post:
 *     summary: Reject a booking request
 *     tags: [Requests]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the request to reject
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               remarks:
 *                 type: string
 *                 description: Reason for rejection
 *                 example: "Not enough availability"
 *     responses:
 *       200:
 *         description: Request rejected successfully
 */
router.post('/:requestId/reject', rejectRequest);


// router.get('/pending/user/:userId', getUserPendingRequests);
// router.patch('/:requestId/user/:userId',removeUserFromRequest);
// router.delete('/:requestId',deleteRequest);
// router.get('/',getAllPendingRequests);
// router.post('/:requestId/approve',approveRequest);
// router.post('/:requestId/reject',rejectRequest);

export default router;