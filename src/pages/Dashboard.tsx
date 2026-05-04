import { GreetingWeatherCard } from '../components/dashboard/GreetingWeatherCard'
import { RequestsCard }        from '../components/dashboard/RequestsCard'
import { ShippingIndexCard }   from '../components/dashboard/ShippingIndexCard'
import { GlobalTradeCard }     from '../components/dashboard/GlobalTradeCard'
import { NewsCard }            from '../components/dashboard/NewsCard'
import { DisasterCard }        from '../components/dashboard/DisasterCard'
import { RegionalTicker }      from '../components/dashboard/RegionalTicker'
import { PortMapCard }         from '../components/dashboard/PortMapCard'
import { PortTop10Card }       from '../components/dashboard/PortTop5Card'
import type { Section }        from '../components/layout/MenuRail'

interface Props {
  onSectionChange: (s: Section) => void
}

export function Dashboard({ onSectionChange }: Props) {
  return (
    <div
      className="hidden md:flex flex-col h-full"
      style={{ background: 'var(--chat-bg)' }}
    >
      {/* Header — h-14 with regional ticker */}
      <header
        className="h-14 flex items-center px-5 gap-4 flex-shrink-0 chat-header"
        style={{
          background:   'var(--card)',
          borderBottom: '1px solid var(--line)',
          boxShadow:    'var(--shadow-header)',
        }}
      >
        <RegionalTicker />
      </header>

      {/* Cards — 3 rows, no overflow scroll */}
      <div className="flex-1 min-h-0 p-4 flex flex-col gap-3">

        {/* Row 1: GreetingWeather | Requests | ShippingIndex — fixed height */}
        <div className="grid grid-cols-3 gap-3 flex-shrink-0" style={{ height: '160px', gridTemplateRows: '1fr', overflow: 'hidden' }}>
          <GreetingWeatherCard />
          <RequestsCard onSectionChange={onSectionChange} />
          <ShippingIndexCard />
        </div>

        {/* Row 2: Map (2/3) | GlobalTrade + News stacked (1/3) — fills remaining */}
        <div className="grid grid-cols-3 gap-3 flex-1 min-h-0">
          {/* Map — takes 2 columns */}
          <div className="col-span-2 min-h-0">
            <PortMapCard />
          </div>

          {/* GlobalTrade (fixed) + News (flex grow) stacked */}
          <div className="flex flex-col gap-3 min-h-0 h-full">
            <div className="flex-shrink-0" style={{ height: '165px' }}>
              <GlobalTradeCard />
            </div>
            <div className="flex-1 min-h-0">
              <NewsCard />
            </div>
          </div>
        </div>

        {/* Row 3: Top10 (2/3) | Disaster (1/3) — fixed height */}
        <div className="grid grid-cols-3 gap-3 flex-shrink-0" style={{ height: '220px', gridTemplateRows: '1fr', overflow: 'hidden' }}>
          <div className="col-span-2 min-h-0">
            <PortTop10Card />
          </div>
          <DisasterCard />
        </div>

      </div>
    </div>
  )
}
