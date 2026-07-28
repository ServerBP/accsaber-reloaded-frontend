import type { JobResponse, RunJobRequest } from '@/types/api/jobs'
import { get, post } from '../client'

export function runJob(req: RunJobRequest): Promise<JobResponse> {
  return post<JobResponse>('/admin/jobs', req)
}

export function getJobs(): Promise<JobResponse[]> {
  return get<JobResponse[]>('/admin/jobs')
}

export function getJob(jobId: string): Promise<JobResponse> {
  return get<JobResponse>(`/admin/jobs/${jobId}`)
}
