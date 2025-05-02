const express = require('express');
const path = require('path');
const session = require('express-session');
const app = express();

// Import route files
const authRoutes = require('./routes/auth');
const hostRoutes = require('./routes/host');
const customerRoutes = require('./routes/customer');

// Middleware to parse incoming requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



// Set up session middleware
app.use(
  session({
    secret: 'your-secret-key', // Replace with a strong secret in production
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Set to true if using HTTPS
  })
);
const cors = require('cors');
app.use(cors());


// Serve uploaded images from /uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Set up routes
app.use('/auth', authRoutes);
app.use('/host', hostRoutes);
app.use('/customer', customerRoutes);

// Root route - Ask if Buyer or Seller
app.get('/', (req, res) => {
  res.send(`
    <h2>Are you a Buyer or Seller?</h2>
    <form action="/auth/choose-role" method="POST">
      <input type="hidden" id="roleInput" name="role" value="">
      <button type="button" onclick="document.getElementById('roleInput').value='buyer'; this.form.submit();">Buyer</button>
      <button type="button" onclick="document.getElementById('roleInput').value='seller'; this.form.submit();">Seller</button>
    </form>
  `);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
