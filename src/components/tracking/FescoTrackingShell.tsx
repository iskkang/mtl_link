import { useState } from 'react'
import { ContainerDashboard } from './ContainerDashboard'
import { FescoTrackingPage  } from './FescoTrackingPage'

type TrackingView = 'dashboard' | 'bookings'

// Manages the active sub-view within the tracking section.
// Mounted fresh each time the user enters the tracking section,
// so activeView always resets to 'dashboard' on section re-entry.
export function FescoTrackingShell() {
  const [activeView, setActiveView] = useState<TrackingView>('dashboard')

  if (activeView === 'bookings') {
    return <FescoTrackingPage onBack={() => setActiveView('dashboard')} />
  }

  return <ContainerDashboard onViewBookings={() => setActiveView('bookings')} />
}
