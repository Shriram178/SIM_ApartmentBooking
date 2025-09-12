import express from 'express';
import {
getAccesstoken,
getAuthCode,
getRefreshToken,
getUrl
} from '../controllers/authController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: Microsoft OAuth2 + JWT authentication APIs
 */


/**
 * @swagger
 * /auth/url:
 *   get:
 *     summary: Get Microsoft login URL
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Returns the Microsoft OAuth2 login URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 */
router.get('/url', getUrl);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Exchange authorization code for JWT
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 description: Authorization code from Microsoft
 *     responses:
 *       200:
 *         description: Successfully authenticated, returns JWT and user info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     accessLevel:
 *                       type: string
 *                     gender:
 *                       type: string
 *       400:
 *         description: Authorization code required
 *       500:
 *         description: Authentication failed
 */
router.post('/login', getAccesstoken);


/**
 * @swagger
 * /auth/callback:
 *   get:
 *     summary: Microsoft redirect callback with authorization code
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         required: true
 *         description: Authorization code from Microsoft
 *     responses:
 *       200:
 *         description: Returns the authorization code (for debugging/demo)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 */
router.get('/callback', getAuthCode);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Expired JWT or refresh token
 *     responses:
 *       200:
 *         description: Returns a new JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       401:
 *         description: Refresh token required
 *       403:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh', getRefreshToken);

export default router;