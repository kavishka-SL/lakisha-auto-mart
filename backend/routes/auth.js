const db = require('../db');
const { hashPassword, verifyPassword } = require('../passwords');
const { createSessionToken } = require('../session');

module.exports = function registerAuthRoutes(app) {
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  const sql = `SELECT u.userId, u.username, u.passwordHash, u.name, u.phone, u.role,
                      s.supplierId, s.isActive AS supplierActive
               FROM user u LEFT JOIN suppliers s ON s.supplierUserId = u.userId
               WHERE u.username = ? LIMIT 1`;

  db.query(sql, [username], async (err, results) => {
    if (err) {
      console.error("Login Query Error:", err);
      return res.status(500).json({ success: false, message: 'Database error!' });
    }

    if (results.length > 0) {
      const user = results[0];
      let verification;
      try {
        verification = await verifyPassword(password, user.passwordHash);
      } catch (error) {
        console.error('Password verification failed:', error);
        return res.status(500).json({ success: false, message: 'Login failed' });
      }
      if (!verification.valid) {
        return res.status(401).json({ success: false, message: 'Invalid Username or Password!' });
      }
      if (user.role === 'SUPPLIER' && (!user.supplierId || !user.supplierActive)) {
        return res.status(403).json({ success: false, message: 'Supplier account is unavailable. Contact the manager.' });
      }

      if (verification.needsUpgrade) {
        hashPassword(password)
          .then(hash => db.promise().query('UPDATE user SET passwordHash = ? WHERE userId = ? AND passwordHash = ?',
            [hash, user.userId, user.passwordHash]))
          .catch(error => console.error('Password upgrade failed:', error));
      }

      req.auditActor = user.userId;
      req.auditRole = user.role;
      return res.json({
        success: true,
        message: 'Login Successful!',
        token: createSessionToken(user),
        user: {
          userId: user.userId,
          name: user.name,
          phone: user.phone,
          username: user.username,
          role: user.role,
          ...(user.role === 'SUPPLIER' ? { supplierId: user.supplierId } : {})
        }
      });
    } else {
      return res.status(401).json({ success: false, message: 'Invalid Username or Password!' });
    }
  });
});
};
