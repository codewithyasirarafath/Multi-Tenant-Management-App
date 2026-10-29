import {
  runChatTurn,
} from "./service.js";
import * as aiConvModel from "./model.js";
import { asyncHandler } from "../shared/middleware/errorHandler.js";
import { NotFoundError } from "../shared/utils/errors.js";

const askQuestion = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { question, conversationId } = req.body;

  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "question (string) is required" });
  }

  let convId = conversationId;
  let conversation;

  // Get or create conversation
  if (convId) {
    conversation = await aiConvModel.getConversationById(convId, orgId, req.auth.userId);
    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }
  } else {
    // Create new conversation with first question as title
    const title = question.length > 50 ? question.substring(0, 50) + "..." : question;
    conversation = await aiConvModel.createConversation(orgId, req.auth.userId, title);
    convId = conversation.id;
  }

  // Save user message
  await aiConvModel.addMessage(convId, orgId, req.auth.userId, "user", question);

  // Rule-based assistant: keyword/pattern matching + parameterized queries,
  // scoped by org_id (see service.js). No external API involved.
  const answer = await runChatTurn(orgId, [{ role: "user", content: question }]);

  // Save assistant message
  await aiConvModel.addMessage(convId, orgId, req.auth.userId, "assistant", answer);

  res.status(200).json({
    conversationId: convId,
    question,
    answer,
  });
});

const getConversations = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { limit, offset } = req.validated.query;
  const conversations = await aiConvModel.getConversations(orgId, req.auth.userId, { limit, offset });
  res.status(200).json(conversations);
});

const getConversation = asyncHandler(async (req, res) => {
  const { orgId, conversationId } = req.params;
  const conversation = await aiConvModel.getConversationById(conversationId, orgId, req.auth.userId);
  if (!conversation) throw new NotFoundError("Conversation not found");
  res.status(200).json(conversation);
});

const createConversation = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { title } = req.validated.body;
  const conversation = await aiConvModel.createConversation(orgId, req.auth.userId, title);
  res.status(201).json(conversation);
});

const updateConversation = asyncHandler(async (req, res) => {
  const { orgId, conversationId } = req.params;
  const { title } = req.validated.body;
  const conversation = await aiConvModel.updateConversation(conversationId, orgId, req.auth.userId, title);
  if (!conversation) throw new NotFoundError("Conversation not found");
  res.status(200).json(conversation);
});

const deleteConversation = asyncHandler(async (req, res) => {
  const { orgId, conversationId } = req.params;
  const deleted = await aiConvModel.deleteConversation(conversationId, orgId, req.auth.userId);
  if (!deleted) throw new NotFoundError("Conversation not found");
  res.status(200).json({ message: "Conversation deleted", conversation: deleted });
});

const getMessages = asyncHandler(async (req, res) => {
  const { orgId, conversationId } = req.params;
  const { limit, offset } = req.validated.query;
  const messages = await aiConvModel.getMessages(conversationId, orgId, req.auth.userId, { limit, offset });
  res.status(200).json(messages);
});

export { 
  askQuestion, 
  getConversations, 
  getConversation, 
  createConversation, 
  updateConversation, 
  deleteConversation,
  getMessages 
};