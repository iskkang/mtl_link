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
      {/* Header */}
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

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4 flex flex-col gap-3">

        {/* Row 1: GreetingWeather | Requests | ShippingIndex */}
        <div
          className="grid grid-cols-3 gap-3 flex-shrink-0"
          style={{ height: '160px', gridTemplateRows: '1fr', overflow: 'hidden' }}
        >
          <GreetingWeatherCard />
          <RequestsCard onSectionChange={onSectionChange} />
          <ShippingIndexCard />
        </div>

        {/*
          Main grid (Rows 2+3):
          - 3 cols × 2 rows
          - Row heights: flex-1 (map row) + 220px (bottom row)
          - Col 3 spans both rows → GlobalTrade (fixed 165px) + News (flex-1 tall)
          - Col 1-2 row 1 → Map
          - Col 1 row 2 → PortTop10  (same 1/3 width as Row1 col1)
          - Col 2 row 2 → Disaster   (same 1/3 width as Row1 col2)
        */}
        <div
          className="grid gap-3 flex-1"
          style={{
            gridTemplateColumns: '1fr 1fr 1fr',
            gridTemplateRows:    '1fr 220px',
            minHeight:           '460px',
          }}
        >
          {/* Map: col 1-2, row 1 */}
          <div style={{ gridColumn: '1 / 3', gridRow: '1' }} className="min-h-0">
            <PortMapCard />
          </div>

          {/* Right column: spans rows 1-2, GlobalTrade top + News bottom */}
          <div
            style={{ gridColumn: '3', gridRow: '1 / 3' }}
            className="flex flex-col gap-3 min-h-0"
          >
            <div style={{ height: '165px' }} className="flex-shrink-0">
              <GlobalTradeCard />
            </div>
            <div className="flex-1 min-h-0">
              <NewsCard />
            </div>
          </div>

          {/* PortTop10: col 1, row 2 — same width as GreetingWeatherCard */}
          <div style={{ gridColumn: '1', gridRow: '2' }} className="min-h-0">
            <PortTop10Card />
          </div>

          {/* Disaster: col 2, row 2 — same width as RequestsCard */}
          <div style={{ gridColumn: '2', gridRow: '2' }} className="min-h-0">
            <DisasterCard />
          </div>
        </div>

      </div>
    </div>
  )
}
