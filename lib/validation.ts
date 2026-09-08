import { z } from 'zod'
import {
  CATEGORIES,
  CHANNELS,
  DEPARTMENTS,
  PRIORITIES,
  ROLES,
  STATUSES,
} from './constants'

// Every API route parses its input through one of these. No route trusts
// the client — role checks live in lib/auth.ts, shape checks live here.

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const createTicketSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'Title must be at least 5 characters')
    .max(150, 'Title must be under 150 characters'),
  description: z
    .string()
    .trim()
    .min(10, 'Please describe the issue in at least 10 characters')
    .max(5000, 'Description must be under 5000 characters'),
  // All three are optional: when omitted the classifier fills them in.
  category: z.enum(CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  channel: z.enum(CHANNELS).default('WEB'),
})

export const updateTicketSchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    category: z.enum(CATEGORIES).optional(),
    department: z.enum(DEPARTMENTS).optional(),
    assignedToId: z.string().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'No changes supplied',
  })

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(5000),
  isInternal: z.boolean().default(false),
})

export const rateTicketSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
})

export const ticketFilterSchema = z.object({
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  category: z.enum(CATEGORIES).optional(),
  department: z.enum(DEPARTMENTS).optional(),
  assignedToId: z.string().optional(),
  createdById: z.string().optional(),
  search: z.string().trim().max(200).optional(),
  slaBreached: z.coerce.boolean().optional(),
  sort: z.enum(['newest', 'oldest', 'priority', 'due']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(2).max(100),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(ROLES).default('EMPLOYEE'),
  department: z.enum(DEPARTMENTS).optional(),
  employeeCode: z.string().trim().max(30).optional(),
  phone: z.string().trim().max(20).optional(),
})

export const updateUserSchema = createUserSchema
  .partial()
  .omit({ password: true })
  .extend({ isActive: z.boolean().optional() })

export const slaPolicySchema = z.object({
  name: z.string().trim().min(2).max(80),
  priority: z.enum(PRIORITIES),
  firstResponseMins: z.number().int().min(1).max(100000),
  resolutionMins: z.number().int().min(1).max(1000000),
  businessHoursOnly: z.boolean().default(true),
  isActive: z.boolean().default(true),
})

export const routingRuleSchema = z.object({
  name: z.string().trim().min(2).max(80),
  priority: z.number().int().min(1).max(1000).default(100),
  matchCategory: z.enum(CATEGORIES).nullable().optional(),
  matchKeywords: z.string().trim().max(500).default(''),
  matchPriority: z.enum(PRIORITIES).nullable().optional(),
  assignDepartment: z.enum(DEPARTMENTS),
  assignToUserId: z.string().nullable().optional(),
  setPriority: z.enum(PRIORITIES).nullable().optional(),
  isActive: z.boolean().default(true),
})

export const kbArticleSchema = z.object({
  title: z.string().trim().min(5).max(150),
  body: z.string().trim().min(20).max(50000),
  category: z.enum(CATEGORIES),
  tags: z.string().trim().max(300).default(''),
  isPublished: z.boolean().default(false),
})

export type CreateTicketInput = z.infer<typeof createTicketSchema>
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>
export type TicketFilterInput = z.infer<typeof ticketFilterSchema>
