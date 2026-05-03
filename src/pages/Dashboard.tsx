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
      className="hidden md:flex flex-col h-full"
      style={{ background: 'var(--chat-bg)' }}
    >
      {/* Header — same height as sidebar chat header (py-3.5) */}
      <header
        className="flex items-center px-6 py-3.5 flex-shrink-0 border-b"
        style={{ borderColor: 'var(--line)' }}
      />

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">

        {/* Row 1: Greeting (2/3) + Weather (1/3) */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2"><GreetingCard /></div>
          <div className="col-span-1"><WeatherCard /></div>
        </div>

        {/* Row 2: Requests (2/3) + ShippingIndex (1/3) */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <RequestsCard onSectionChange={onSectionChange} />
          </div>
          <div className="col-span-1"><ShippingIndexCard /></div>
        </div>

        {/* Row 3: News (full width) */}
        <NewsCard />

      </div>
    </div>
  )
}
