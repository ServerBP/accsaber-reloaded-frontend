import type { JobResponse, JobTypeResponse, RunJobRequest } from '@/types/api/jobs'
import { get, post } from '../client'

export function getJobTypes(): Promise<JobTypeResponse[]> {
  return get<JobTypeResponse[]>('/admin/jobs/types')
}

export function runJob(req: RunJobRequest): Promise<JobResponse> {
  return post<JobResponse>('/admin/jobs', req)
}

export function getJobs(): Promise<JobResponse[]> {
  return get<JobResponse[]>('/admin/jobs')
}
