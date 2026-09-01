import jwt from 'jsonwebtoken';
import config from '../config/index.js';

/**
 * JWT Authentication middleware
 */

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  console.log('🔐 Auth check for:', req.method, req.path);

  if (!token) {
    console.log('❌ No token provided');
    return res.status(401).json({
      status: 'fail',
      message: 'Access token required'
    });
  }

  jwt.verify(token, config.jwtSecret, (err, user) => {
    if (err) {
      console.log('❌ Token verification failed:', err.name, err.message);
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          status: 'fail',
          message: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      return res.status(403).json({
        status: 'fail',
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    console.log('✅ Token verified, user:', user);
    req.user = user;
    next();
  });
}

/**
 * Optional authentication - doesn't fail if no token
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  jwt.verify(token, config.jwtSecret, (err, user) => {
    if (!err) {
      req.user = user;
    }
    next();
  });
}

/**
 * Role-based authorization middleware
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'fail',
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'fail',
        message: 'Insufficient permissions',
        requiredRoles: roles,
        userRole: req.user.role
      });
    }
    next();
  };
}

/**
 * Generate access token
 */
export function generateToken(payload, options = {}) {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiry,
    ...options
  });
}

/**
 * Generate refresh token (longer expiry)
 */
export function generateRefreshToken(payload) {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: '7d'
  });
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

/**
 * Extract token from header
 */
export function extractToken(authHeader) {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}