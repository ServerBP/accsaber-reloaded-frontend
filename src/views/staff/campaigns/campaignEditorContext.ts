import { inject, type InjectionKey } from 'vue'
import type { useCampaignEditor } from './useCampaignEditor'

export type CampaignEditorContext = ReturnType<typeof useCampaignEditor>

export const CAMPAIGN_EDITOR_KEY: InjectionKey<CampaignEditorContext> = Symbol('campaignEditor')

export function useCampaignEditorContext(): CampaignEditorContext {
  const ctx = inject(CAMPAIGN_EDITOR_KEY)
  if (!ctx) {
    throw new Error('useCampaignEditorContext must be used within the campaign editor')
  }
  return ctx
}
