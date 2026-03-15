/**
 * CapitalOS API --- Authentication Middleware
 */
const OPERATOR_TOKEN = process.env.CAPITALOS_OPERATOR_TOKEN;
function requireOperatorToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const token = authHeader.slice(7);
  if (!OPERATOR_TOKEN || token !== OPERATOR_TOKEN) {
    return res.status(401).json({ error: 'Invalid operator token' });
  }
  req.isOperator = true;
  next();
}
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const token = authHeader.slice(7);
  if (OPERATOR_TOKEN && token === OPERATOR_TOKEN) {
    req.isOperator = true;
    return next();
  }
  try {
    const [, payload] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
    req.userId = decoded.sub;
    req.userRole = decoded.role;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
module.exports = { requireOperatorToken, requireAuth };
