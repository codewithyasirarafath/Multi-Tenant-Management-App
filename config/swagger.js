import swaggerJSDoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Multi-Tenant Delivery Management API",
      version: "1.0.0",
      description: "API documentation for the multi-tenant delivery management backend",
      contact: {
        name: "API Support",
      },
    },
    servers: [
      {
        url: "http://localhost:3000/api/v1",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        // Common schemas
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
            details: { type: "object" },
          },
        },
        Organization: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            slug: { type: "string" },
            org_code: { type: "integer", minimum: 100, maximum: 999 },
            is_active: { type: "boolean" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        Entity: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            org_id: { type: "string", format: "uuid" },
            name: { type: "string" },
            code: { type: "string" },
            ent_code: { type: "integer", minimum: 1, maximum: 999 },
            is_active: { type: "boolean" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            first_name: { type: "string" },
            last_name: { type: "string" },
            mobile: { type: "string" },
            is_active: { type: "boolean" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        Role: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            org_id: { type: "string", format: "uuid", nullable: true },
            name: { type: "string" },
            description: { type: "string" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        Membership: {
          type: "object",
          properties: {
            membership_id: { type: "string", format: "uuid" },
            org_id: { type: "string", format: "uuid" },
            org_code: { type: "integer" },
            org_name: { type: "string" },
            org_slug: { type: "string" },
            ent_id: { type: "string", format: "uuid", nullable: true },
            ent_code: { type: "integer", nullable: true },
            entity_name: { type: "string", nullable: true },
            entity_code: { type: "string", nullable: true },
            role_id: { type: "string", format: "uuid" },
            role_name: { type: "string" },
            role_description: { type: "string" },
            is_active: { type: "boolean" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        Delivery: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            org_id: { type: "string", format: "uuid" },
            ent_id: { type: "string", format: "uuid", nullable: true },
            tracking_number: { type: "string" },
            sender_name: { type: "string" },
            receiver_name: { type: "string" },
            destination: { type: "string" },
            status: { type: "string", enum: ["pending", "in_transit", "out_for_delivery", "delivered", "cancelled"] },
            created_by: { type: "string", format: "uuid", nullable: true },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        Permission: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            description: { type: "string" },
            resource: { type: "string" },
            action: { type: "string" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            user: { $ref: "#/components/schemas/User" },
            memberships: { type: "array", items: { $ref: "#/components/schemas/Membership" } },
            membershipCodes: { type: "array", items: { type: "integer" } },
            accessToken: { type: "string" },
            refreshToken: { type: "string" },
          },
        },
        PaginatedResponse: {
          type: "object",
          properties: {
            data: { type: "array", items: {} },
            pagination: {
              type: "object",
              properties: {
                limit: { type: "integer" },
                offset: { type: "integer" },
                total: { type: "integer" },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Auth", description: "Authentication endpoints" },
      { name: "Organizations", description: "Organization management" },
      { name: "Entities", description: "Entity (branch/warehouse) management" },
      { name: "Users", description: "User management" },
      { name: "Roles", description: "Role management" },
      { name: "Permissions", description: "Permission management" },
      { name: "Memberships", description: "User membership management" },
      { name: "Deliveries", description: "Delivery management" },
      { name: "AI Chat", description: "AI chat assistant" },
    ],
  },
  apis: ["./routes/*.js", "./controllers/*.js"],
};

export const swaggerSpec = swaggerJSDoc(options);