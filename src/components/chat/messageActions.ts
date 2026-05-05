/** Shared action handler interface — used by MessageMenu (desktop) and MobileMessageSheet (mobile) */
export interface MessageActions {
  onReply:          () => void
  onCopy:           () => void
  onCreateTask:     () => void
  onMarkFollowup?:  () => void
  onUnmarkRequest?: () => void
  onMarkReceived?:  () => void
  onEdit?:          () => void
  onDelete?:        () => void
}

/** Shared context for conditional action visibility */
export interface MessageActionContext {
  isOwn:            boolean
  canEdit:          boolean
  needsResponse:    boolean
  responseReceived: boolean
}
