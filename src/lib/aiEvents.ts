type TitleHandler    = (sessionId: string, newTitle: string) => void
type DeleteHandler   = (sessionId: string) => void
type NavigateHandler = (view: string) => void

const titleHandlers    = new Set<TitleHandler>()
const deleteHandlers   = new Set<DeleteHandler>()
const navigateHandlers = new Set<NavigateHandler>()

export const aiEvents = {
  onTitleChange:   (fn: TitleHandler)  => { titleHandlers.add(fn);  return () => { titleHandlers.delete(fn)  } },
  emitTitleChange: (sessionId: string, newTitle: string) => titleHandlers.forEach(fn => fn(sessionId, newTitle)),
  onDeleted:       (fn: DeleteHandler) => { deleteHandlers.add(fn); return () => { deleteHandlers.delete(fn) } },
  emitDeleted:     (sessionId: string) => deleteHandlers.forEach(fn => fn(sessionId)),
  onNavigate:      (fn: NavigateHandler) => { navigateHandlers.add(fn); return () => { navigateHandlers.delete(fn) } },
  emitNavigate:    (view: string) => navigateHandlers.forEach(fn => fn(view)),
}
