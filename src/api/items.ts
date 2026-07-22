import type {
  DisintegrationResponse,
  EquipItemRequest,
  EquippedItemsResponse,
  EssenceBalance,
  InventoryListParams,
  ItemHolderListParams,
  ItemHolderResponse,
  ItemListParams,
  ItemModifierResponse,
  ItemResponse,
  ItemTypeResponse,
  UnusualEffectGroupsResponse,
  UnusualEffectResponse,
  UserItemListParams,
  UserItemResponse,
} from '@/types/api/items'
import type { Page } from '@/types/pagination'
import { del, get, post } from './client'
import { buildQuery } from './utils'

export function getItemTypes(): Promise<ItemTypeResponse[]> {
  return get<ItemTypeResponse[]>('/item-types')
}

export function getItemModifiers(): Promise<ItemModifierResponse[]> {
  return get<ItemModifierResponse[]>('/item-modifiers')
}

export function getUnusualEffects(): Promise<UnusualEffectResponse[]> {
  return get<UnusualEffectResponse[]>('/unusual-effects')
}

export function getUnusualEffectGroups(): Promise<UnusualEffectGroupsResponse> {
  return get<UnusualEffectGroupsResponse>('/unusual-effects/grouped')
}

export function getItems(params?: ItemListParams): Promise<ItemResponse[]> {
  return get<ItemResponse[]>(`/items${buildQuery(params)}`)
}

export function getItem(id: string): Promise<ItemResponse> {
  return get<ItemResponse>(`/items/${id}`)
}

export function getItemHolders(
  itemId: string,
  params?: ItemHolderListParams,
): Promise<Page<ItemHolderResponse>> {
  return get<Page<ItemHolderResponse>>(`/items/${itemId}/holders${buildQuery(params)}`)
}

export function getUserItems(
  userId: string,
  params?: UserItemListParams,
): Promise<UserItemResponse[]> {
  return get<UserItemResponse[]>(`/users/${userId}/items${buildQuery(params)}`)
}

export function getUserEquippedItems(userId: string): Promise<EquippedItemsResponse> {
  return get<EquippedItemsResponse>(`/users/${userId}/items/equipped`)
}

export function getUserInventory(
  userId: string,
  params?: InventoryListParams,
): Promise<Page<UserItemResponse>> {
  return get<Page<UserItemResponse>>(`/users/${userId}/inventory${buildQuery(params)}`)
}

export function equipItem(req: EquipItemRequest): Promise<void> {
  return post<void>('/users/me/items/equip', req)
}

export function unequipItem(typeKey: string): Promise<void> {
  return del<void>(`/users/me/items/equip/${typeKey}`)
}

export function disintegrateItem(
  linkId: string,
  quantity?: number,
): Promise<DisintegrationResponse> {
  const query = buildQuery(quantity != null ? { quantity } : undefined)
  return post<DisintegrationResponse>(`/users/me/items/${linkId}/disintegrate${query}`)
}

export function getEssenceBalance(): Promise<EssenceBalance> {
  return get<EssenceBalance>('/users/me/essence')
}
