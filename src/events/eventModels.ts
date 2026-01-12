// src/events/eventModels.ts
import type { EventType } from './eventTypes'

export interface BaseEvent {
  id: string
  type: EventType
  timestamp: string
}

export interface AllocationProposedEvent extends BaseEvent {
  type: 'AllocationProposed'
  payload: {
    recordId: string
    allocation: {
      categoryID: number | null
      subCategoryID: number | null
      payeeID: number | null
      comment: string
      amount: number
    }
  }
}

export interface AllocationRemovedEvent extends BaseEvent {
  type: 'AllocationRemoved'
  payload: {
    recordId: string
    index: number
  }
}

export interface AllocationSavedEvent extends BaseEvent {
  type: 'AllocationSaved'
  payload: {
    recordId: string
  }
}

export type AppEvent =
  | AllocationProposedEvent
  | AllocationRemovedEvent
  | AllocationSavedEvent