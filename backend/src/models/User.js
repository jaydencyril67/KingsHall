import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  username: { type: String, required: true, trim: true, lowercase: true, minlength: 3, maxlength: 24, unique: true, index: true },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, unique: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  isEmailVerified: { type: Boolean, default: false, index: true },
  emailVerificationCodeHash: { type: String, select: false, default: undefined },
  emailVerificationExpiresAt: { type: Date, select: false, default: undefined },
  emailVerificationSentAt: { type: Date, select: false, default: undefined },
  failedLoginCount: { type: Number, default: 0, select: false },
  loginBlockedUntil: { type: Date, default: undefined, select: false },
}, {
  timestamps: true,
  versionKey: false,
  toJSON: {
    transform(_doc, ret) {
      delete ret.passwordHash;
      delete ret.emailVerificationCodeHash;
      delete ret.emailVerificationExpiresAt;
      delete ret.emailVerificationSentAt;
      delete ret.failedLoginCount;
      delete ret.loginBlockedUntil;
      return ret;
    },
  },
});

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });

export default mongoose.model('User', userSchema);
