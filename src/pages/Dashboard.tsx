import { GreetingCard }    from '../components/dashboard/GreetingCard'
import { WeatherCard }     from '../components/dashboard/WeatherCard'
import { RequestsCard }    from '../components/dashboard/RequestsCard'
import { ShippingIndexCard } from '../components/dashboard/ShippingIndexCard'
import { GlobalTradeCard } from '../components/dashboard/GlobalTradeCard'
import { NewsCard }        from '../components/dashboard/NewsCard'
import { DisasterCard }    from '../components/dashboard/DisasterCard'
import { RegionalTicker }  from '../components/dashboard/RegionalTicker'
import { PortMapCard }     from '../components/dashboard/PortMapCard'
import { PortTop5Card }    from '../components/dashboard/PortTop5Card'
import type { Section }    from '../components/layout/MenuRail'

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

        {/* Row 1: Greeting | Requests | Weather — fixed height */}
        <div className="grid grid-cols-3 gap-3 flex-shrink-0" style={{ height: '120px' }}>
          <GreetingCard />
          <RequestsCard onSectionChange={onSectionChange} />
          <WeatherCard />
        </div>

        {/* Row 2: Map (2/3) | Shipping + Trade stacked (1/3) — fills remaining */}
        <div className="grid grid-cols-3 gap-3 flex-1 min-h-0">
          {/* Map — takes 2 columns */}
          <div className="col-span-2 min-h-0">
            <PortMapCard />
          </div>

          {/* Shipping Index + Global Trade stacked */}
          <div className="flex flex-col gap-3 min-h-0 h-full">
            <div className="flex-1 min-h-0">
              <ShippingIndexCard />
            </div>
            <div className="flex-1 min-h-0">
              <GlobalTradeCard />
            </div>
          </div>
        </div>

        {/* Row 3: News | Disaster | Top5 — fixed height */}
        <div className="grid grid-cols-3 gap-3 flex-shrink-0" style={{ height: '200px' }}>
          <NewsCard />
          <DisasterCard />
          <PortTop5Card />
        </div>

      </div>
    </div>
  )
}
