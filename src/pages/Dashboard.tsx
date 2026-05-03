import { GreetingCard }      from '../components/dashboard/GreetingCard'
import { WeatherCard }       from '../components/dashboard/WeatherCard'
import { RequestsCard }      from '../components/dashboard/RequestsCard'
import { ShippingIndexCard } from '../components/dashboard/ShippingIndexCard'
import { NewsCard }          from '../components/dashboard/NewsCard'
import type { Section }      from '../components/layout/MenuRail'

interface Props {
  onSectionChange: (s: Section) => void
}

export function Dashboard({ onSectionChange }: Props) {
  return (
    <div
      className="hidden md:flex flex-col h-full overflow-y-auto p-6 gap-4"
      style={{ background: 'var(--chat-bg)' }}
    >
      {/* Row 1: Greeting (2/3) + Weather (1/3) */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <GreetingCard />
        </div>
        <div className="col-span-1">
          <WeatherCard />
        </div>
      </div>

      {/* Row 2: Requests (full width) */}
      <RequestsCard onSectionChange={onSectionChange} />

      {/* Row 3: ShippingIndex + News */}
      <div className="grid grid-cols-2 gap-4">
        <ShippingIndexCard />
        <NewsCard />
      </div>
    </div>
  )
}
