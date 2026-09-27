const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {

  const authHeader = req.headers['authorization'];
  

  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Доступ запрещен: токен аутентификации не предоставлен (401 Unauthorized).'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decodedUser) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Недействительный или просроченный токен (403 Forbidden).'
      });
    }

    req.user = decodedUser;
    next();
  });
};

module.exports = authenticateToken;