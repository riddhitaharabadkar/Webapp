const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient').default || require('../prismaClient');
const PDFDocument = require('pdfkit');
const stream = require('stream');

// Route to fetch and display available properties
router.get('/properties', async (req, res) => {
  try {
    const properties = await prisma.property.findMany({
      where: {
        available: true, // Only fetch available properties
      },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        price: true,
        images: true, // Include images in the result
      },
    });

    res.send(`
      <html>
      <head>
        <title>Available Properties</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f0f2f5;
            margin: 0;
            padding: 20px;
          }
          h2 {
            text-align: center;
            color: #333;
          }
          ul {
            list-style: none;
            padding: 0;
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 20px;
          }
          li {
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            padding: 20px;
            width: 300px;
            box-sizing: border-box;
          }
          h3 {
            margin-top: 0;
            color: #0070f3;
          }
          p {
            color: #555;
            line-height: 1.4;
          }
          img {
            max-width: 100%;
            border-radius: 8px;
            margin: 10px 0;
          }
          form {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          label {
            font-weight: bold;
            margin-bottom: 5px;
            color: #333;
          }
          input[type="date"] {
            padding: 8px;
            border-radius: 5px;
            border: 1px solid #ccc;
          }
          button {
            padding: 10px;
            background-color: #0070f3;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            transition: background-color 0.3s ease;
          }
          button:hover {
            background-color: #005bb5;
          }
        </style>
      </head>
      <body>
        <div style="text-align: right; margin-bottom: 10px;">
          <form action="/auth/logout" method="POST" style="display: inline;">
            <button type="submit" style="padding: 8px 16px; background-color: #0070f3; color: white; border: none; border-radius: 5px; cursor: pointer;">Logout</button>
          </form>
        </div>
        <h2>Available Properties</h2>
        <ul>
          ${properties.map(property => `
            <li>
              <h3>${property.title}</h3>
              <p>${property.description}</p>
              <p><strong>Location:</strong> ${property.location}</p>
              <p><strong>Price:</strong> ${property.price}</p>
              <div>
                ${property.images.length 
                  ? property.images.map(img => `<img src="/uploads/${img}" alt="${property.title}" />`).join('') 
                  : ''}
              </div>
              <form action="/customer/book/${property.id}" method="POST">
                <label for="checkInDate">Check-in Date:</label>
                <input type="date" name="checkInDate" required />
                <label for="checkOutDate">Check-out Date:</label>
                <input type="date" name="checkOutDate" required />
                <button type="submit">Book Property</button>
              </form>
            </li>
          `).join('')}
        </ul>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching properties");
  }
});

// Route to handle property booking and show success page with PDF download option
router.post('/book/:id', async (req, res) => {
  const propertyId = parseInt(req.params.id);
  const { checkInDate, checkOutDate } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).send('User not authenticated. Please log in to book a property.');
  }

  if (!checkInDate || !checkOutDate) {
    return res.status(400).send('Check-in and check-out dates are required.');
  }

  try {
    // Ensure check-in date is before check-out date
    if (new Date(checkInDate) >= new Date(checkOutDate)) {
      return res.status(400).send('Check-out date must be after check-in date.');
    }

    // Create the booking
    const booking = await prisma.booking.create({
      data: {
        propertyId: propertyId,
        userId: userId,
        checkInDate: new Date(checkInDate),
        checkOutDate: new Date(checkOutDate),
        status: 'pending',
      },
    });

    // Fetch property details for display and PDF
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        title: true,
        description: true,
        location: true,
        price: true,
        images: true,
      },
    });

    // Render success page with download PDF button
    res.send(`
      <html>
      <head>
        <title>Booking Successful</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            background-color: #f0f2f5;
            text-align: center;
          }
          h2 {
            color: #0070f3;
          }
          button {
            margin-top: 20px;
            padding: 10px 20px;
            font-size: 16px;
            background-color: #0070f3;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
          }
          button:hover {
            background-color: #005bb5;
          }
        </style>
      </head>
      <body>
        <h2>Booking successful! Thank you for your reservation.</h2>
        <p>Property: ${property.title}</p>
        <p>Check-in Date: ${checkInDate}</p>
        <p>Check-out Date: ${checkOutDate}</p>
        <form action="/customer/book/${booking.id}/pdf" method="GET">
          <button type="submit">Download Booking Details PDF</button>
        </form>
      </body>
      </html>
    `);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error processing booking. Please try again later.');
  }
});

// Route to generate and serve booking details PDF
router.get('/book/:bookingId/pdf', async (req, res) => {
  const bookingId = parseInt(req.params.bookingId);
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).send('User not authenticated.');
  }

  try {
    // Fetch booking and property details
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        property: true,
      },
    });

    if (!booking || booking.userId !== userId) {
      return res.status(404).send('Booking not found.');
    }

    // Create PDF document
    const doc = new PDFDocument();
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      let pdfData = Buffer.concat(buffers);
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=booking_${bookingId}.pdf`,
        'Content-Length': pdfData.length,
      });
      res.end(pdfData);
    });

    // PDF content
    doc.fontSize(20).text('Booking Details', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Property: ${booking.property.title}`);
    doc.text(`Description: ${booking.property.description}`);
    doc.text(`Location: ${booking.property.location}`);
    doc.text(`Price: Rs${booking.property.price}`);
    doc.moveDown();
    doc.text(`Check-in Date: ${booking.checkInDate.toDateString()}`);
    doc.text(`Check-out Date: ${booking.checkOutDate.toDateString()}`);
    doc.text(`Payment Status: ${booking.status}`);
    doc.end();

  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating PDF.');
  }
});

module.exports = router;
