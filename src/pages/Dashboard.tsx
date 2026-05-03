import { GreetingCard }      from '../components/dashboard/GreetingCard'
import { WeatherCard }       from '../components/dashboard/WeatherCard'
import { RequestsCard }      from '../components/dashboard/RequestsCard'
import { ShippingIndexCard } from '../components/dashboard/ShippingIndexCard'
import { NewsCard }          from '../components/dashboard/NewsCard'
import { PortRankingCard }   from '../components/dashboard/PortRankingCard'
import { GlobalTradeCard }   from '../components/dashboard/GlobalTradeCard'
import { DisasterCard }      from '../components/dashboard/DisasterCard'
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
      {/* Header — h-14 (56px) matches ChatHeader height */}
      <header
        className="h-14 flex items-center px-4 flex-shrink-0 chat-header"
        style={{
          background:   'var(--card)',
          borderBottom: '1px solid var(--line)',
          boxShadow:    'var(--shadow-header)',
        }}
      />

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">

        {/* Row 1: Greeting | Requests | Weather */}
        <div className="grid grid-cols-3 gap-4">
          <GreetingCard />
          <RequestsCard onSectionChange={onSectionChange} />
          <WeatherCard />
        </div>

        {/* Row 2: ShippingIndex | PortRanking | GlobalTrade */}
        <div className="grid grid-cols-3 gap-4">
          <ShippingIndexCard />
          <PortRankingCard />
          <GlobalTradeCard />
        </div>

        {/* Row 3: News (2/3) | Disaster (1/3) */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2"><NewsCard /></div>
          <DisasterCard />
        </div>

      </div>
    </div>
  )
}
