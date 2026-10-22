import express from "express";
import * as authController from "./controller.js";
import { validate } from "../shared/middleware/validation.js";
import { schemas } from "../shared/middleware/validation.js";
import { authMiddleware } from "../shared/middleware/auth.js";
import { asyncHandler } from "../shared/middleware/errorHandler.js";

const router = express.Router();

router.post("/register", validate(schemas.auth.register), authController.register);
router.post("/login", validate(schemas.auth.login), authController.login);
router.get("/me", authMiddleware, asyncHandler(authController.getMe));
router.post("/membership-codes", validate(schemas.user.getMembershipCodes), asyncHandler(authController.getMembershipCodesByEmail));

// Password reset
router.post("/password/reset-request", validate(schemas.auth.requestPasswordReset), asyncHandler(authController.requestPasswordReset));
router.post("/password/reset", validate(schemas.auth.resetPassword), asyncHandler(authController.resetPassword));
router.post("/password/change", authMiddleware, validate(schemas.auth.changePassword), asyncHandler(authController.changePassword));

// Refresh token rotation
router.post("/token/refresh", validate(schemas.auth.refreshToken), asyncHandler(authController.refreshAccessToken));
router.post("/logout", validate(schemas.auth.logout), asyncHandler(authController.logout));
router.post("/sessions/revoke-all", authMiddleware, asyncHandler(authController.revokeAllSessions));

export default router;