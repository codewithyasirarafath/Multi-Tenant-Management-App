import * as authModel from "../models/Authmodel.js";
import { generateToken, getUserMemberships, getMembershipCodes } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { UnauthorizedError, ConflictError, BadRequestError, NotFoundError } from "../utils/errors.js";

const register = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, mobile } = req.validated.body;

  const existingUser = await authModel.getUserByEmailForAuth(email);
  if (existingUser) {
    throw new ConflictError("User with this email already exists");
  }

  const user = await authModel.createUserWithPassword(email, password, firstName, lastName, mobile);
  const memberships = await getUserMemberships(user.id);
  const membershipCodes = memberships.map(m => m.org_code * 1000 + (m.ent_code || 0));

  const accessToken = generateToken({ userId: user.id, email: user.email });
  const { token: refreshToken } = await authModel.createRefreshToken(user.id, req.headers["user-agent"], req.ip);

  res.status(201).json({
    user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name },
    memberships,
    membershipCodes,
    accessToken,
    refreshToken,
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validated.body;

  const user = await authModel.getUserByEmailForAuth(email);
  if (!user || !user.is_active) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const isValid = await authModel.verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const memberships = await getUserMemberships(user.id);
  const membershipCodes = memberships.map(m => m.org_code * 1000 + (m.ent_code || 0));

  const accessToken = generateToken({ userId: user.id, email: user.email });
  const { token: refreshToken } = await authModel.createRefreshToken(user.id, req.headers["user-agent"], req.ip);

  res.status(200).json({
    user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name },
    memberships,
    membershipCodes,
    accessToken,
    refreshToken,
  });
});

const getMe = asyncHandler(async (req, res) => {
  const memberships = await getUserMemberships(req.auth.userId);
  const membershipCodes = memberships.map(m => m.org_code * 1000 + (m.ent_code || 0));

  res.status(200).json({
    user: { id: req.auth.userId, email: req.auth.email },
    memberships,
    membershipCodes,
  });
});

const getMembershipCodesByEmail = asyncHandler(async (req, res) => {
  const { email } = req.validated.body;
  
  const user = await authModel.getUserByEmailForAuth(email);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const codes = await getMembershipCodes(user.id);
  res.status(200).json({ email, membershipCodes: codes });
});

// ============================================
// PASSWORD RESET
// ============================================
const requestPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.validated.body;

  const user = await authModel.getUserByEmailForAuth(email);
  // Always return success to prevent email enumeration
  if (!user) {
    return res.status(200).json({ message: "If the email exists, a reset link has been sent" });
  }

  const { token, expiresAt } = await authModel.createPasswordResetToken(user.id);

  // TODO: Send email with reset link containing token
  // For now, return token in response (dev only)
  res.status(200).json({ 
    message: "If the email exists, a reset link has been sent",
    devToken: token, // Remove in production
    expiresAt,
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.validated.body;

  try {
    await authModel.resetPasswordWithToken(token, newPassword);
    res.status(200).json({ message: "Password has been reset successfully" });
  } catch (err) {
    throw new BadRequestError(err.message);
  }
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.validated.body;
  const userId = req.auth.userId;

  const user = await authModel.getUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const isValid = await authModel.verifyPassword(currentPassword, user.password_hash);
  if (!isValid) {
    throw new UnauthorizedError("Current password is incorrect");
  }

  await authModel.updateUserPassword(userId, newPassword);
  await authModel.revokeAllRefreshTokens(userId);

  res.status(200).json({ message: "Password changed successfully. Please log in again." });
});

// ============================================
// REFRESH TOKEN ROTATION
// ============================================
const refreshAccessToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.validated.body;

  try {
    const { token: newAccessToken, expiresAt } = await authModel.rotateRefreshToken(
      refreshToken,
      req.headers["user-agent"],
      req.ip
    );

    // Generate new access token
    const user = await authModel.getUserById(req.auth?.userId);
    const accessToken = generateToken({ userId: user.id, email: user.email });

    res.status(200).json({
      accessToken,
      refreshToken: newAccessToken,
      refreshTokenExpiresAt: expiresAt,
    });
  } catch (err) {
    throw new UnauthorizedError(err.message);
  }
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.validated.body;

  if (refreshToken) {
    await authModel.revokeRefreshToken(refreshToken);
  }

  res.status(200).json({ message: "Logged out successfully" });
});

const revokeAllSessions = asyncHandler(async (req, res) => {
  await authModel.revokeAllRefreshTokens(req.auth.userId);
  res.status(200).json({ message: "All sessions revoked" });
});

export { 
  register, login, getMe, getMembershipCodesByEmail,
  requestPasswordReset, resetPassword, changePassword,
  refreshAccessToken, logout, revokeAllSessions
};