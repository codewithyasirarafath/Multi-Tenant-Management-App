import { z } from 'zod';
import { ValidationError } from '../utils/errors.js';

export const validate = (schema) => (req, res, next) => {
  try {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const errors = result.error.flatten();
      throw new ValidationError('Validation failed', {
        body: errors.formErrors.fieldErrors.body,
        query: errors.formErrors.fieldErrors.query,
        params: errors.formErrors.fieldErrors.params,
      });
    }

    req.validated = result.data;
    next();
  } catch (err) {
    next(err);
  }
};

export const schemas = {
  organization: {
    create: z.object({
      body: z.object({
        name: z.string().min(1).max(150),
        slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
        orgCode: z.number().int().min(100).max(999).optional(),
      }),
    }),
    update: z.object({
      body: z.object({
        name: z.string().min(1).max(150).optional(),
        slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
        isActive: z.boolean().optional(),
      }),
      params: z.object({
        id: z.string().uuid(),
      }),
    }),
    get: z.object({
      params: z.object({
        id: z.string().uuid(),
      }),
    }),
  },

  entity: {
    create: z.object({
      body: z.object({
        name: z.string().min(1).max(150),
        code: z.string().min(1).max(50),
        entCode: z.number().int().min(1).max(999).optional(),
      }),
      params: z.object({
        orgId: z.string().uuid(),
      }),
    }),
    update: z.object({
      body: z.object({
        name: z.string().min(1).max(150).optional(),
        code: z.string().min(1).max(50).optional(),
        isActive: z.boolean().optional(),
      }),
      params: z.object({
        orgId: z.string().uuid(),
        id: z.string().uuid(),
      }),
    }),
    get: z.object({
      params: z.object({
        orgId: z.string().uuid(),
        id: z.string().uuid(),
      }),
    }),
    list: z.object({
      params: z.object({
        orgId: z.string().uuid(),
      }),
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      }),
    }),
  },

  user: {
    create: z.object({
      body: z.object({
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        mobile: z.string().min(10).max(20).regex(/^\+?[\d\s-]+$/),
        email: z.string().email(),
      }),
    }),
    update: z.object({
      body: z.object({
        firstName: z.string().min(1).max(100).optional(),
        lastName: z.string().min(1).max(100).optional(),
        mobile: z.string().min(10).max(20).regex(/^\+?[\d\s-]+$/).optional(),
        email: z.string().email().optional(),
        isActive: z.boolean().optional(),
      }),
      params: z.object({
        id: z.string().uuid(),
      }),
    }),
    get: z.object({
      params: z.object({
        id: z.string().uuid(),
      }),
    }),
    list: z.object({
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
        orgId: z.string().uuid().optional(),
      }),
    }),
    getMembershipCodes: z.object({
      body: z.object({
        email: z.string().email(),
      }),
    }),
  },

  role: {
    create: z.object({
      body: z.object({
        name: z.string().min(1).max(50),
        description: z.string().max(255).optional(),
      }),
      params: z.object({
        orgId: z.string().uuid().optional(),
      }),
    }),
    list: z.object({
      params: z.object({
        orgId: z.string().uuid().optional(),
      }),
    }),
  },

  userMembership: {
    assign: z.object({
      body: z.object({
        orgId: z.string().uuid(),
        entId: z.string().uuid().optional(),
        roleId: z.string().uuid(),
      }),
      params: z.object({
        userId: z.string().uuid(),
      }),
    }),
    remove: z.object({
      params: z.object({
        userId: z.string().uuid(),
        membershipId: z.string().uuid(),
      }),
    }),
    list: z.object({
      params: z.object({
        userId: z.string().uuid(),
      }),
    }),
  },

  delivery: {
    create: z.object({
      body: z.object({
        entId: z.string().uuid().optional(),
        trackingNumber: z.string().min(1).max(50),
        senderName: z.string().min(1).max(100),
        receiverName: z.string().min(1).max(100),
        destination: z.string().min(1).max(200),
        status: z.enum(['pending', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled']).default('pending'),
        createdBy: z.string().uuid().optional(),
      }),
      params: z.object({
        orgId: z.string().uuid(),
      }),
    }),
    update: z.object({
      body: z.object({
        entId: z.string().uuid().optional(),
        senderName: z.string().min(1).max(100).optional(),
        receiverName: z.string().min(1).max(100).optional(),
        destination: z.string().min(1).max(200).optional(),
      }),
      params: z.object({
        orgId: z.string().uuid(),
        id: z.string().uuid(),
      }),
    }),
    changeStatus: z.object({
      body: z.object({
        status: z.enum(['pending', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled']),
      }),
      params: z.object({
        orgId: z.string().uuid(),
        id: z.string().uuid(),
      }),
    }),
    get: z.object({
      params: z.object({
        orgId: z.string().uuid(),
        id: z.string().uuid(),
      }),
    }),
    track: z.object({
      params: z.object({
        orgId: z.string().uuid(),
        trackingNumber: z.string().min(1).max(50),
      }),
    }),
    list: z.object({
      params: z.object({
        orgId: z.string().uuid(),
      }),
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
        status: z.enum(['pending', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled']).optional(),
        entId: z.string().uuid().optional(),
      }),
    }),
  },

  inventory: {
    create: z.object({
      body: z.object({
        entId: z.string().uuid().optional(),
        name: z.string().min(1).max(200),
        sku: z.string().min(1).max(50),
        description: z.string().max(500).optional(),
        unit: z.string().min(1).max(20).default('piece'),
        costPrice: z.number().min(0).optional(),
        salePrice: z.number().min(0).optional(),
        trackInventory: z.boolean().default(true),
        minStockLevel: z.number().int().min(1).default(5),
        maxStockLevel: z.number().int().min(1).default(100),
      }),
      params: z.object({
        orgId: z.string().uuid(),
      }),
    }),
    update: z.object({
      body: z.object({
        entId: z.string().uuid().optional(),
        name: z.string().min(1).max(200).optional(),
        sku: z.string().min(1).max(50).optional(),
        description: z.string().max(500).optional(),
        unit: z.string().min(1).max(20).optional(),
        costPrice: z.number().min(0).optional(),
        salePrice: z.number().min(0).optional(),
        trackInventory: z.boolean().optional(),
        minStockLevel: z.number().int().min(1).optional(),
        maxStockLevel: z.number().int().min(1).optional(),
      }),
      params: z.object({
        orgId: z.string().uuid(),
        id: z.string().uuid(),
      }),
    }),
    list: z.object({
      params: z.object({
        orgId: z.string().uuid(),
      }),
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
        isActive: z.boolean().optional(),
        entId: z.string().uuid().optional(),
      }),
    }),
  },

  customer: {
    create: z.object({
      body: z.object({
        entId: z.string().uuid().optional(),
        name: z.string().min(1).max(150),
        email: z.string().email().optional(),
        mobile: z.string().min(10).max(20).regex(/^\+?[\d\s-]+$/).optional(),
        address: z.string().max(500).optional(),
      }),
      params: z.object({
        orgId: z.string().uuid(),
      }),
    }),
    update: z.object({
      body: z.object({
        entId: z.string().uuid().optional(),
        name: z.string().min(1).max(150).optional(),
        email: z.string().email().optional(),
        mobile: z.string().min(10).max(20).regex(/^\+?[\d\s-]+$/).optional(),
        address: z.string().max(500).optional(),
      }),
      params: z.object({
        orgId: z.string().uuid(),
        id: z.string().uuid(),
      }),
    }),
    list: z.object({
      params: z.object({
        orgId: z.string().uuid(),
      }),
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
        isActive: z.boolean().optional(),
        entId: z.string().uuid().optional(),
      }),
    }),
  },

  invoicing: {
    create: z.object({
      body: z.object({
        deliveryId: z.string().uuid().optional(),
        customerId: z.string().uuid().optional(),
        entId: z.string().uuid().optional(),
        invoiceNumber: z.string().min(1).max(50),
        subtotal: z.number().min(0).default(0),
        tax: z.number().min(0).default(0),
        total: z.number().min(0).default(0),
        dueDate: z.string().datetime().optional(),
        notes: z.string().max(500).optional(),
      }),
      params: z.object({
        orgId: z.string().uuid(),
      }),
    }),
    update: z.object({
      body: z.object({
        status: z.enum(['pending', 'paid', 'overdue', 'cancelled', 'void']).optional(),
        subtotal: z.number().min(0).optional(),
        tax: z.number().min(0).optional(),
        total: z.number().min(0).optional(),
        notes: z.string().max(500).optional(),
        dueDate: z.string().datetime().optional(),
      }),
      params: z.object({
        orgId: z.string().uuid(),
        id: z.string().uuid(),
      }),
    }),
    list: z.object({
      params: z.object({
        orgId: z.string().uuid(),
      }),
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
        status: z.enum(['pending', 'paid', 'overdue', 'cancelled', 'void']).optional(),
        customerId: z.string().uuid().optional(),
      }),
    }),
  },

  notification: {
    list: z.object({
      params: z.object({
        userId: z.string().uuid(),
        orgId: z.string().uuid(),
      }),
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
        type: z.string().optional(),
        read: z.boolean().optional(),
      }),
    }),
    markRead: z.object({
      body: z.object({
        notificationId: z.string().uuid(),
      }),
      params: z.object({
        userId: z.string().uuid(),
      }),
    }),
  },

  auth: {
    login: z.object({
      body: z.object({
        email: z.string().email(),
        password: z.string().min(8).max(128),
      }),
    }),
    register: z.object({
      body: z.object({
        email: z.string().email(),
        password: z.string().min(8).max(128),
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        mobile: z.string().min(10).max(20).regex(/^\+?[\d\s-]+$/),
      }),
    }),
    requestPasswordReset: z.object({
      body: z.object({
        email: z.string().email(),
      }),
    }),
    resetPassword: z.object({
      body: z.object({
        token: z.string().min(1),
        newPassword: z.string().min(8).max(128),
      }),
    }),
    changePassword: z.object({
      body: z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8).max(128),
      }),
    }),
    refreshToken: z.object({
      body: z.object({
        refreshToken: z.string().min(1),
      }),
    }),
    logout: z.object({
      body: z.object({
        refreshToken: z.string().optional(),
      }),
    }),
  },

  aiChat: {
    ask: z.object({
      body: z.object({
        question: z.string().min(1).max(1000),
      }),
      params: z.object({
        orgId: z.string().uuid(),
      }),
    }),
  },

  apiKey: {
    generate: z.object({
      body: z.object({
        name: z.string().min(1).max(100),
        permissionScopes: z.array(z.string()).optional(),
      }),
    }),
    validate: z.object({
      body: z.object({
        key: z.string().min(1),
      }),
    }),
  },
};

export const validateBody = (schema) => validate(z.object({ body: schema }));
export const validateQuery = (schema) => validate(z.object({ query: schema }));
export const validateParams = (schema) => validate(z.object({ params: schema }));