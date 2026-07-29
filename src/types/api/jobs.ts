export type JobStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED'

export type JobFieldKind =
  | 'USER'
  | 'CAMPAIGN'
  | 'MAP_DIFFICULTY'
  | 'MILESTONE'
  | 'INSTANT'
  | 'PLATFORM'
  | 'FLAG'

export type LeaderboardPlatform = 'BEATLEADER' | 'SCORESABER'

export interface JobFieldResponse {
  key: string
  kind: JobFieldKind
  required: boolean
  multiple: boolean
  label: string
  description: string | null
}

export interface JobTypeResponse {
  type: string
  group: string
  label: string
  description: string
  fields: JobFieldResponse[]
}

export type JobFieldValue = string | string[] | boolean | null

export interface RunJobRequest {
  type: string
  [key: string]: JobFieldValue | undefined
}

export interface JobResponse {
  id: string
  type: string
  detail: string | null
  status: JobStatus
  startedAt: string
  finishedAt: string | null
  error: string | null
}
