/** Shared action handler interface — used by MessageMenu (desktop) and MobileMessageSheet (mobile) */
export interface MessageActions {
  onCopy:           () => void
  onCreateTask:     () => void
  onOpenThread?:    () => void
  onMarkFollowup?:  () => void
  onUnmarkRequest?: () => void
  onMarkReceived?:  () => void
  onEdit?:          () => void
  onDelete?:        () => void
  onReact?:         (emoji: string) => void
  onReply?:         () => void
}

/** Shared context for conditional action visibility */
export interface MessageActionContext {
  isOwn:            boolean
  canEdit:          boolean
  needsResponse:    boolean
  responseReceived: boolean
}
