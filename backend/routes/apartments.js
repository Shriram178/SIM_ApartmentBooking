// routes/apartments.js
import express from 'express';
import {
  createApartment,
  getApartmentById,
  editApartment,
  deleteApartment,
  getApartmentsByCity
} from '../controllers/apartmentsController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Apartments
 *   description: Apartment management APIs
 */

/**
 * @swagger
 * /api/apartments:
 *   post:
 *     summary: Create a new apartment
 *     tags: [Apartments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cityId:
 *                 type: integer
 *                 example: 1
 *               name:
 *                 type: string
 *                 example: "Sunshine Residency"
 *               googleMapLink:
 *                 type: string
 *                 example: "123 MG Road, Chennai"
 *     responses:
 *       201:
 *         description: Apartment created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/", createApartment);

/**
 * @swagger
 * /api/apartments/{id}:
 *   put:
 *     summary: Update an apartment
 *     tags: [Apartments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Apartment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Apartment Name"
 *               googleMapLink:
 *                 type: string
 *                 example: "New updated address"
 *     responses:
 *       200:
 *         description: Apartment updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Apartment not found
 */
router.put("/:id", editApartment);

/**
 * @swagger
 * /api/apartments/{id}:
 *   delete:
 *     summary: Delete an apartment
 *     tags: [Apartments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Apartment ID
 *     responses:
 *       200:
 *         description: Apartment deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Apartment not found
 */
router.delete("/:id", deleteApartment);

/**
 * @swagger
 * /api/apartments/{id}:
 *   get:
 *     summary: Get apartment by ID
 *     tags: [Apartments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Apartment ID
 *     responses:
 *       200:
 *         description: Apartment details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Apartment'
 *       404:
 *         description: Apartment not found
 */
router.get("/:id", getApartmentById);

/**
 * @swagger
 * /api/apartments/city/{cityId}:
 *   get:
 *     summary: Get apartments by city ID
 *     tags: [Apartments]
 *     parameters:
 *       - in: path
 *         name: cityId
 *         required: true
 *         schema:
 *           type: string
 *         description: City ID
 *     responses:
 *       200:
 *         description: List of apartments in the city
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Apartment'
 *       404:
 *         description: No apartments found for the city
 */
router.get("/city/:cityId", getApartmentsByCity);



// router.post('/', createApartment);
// router.put('/:id', editApartment);
// router.delete('/:id',deleteApartment)
// router.get('/:id', getApartmentById);
// router.get('/city/:cityId', getApartmentsByCity);

export default router;
