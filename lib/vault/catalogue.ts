// Reward Vault — reward catalogue read/write functions.
// Reads and writes reward_catalog only. Admin-only writes.
// SAFETY: no imports from lib/points, lib/sm2, lib/cards, lib/adaptive.
// Child-facing code must never import this module — catalogue items contain
// price_pence which must never be exposed to child sessions.

import { prisma } from '@/lib/prisma'

export interface CatalogueItem {
  id: string
  name: string
  description: string | null
  category: string | null
  min_milestone: string | null
  price_pence: number
  image_url: string | null
  is_active: boolean
  created_at: Date
}

export interface CatalogueItemCreate {
  name: string
  description?: string
  category?: string
  min_milestone?: string
  price_pence?: number
}

export interface CatalogueItemUpdate {
  name?: string
  description?: string | null
  category?: string | null
  min_milestone?: string | null
  price_pence?: number
  is_active?: boolean
}

/** Active items only — for parent approve flow. Never call from child routes. */
export async function getActiveCatalogueItems(): Promise<CatalogueItem[]> {
  const rows = await prisma.rewardCatalog.findMany({
    where: { is_active: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    min_milestone: row.min_milestone,
    price_pence: row.price_pence,
    image_url: row.image_url,
    is_active: row.is_active,
    created_at: row.created_at,
  }))
}

/** All items including inactive — admin only. */
export async function getAllCatalogueItems(): Promise<CatalogueItem[]> {
  const rows = await prisma.rewardCatalog.findMany({
    orderBy: [{ is_active: 'desc' }, { category: 'asc' }, { name: 'asc' }],
  })
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    min_milestone: row.min_milestone,
    price_pence: row.price_pence,
    image_url: row.image_url,
    is_active: row.is_active,
    created_at: row.created_at,
  }))
}

/** Admin only. */
export async function createCatalogueItem(data: CatalogueItemCreate): Promise<CatalogueItem> {
  const name = data.name.trim()
  if (!name) throw new Error('Item name is required')
  if (name.length > 120) throw new Error('Item name must be 120 characters or fewer')
  if (data.description && data.description.length > 280) {
    throw new Error('Description must be 280 characters or fewer')
  }
  if (data.price_pence !== undefined && (!Number.isInteger(data.price_pence) || data.price_pence < 0)) {
    throw new Error('price_pence must be a non-negative integer')
  }

  const row = await prisma.rewardCatalog.create({
    data: {
      name,
      description: data.description?.trim() || null,
      category: data.category?.trim() || null,
      min_milestone: data.min_milestone || null,
      price_pence: data.price_pence ?? 0,
      is_active: true,
    },
  })
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    min_milestone: row.min_milestone,
    price_pence: row.price_pence,
    image_url: row.image_url,
    is_active: row.is_active,
    created_at: row.created_at,
  }
}

/** Admin only. */
export async function updateCatalogueItem(
  id: string,
  updates: CatalogueItemUpdate,
): Promise<CatalogueItem> {
  if (updates.name !== undefined) {
    const name = updates.name.trim()
    if (!name) throw new Error('Item name cannot be empty')
    if (name.length > 120) throw new Error('Item name must be 120 characters or fewer')
    updates.name = name
  }
  if (updates.description !== undefined && updates.description !== null) {
    if (updates.description.length > 280) throw new Error('Description must be 280 characters or fewer')
  }
  if (updates.price_pence !== undefined) {
    if (!Number.isInteger(updates.price_pence) || updates.price_pence < 0) {
      throw new Error('price_pence must be a non-negative integer')
    }
  }

  const data: Record<string, unknown> = {}
  if (updates.name !== undefined)          data.name = updates.name
  if (updates.description !== undefined)   data.description = updates.description
  if (updates.category !== undefined)      data.category = updates.category
  if (updates.min_milestone !== undefined) data.min_milestone = updates.min_milestone
  if (updates.price_pence !== undefined)   data.price_pence = updates.price_pence
  if (updates.is_active !== undefined)     data.is_active = updates.is_active

  const row = await prisma.rewardCatalog.update({ where: { id }, data })
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    min_milestone: row.min_milestone,
    price_pence: row.price_pence,
    image_url: row.image_url,
    is_active: row.is_active,
    created_at: row.created_at,
  }
}
