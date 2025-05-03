const express = require('express');
const session = require('express-session');
const prisma = require('../prismaClient'); // Prisma client import
const router = express.Router();

// Middleware to parse form data
router.use(express.urlencoded({ extended: true }));

// Middleware for handling sessions
router.use(session({
  secret: 'your_secret_key',  // Use a strong secret key in production
  resave: false,
  saveUninitialized: true
}));

// GET: Role selection page (to choose between 'buyer' or 'seller')
router.get('/choose-role', (req, res) => {
  res.send(`
    <h2>Please choose your role:</h2>
    <form action="/auth/choose-role" method="POST">
      <button type="submit" name="role" value="buyer">Buyer</button>
      <button type="submit" name="role" value="seller">Seller</button>
    </form>
  `);
});

// POST: Handle role selection
router.post('/choose-role', (req, res) => {
  const { role } = req.body;
  
  if (!role || (role !== 'buyer' && role !== 'seller')) {
    return res.status(400).send('Invalid role selected.');
  }

  req.session.role = role;
  res.redirect('/auth/choose-action');
});

// GET: Choose action (Login or Register)
router.get('/choose-action', (req, res) => {
  res.send(`
    <h2>Welcome! Please choose an option:</h2>
    <form action="/auth/login" method="GET">
      <button type="submit">Login</button>
    </form>
    <form action="/auth/register" method="GET">
      <button type="submit">Register</button>
    </form>
  `);
});

// GET: Login form
router.get('/login', (req, res) => {
  const role = req.session.role || 'buyer'; // Default to 'buyer' if no role in session
  res.send(`
    <h2>Login as ${role.toUpperCase()}</h2>
    <form action="/auth/login" method="POST">
      <input type="email" name="email" placeholder="Email" required />
      <input type="text" name="fullName" placeholder="Full Name" required />
      <input type="password" name="password" placeholder="Password" required />
      <button type="submit">Login</button>
    </form>
  `);
});

// POST: Handle login
router.post('/login', async (req, res) => {
  const { email, password, fullName } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).send("Email, password, and full name are required.");
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Existing user → verify password
      if (user.password !== password) { // In production, hash passwords and compare!
        return res.status(401).send("Incorrect password. Please try again.");
      }

      // Successful login
      req.session.userId = user.id; // Store user ID in session
      req.session.role = user.role;  // Store user role in session

      if (user.role === 'seller') {
        return res.redirect('/host/add');
      } else {
        return res.redirect('/customer/properties');
      }

    } else {
      // New user → display registration form
      return res.redirect('/auth/register');
    }

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Server error. Please try again.");
  }
});

// GET: Registration form
router.get('/register', (req, res) => {
  const role = req.session.role || 'buyer';
  res.send(`
    <h2>Register as ${role.toUpperCase()}</h2>
    <form action="/auth/register" method="POST">
      <input type="email" name="email" placeholder="Email" required />
      <input type="text" name="fullName" placeholder="Full Name" required />
      <input type="password" name="password" placeholder="Password" required />
      <button type="submit">Register</button>
    </form>
  `);
});

// POST: Handle registration
router.post('/register', async (req, res) => {
  const { email, password, fullName } = req.body;
  const role = req.session.role || 'buyer'; // Use role from session or default to 'buyer'

  if (!email || !password || !fullName) {
    return res.status(400).send("All fields are required.");
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return res.status(409).send("Email already registered. Please login.");
    }

    const newUser = await prisma.user.create({
      data: {
        email,
        password, // Ensure this is hashed in production
        fullName,
        role
      }
    });

    // Redirect to login page with correct role query param
    res.redirect(`/auth/login?role=${role}`);

  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).send("Error creating account.");
  }
});

// POST: Handle logout
router.post('/logout', (req, res) => {
  const role = req.session.role || 'buyer';  // Preserve the user's role before logging out
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).send('Error logging out.');
    }
    res.redirect(`/auth/login?role=${role}`);
  });
});

module.exports = router;
