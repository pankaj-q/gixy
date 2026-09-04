import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 255
  },
  passwordHash: {
    type: String,
    required: true,
    select: false // Don't include in queries by default
  },
  name: {
    type: String,
    required: true,
    maxlength: 100,
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'analyst', 'viewer'],
    default: 'viewer'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  preferences: {
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    notifications: { type: Boolean, default: true },
    dashboardLayout: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// Virtual for full name (if we split name into first/last later)
userSchema.virtual('displayName').get(function() {
  return this.name;
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Static method to hash password
userSchema.statics.hashPassword = async function(password) {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

// Static method to find by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to find active users
userSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Pre-save hook to hash password if modified
userSchema.pre('save', async function() {
  if (!this.isModified('passwordHash')) return;
  
  try {
    // Only hash if not already a bcrypt hash
    if (!this.passwordHash.startsWith('$2b$') && !this.passwordHash.startsWith('$2a$') && !this.passwordHash.startsWith('$2y$')) {
      const saltRounds = 12;
      this.passwordHash = await bcrypt.hash(this.passwordHash, saltRounds);
    }
  } catch (error) {
    throw error;
  }
});

// Don't return password hash in JSON
userSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.passwordHash;
    return ret;
  }
});

export const User = mongoose.model('User', userSchema);
export default User;