import type {
  AdminItemListParams,
  AdminItemTypeListParams,
  AwardItemRequest,
  CreateItemRequest,
  CreateItemTypeRequest,
  ItemModifierResponse,
  ItemResponse,
  ItemTypeResponse,
  PatchItemModifierRequest,
  UpdateItemRequest,
  UpdateItemTypeRequest,
  UserItemResponse,
} from '@/types/api/items'
import { del, get, patch, post, postMultipart } from '../client'
import { buildQuery } from '../utils'

export function getAdminItemTypes(
  params?: AdminItemTypeListParams,
): Promise<ItemTypeResponse[]> {
  return get<ItemTypeResponse[]>(`/admin/item-types${buildQuery(params)}`)
}

export function createItemType(req: CreateItemTypeRequest): Promise<ItemTypeResponse> {
  return post<ItemTypeResponse>('/admin/item-types', req)
}

export function updateItemType(
  id: string,
  req: UpdateItemTypeRequest,
): Promise<ItemTypeResponse> {
  return patch<ItemTypeResponse>(`/admin/item-types/${id}`, req)
}

export function setItemTypeActive(id: string, active: boolean): Promise<ItemTypeResponse> {
  return patch<ItemTypeResponse>(`/admin/item-types/${id}/active${buildQuery({ active })}`)
}

export function getAdminItems(params?: AdminItemListParams): Promise<ItemResponse[]> {
  return get<ItemResponse[]>(`/admin/items${buildQuery(params)}`)
}

export function getAdminItem(id: string): Promise<ItemResponse> {
  return get<ItemResponse>(`/admin/items/${id}`)
}

export function createItem(req: CreateItemRequest): Promise<ItemResponse> {
  return post<ItemResponse>('/admin/items', req)
}

export function updateItem(id: string, req: UpdateItemRequest): Promise<ItemResponse> {
  return patch<ItemResponse>(`/admin/items/${id}`, req)
}

export function setItemActive(id: string, active: boolean): Promise<ItemResponse> {
  return patch<ItemResponse>(`/admin/items/${id}/active${buildQuery({ active })}`)
}

export function deprecateItem(id: string): Promise<ItemResponse> {
  return post<ItemResponse>(`/admin/items/${id}/deprecate`)
}

export function uploadItemIcon(id: string, file: File): Promise<ItemResponse> {
  const form = new FormData()
  form.append('file', file)
  return postMultipart<ItemResponse>(`/admin/items/${id}/icon`, form)
}

export function deleteItemIcon(id: string): Promise<ItemResponse> {
  return del<ItemResponse>(`/admin/items/${id}/icon`)
}

export function patchAdminItemModifier(
  id: string,
  req: PatchItemModifierRequest,
): Promise<ItemModifierResponse> {
  return patch<ItemModifierResponse>(`/admin/item-modifiers/${id}`, req)
}

export function awardItem(req: AwardItemRequest): Promise<UserItemResponse> {
  return post<UserItemResponse>('/admin/items/award', req)
}

export function revokeAwardedItem(linkId: string): Promise<void> {
  return del<void>(`/admin/items/awards/${linkId}`)
}
