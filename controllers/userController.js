import * as userModel from "../models/userModel.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const getUsers = asyncHandler(async (req, res) => {
  const { limit, offset, orgId } = req.validated.query;
  const users = await userModel.getAllUsers({ limit, offset, orgId });
  res.status(200).json(users);
});

const getUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await userModel.getUserById(id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.status(200).json(user);
});

const addUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, mobile, email } = req.validated.body;
  const newUser = await userModel.createUser(firstName, lastName, mobile, email);
  res.status(201).json(newUser);
});

const editUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, mobile, email, isActive } = req.validated.body;
  const updated = await userModel.updateUser(id, firstName, lastName, mobile, email, isActive);
  if (!updated) return res.status(404).json({ error: "User not found" });
  res.status(200).json(updated);
});

const removeUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await userModel.deleteUser(id);
  if (!deleted) return res.status(404).json({ error: "User not found" });
  res.status(200).json({ message: "User deleted", user: deleted });
});

export { getUsers, getUser, addUser, editUser, removeUser };