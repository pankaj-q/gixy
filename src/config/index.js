import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3007),
  MONGODB_URI: Joi.string().default('mongodb://localhost:27017/gixy'),
  JWT_SECRET: Joi.string().default('your_jwt_secret_key_here'),
  JWT_EXPIRY: Joi.string().default('24h'),
  LOG_LEVEL: Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),
  REDIS_URL: Joi.string().allow('').default(''),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
}).unknown();

const { error, value } = envSchema.validate(process.env);

if (error) {
  console.error(`Configuration validation error: ${error.message}`);
  process.exit(1);
}

const config = {
  env: value.NODE_ENV,
  port: value.PORT,
  mongodbUri: value.MONGODB_URI,
  jwtSecret: value.JWT_SECRET,
  jwtExpiry: value.JWT_EXPIRY,
  logLevel: value.LOG_LEVEL,
  redis: {
    url: value.REDIS_URL || undefined,
  },
  rateLimit: {
    windowMs: value.RATE_LIMIT_WINDOW_MS,
    max: value.RATE_LIMIT_MAX_REQUESTS,
  },
};

export default config;