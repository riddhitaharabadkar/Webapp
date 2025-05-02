const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient'); // Prisma client import

// Middleware to parse form data
router.use(express.urlencoded({ extended: true }));

// POST: Role selection handler
router.post('/choose-role', (req, res) => {
  const { role } = req.body;

  if (!role || (role !== 'buyer' && role !== 'seller')) {
    return res.status(400).send('Invalid role selected.');
  }

  req.session.role = role;
  res.redirect('/auth/choose-action'); // Redirect to choose login or register action
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
  const role = req.session.role || 'buyer'; // fallback
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
      if (user.password !== password) {
        return res.status(401).send("Incorrect password. Please try again.");
      }

      // Successful login
      req.session.userId = user.id;
      if (user.role === 'seller') {
        req.session.userId = user.id;
        return res.redirect('https://propertybooking.onrender.com/host/add');
      } else {
        req.session.userId = user.id;
        return res.redirect('https://propertybooking.onrender.com/customer/properties');
      }

    } else {
      // New user → display registration form
      return res.redirect('/auth/register');
    }

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error. Please try again.");
  }
});

// POST: Handle registration
router.post('/register', async (req, res) => {
  const { email, password, fullName, role } = req.body;

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
        password,
        fullName,
        role
      }
    });

    // Redirect to login page with correct role query param
    res.redirect(`https://propertybooking.onrender.com/login?role=${role}`);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating account.");
  }
});

router.post('/logout', (req, res) => {
  // Capture role before destroying session
  const role = req.session.role || 'buyer';
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).send('Error logging out.');
    }
    // Redirect to login page with preserved role
    res.redirect(`https://propertybooking.onrender.com/login?role=${role}`);
  });
});

router.post('/logout/seller', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).send('Error logging out.');
    }
    res.redirect('https://propertybooking.onrender.com/login?role=seller');
  });
});

module.exports = router;
