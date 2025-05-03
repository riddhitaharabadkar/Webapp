const express = require('express');
const router = express.Router();
const multer = require('multer');
const prisma = require('../prismaClient');
const path = require('path');

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Ensure 'uploads' folder exists in the root directory
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filenames using timestamp
  }
});

const upload = multer({ storage: storage }); // Use multer to handle file uploads

// GET /host/add - Render the property addition form for the seller
router.get('/add', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <html>
    <head>
      <title>Add Property</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 40px;
          background-color: #f9f9f9;
        }
        h2 {
          color: #333;
        }
        form {
          background: #fff;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          max-width: 500px;
        }
        label {
          display: block;
          margin-top: 15px;
          font-weight: bold;
          color: #555;
        }
        input[type="text"],
        input[type="number"],
        textarea,
        input[type="file"] {
          width: 100%;
          padding: 8px;
          margin-top: 5px;
          border: 1px solid #ccc;
          border-radius: 4px;
          box-sizing: border-box;
          font-size: 14px;
        }
        textarea {
          resize: vertical;
          height: 80px;
        }
        button {
          margin-top: 20px;
          background-color: #0070f3;
          color: white;
          border: none;
          padding: 12px 20px;
          font-size: 16px;
          border-radius: 5px;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }
        button:hover {
          background-color: #005bb5;
        }
      </style>
    </head>
    <body>
      <div style="text-align: right; margin-bottom: 10px;">
        <form action="/auth/logout/seller" method="POST" style="display: inline;">
          <button type="submit" style="padding: 8px 16px; background-color: #0070f3; color: white; border: none; border-radius: 5px; cursor: pointer;">Logout</button>
        </form>
      </div>
      <h2>Add a Property (Seller)</h2>
      <form action="/host/add" method="POST" enctype="multipart/form-data">
        <label for="title">Title:</label>
        <input type="text" id="title" name="title" required>
        
        <label for="description">Description:</label>
        <textarea id="description" name="description" required></textarea>
        
        <label for="location">Location:</label>
        <input type="text" id="location" name="location" required>
        
        <label for="price">Price:</label>
        <input type="number" id="price" name="price" required>
        
        <label for="images">Upload Images (Multiple allowed, up to 3):</label>
        <input type="file" id="images" name="images" accept="image/*" multiple>
        
        <input type="hidden" name="userId" value="\${req.session.userId}">
        
        <button type="submit">Add Property</button>
      </form>
    </body>
    </html>
  `);
});

// POST /host/add - Handle the form submission for the seller to add a property with images
router.post('/add', upload.array('images', 3), async (req, res) => {
  const { title, description, location, price } = req.body;
  const userId = req.session.userId;

  // Ensure userId is valid
  if (!userId || isNaN(userId)) {
    console.error('User not authenticated or invalid userId:', userId);
    return res.status(400).send('User not authenticated');
  }

  // Handle the uploaded image files (at least 1 image required)
  if (!req.files) {
    console.error('No files uploaded');
    return res.status(400).send('No files uploaded');
  }
  const imagePaths = req.files.map(file => file.filename); // Get filenames of uploaded images
  if (imagePaths.length === 0) {
    console.error('No images found in uploaded files');
    return res.status(400).send('Please upload at least one image');
  }

  // Ensure the price is a valid number
  const priceValue = parseFloat(price);
  if (isNaN(priceValue)) {
    console.error('Invalid price value:', price);
    return res.status(400).send('Invalid price value');
  }

  try {
    // Create the property in the database, including image paths (array of images)
    await prisma.property.create({
      data: {
        title,
        description,
        location,
        price: priceValue,
        userId: parseInt(userId),
        available: true,
        images: imagePaths, // Store the images' filenames as an array
      }
    });

    res.send('Property added successfully!');
  } catch (error) {
    console.error('Failed to add property to database:', error);
    res.status(500).send(`Failed to add property to database: ${error.message}`);
  }
});

module.exports = router;
