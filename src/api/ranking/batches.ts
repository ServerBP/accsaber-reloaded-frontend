import type { CreateBatchRequest, UpdateBatchRequest, UpdateBatchStatusRequest } from '@/types/api/admin'
import type { BatchResponse, RankingBatchListParams } from '@/types/api/batches'
import type { Page } from '@/types/pagination'
import { del, get, patch, post } from '../client'
import { buildQuery } from '../utils'

export function listBatches(params?: RankingBatchListParams): Promise<Page<BatchResponse>> {
  return get<Page<BatchResponse>>(`/ranking/batches${buildQuery(params)}`)
}

export function getBatch(batchId: string): Promise<BatchResponse> {
  return get<BatchResponse>(`/ranking/batches/${batchId}`)
}

export function createBatch(req: CreateBatchRequest): Promise<BatchResponse> {
  return post<BatchResponse>('/ranking/batches', req)
}

export function updateBatch(batchId: string, req: UpdateBatchRequest): Promise<BatchResponse> {
  return patch<BatchResponse>(`/ranking/batches/${batchId}`, req)
}

export function updateBatchStatus(
  batchId: string,
  req: UpdateBatchStatusRequest,
): Promise<BatchResponse> {
  return patch<BatchResponse>(`/ranking/batches/${batchId}/status`, req)
}

export function addDifficultyToBatch(
  batchId: string,
  difficultyId: string,
): Promise<BatchResponse> {
  return post<BatchResponse>(`/ranking/batches/${batchId}/difficulties/${difficultyId}`)
}

export function removeDifficultyFromBatch(
  batchId: string,
  difficultyId: string,
): Promise<void> {
  return del<void>(`/ranking/batches/${batchId}/difficulties/${difficultyId}`)
}

export function releaseBatch(batchId: string): Promise<BatchResponse> {
  return post<BatchResponse>(`/ranking/batches/${batchId}/release`)
}

export function reweightBatch(
  batchId: string,
  req: { items: { mapDifficultyId: string; complexity: number }[]; reason: string },
): Promise<void> {
  return post<void>(`/ranking/batches/${batchId}/reweight`, req)
}

export function recalculateBatch(batchId: string): Promise<void> {
  return post<void>(`/ranking/batches/${batchId}/recalculate`)
}
