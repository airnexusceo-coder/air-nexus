import type { Industry, NewsTone, Stock } from '@/lib/market-masters/types'

export type ResolvedMarketEvent = {
  id: string
  tone: NewsTone
  /** True when the headline is written to sound bigger than the actual price impact — used to teach hype-spotting. */
  misleading: boolean
  headline: string
  body: string
  impacts: { ticker: string; percent: number }[]
}

type EventContext = {
  stocks: Stock[]
  rng: () => number
  day: number
}

type EventDefinition = {
  id: string
  /** Relative chance of being picked on a tick that rolls an event; not a probability on its own. */
  weight: number
  generate: (ctx: EventContext) => ResolvedMarketEvent | null
}

function randomInRange(min: number, max: number, rng: () => number) {
  return min + rng() * (max - min)
}

function pickOne<T>(items: T[], rng: () => number): T | undefined {
  if (items.length === 0) return undefined
  return items[Math.floor(rng() * items.length)]
}

function byIndustry(stocks: Stock[], industry: Industry) {
  return stocks.filter((stock) => stock.industry === industry)
}

function byIndustries(stocks: Stock[], industries: Industry[]) {
  return stocks.filter((stock) => industries.includes(stock.industry))
}

const LOAN_SENSITIVE_INDUSTRIES: Industry[] = ['Technology', 'Retail', 'Transport', 'Airlines', 'Automotive', 'Construction', 'Real Estate']

// --- Reusable "flavor" writing pools, so the same event type reads differently each time it fires ---

const CEO_TITLES = ['chief executive', 'incoming CEO', 'newly appointed leader']
const ANALYST_HOUSES = ['Meridian Research', 'Blackridge Capital', 'Northgate Advisors', 'Fairview Equity Partners', 'Corsair Markets', 'Willowbrook Securities']

const EVENT_DEFINITIONS: EventDefinition[] = [
  {
    id: 'successful-product',
    weight: 3,
    generate: ({ stocks, rng }) => {
      const pool = byIndustries(stocks, ['Technology', 'Healthcare', 'Renewable Energy', 'Entertainment', 'Artificial Intelligence', 'Gaming'])
      const stock = pickOne(pool, rng)
      if (!stock) return null
      const percent = randomInRange(3, 9, rng)
      const headline = pickOne([
        `${stock.name} launches a well-received new product`,
        `Early reviews praise ${stock.name}'s newest release`,
        `${stock.name} unveils its most ambitious product yet`,
      ], rng)!
      return {
        id: 'successful-product',
        tone: 'positive',
        misleading: false,
        headline,
        body: `${stock.name} (${stock.ticker}) unveiled a new product that early reviews describe as a genuine improvement over its last release. Independent testers highlighted better performance and fewer rough edges than the previous version, and analysts nudged their outlook up.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'lower-sales',
    weight: 3,
    generate: ({ stocks, rng }) => {
      const pool = byIndustries(stocks, ['Retail', 'Food & Beverages', 'Entertainment', 'Transport', 'Automotive', 'Manufacturing'])
      const stock = pickOne(pool, rng)
      if (!stock) return null
      const percent = -randomInRange(2, 7, rng)
      const headline = pickOne([
        `${stock.name} reports softer quarterly sales`,
        `${stock.name} misses its own sales target for the quarter`,
        `Demand cools for ${stock.name} this quarter`,
      ], rng)!
      return {
        id: 'lower-sales',
        tone: 'negative',
        misleading: false,
        headline,
        body: `${stock.name} (${stock.ticker}) told investors that sales grew slower than expected last quarter. Management pointed to cautious customer spending and said it was watching costs closely heading into the next quarter.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'interest-rates-rise',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const banks = byIndustry(stocks, 'Banking')
      const borrowers = byIndustries(stocks, LOAN_SENSITIVE_INDUSTRIES)
      if (banks.length === 0 && borrowers.length === 0) return null
      const impacts = [
        ...banks.map((s) => ({ ticker: s.ticker, percent: randomInRange(1, 4, rng) })),
        ...borrowers.map((s) => ({ ticker: s.ticker, percent: -randomInRange(1, 3.5, rng) })),
      ]
      return {
        id: 'interest-rates-rise',
        tone: 'neutral',
        misleading: false,
        headline: 'Central bank raises interest rates',
        body: 'Borrowing just became more expensive. Banks tend to earn more on loans when rates rise, while companies that rely on borrowed money to grow — retailers, airlines, automakers, builders, property developers — can feel the pinch as their own financing costs climb.',
        impacts,
      }
    },
  },
  {
    id: 'interest-rates-fall',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const banks = byIndustry(stocks, 'Banking')
      const borrowers = byIndustries(stocks, LOAN_SENSITIVE_INDUSTRIES)
      if (banks.length === 0 && borrowers.length === 0) return null
      const impacts = [
        ...banks.map((s) => ({ ticker: s.ticker, percent: -randomInRange(1, 3, rng) })),
        ...borrowers.map((s) => ({ ticker: s.ticker, percent: randomInRange(1, 4, rng) })),
      ]
      return {
        id: 'interest-rates-fall',
        tone: 'neutral',
        misleading: false,
        headline: 'Central bank cuts interest rates',
        body: 'Borrowing just became cheaper. Growth-focused companies that rely on loans to expand often benefit from lower financing costs, while banks earn a little less per loan as a result.',
        impacts,
      }
    },
  },
  {
    id: 'fuel-prices-rise',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const energy = byIndustries(stocks, ['Oil & Gas'])
      const fuelBurners = byIndustries(stocks, ['Transport', 'Airlines'])
      if (energy.length === 0 && fuelBurners.length === 0) return null
      const impacts = [
        ...energy.map((s) => ({ ticker: s.ticker, percent: randomInRange(2, 6, rng) })),
        ...fuelBurners.map((s) => ({ ticker: s.ticker, percent: -randomInRange(2, 6, rng) })),
      ]
      return {
        id: 'fuel-prices-rise',
        tone: 'neutral',
        misleading: false,
        headline: 'Global fuel prices climb',
        body: 'Higher fuel prices are good news for oil and gas producers but raise costs for airlines, freight companies, and shipping lines that burn a lot of fuel to move people and goods.',
        impacts,
      }
    },
  },
  {
    id: 'fuel-prices-fall',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const energy = byIndustries(stocks, ['Oil & Gas'])
      const fuelBurners = byIndustries(stocks, ['Transport', 'Airlines'])
      if (energy.length === 0 && fuelBurners.length === 0) return null
      const impacts = [
        ...energy.map((s) => ({ ticker: s.ticker, percent: -randomInRange(2, 5, rng) })),
        ...fuelBurners.map((s) => ({ ticker: s.ticker, percent: randomInRange(2, 5, rng) })),
      ]
      return {
        id: 'fuel-prices-fall',
        tone: 'neutral',
        misleading: false,
        headline: 'Fuel prices ease for the first time in weeks',
        body: 'Cheaper fuel is a relief for airlines, freight, and shipping companies watching their costs — though it trims margins for oil and gas producers on the other side of the trade.',
        impacts,
      }
    },
  },
  {
    id: 'factory-closure',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const pool = byIndustries(stocks, ['Retail', 'Food & Beverages', 'Technology', 'Manufacturing', 'Automotive'])
      const stock = pickOne(pool, rng)
      if (!stock) return null
      const percent = -randomInRange(2, 5, rng)
      return {
        id: 'factory-closure',
        tone: 'negative',
        misleading: false,
        headline: `${stock.name} pauses production at one facility`,
        body: `${stock.name} (${stock.ticker}) temporarily closed one production site for scheduled maintenance and equipment upgrades. The company expects a short-term dent in output, with normal production resuming within weeks.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'renewable-breakthrough',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const renewables = byIndustry(stocks, 'Renewable Energy')
      const oil = byIndustry(stocks, 'Oil & Gas')
      const stock = pickOne(renewables, rng)
      if (!stock) return null
      const impacts = [{ ticker: stock.ticker, percent: randomInRange(4, 10, rng) }]
      const oilStock = pickOne(oil, rng)
      if (oilStock && rng() > 0.5) impacts.push({ ticker: oilStock.ticker, percent: -randomInRange(0.5, 2, rng) })
      return {
        id: 'renewable-breakthrough',
        tone: 'positive',
        misleading: false,
        headline: `${stock.name} announces a manufacturing breakthrough`,
        body: `${stock.name} (${stock.ticker}) says a new manufacturing process will lower production costs significantly. If it works at scale as promised, it could make the company noticeably more competitive on price.`,
        impacts,
      }
    },
  },
  {
    id: 'competitor-enters',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const stock = pickOne(stocks, rng)
      if (!stock) return null
      const percent = -randomInRange(1.5, 4, rng)
      return {
        id: 'competitor-enters',
        tone: 'negative',
        misleading: false,
        headline: `A new competitor targets ${stock.industry.toLowerCase()}`,
        body: `A well-funded new entrant announced plans to compete directly with ${stock.name} (${stock.ticker}). Investors are watching closely to see how the company defends its market share over the coming months.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'dividend-announcement',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const pool = stocks.filter((s) => s.dividendYield > 0)
      const stock = pickOne(pool, rng)
      if (!stock) return null
      const percent = randomInRange(0.5, 2, rng)
      return {
        id: 'dividend-announcement',
        tone: 'positive',
        misleading: false,
        headline: `${stock.name} confirms its next dividend payment`,
        body: `${stock.name} (${stock.ticker}) will pay shareholders a dividend this quarter — a portion of profit paid out for every share owned, on top of any change in the share price itself.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'hype-headline',
    weight: 3,
    generate: ({ stocks, rng }) => {
      const pool = stocks.filter((s) => s.risk === 'high')
      const stock = pickOne(pool, rng)
      if (!stock) return null
      const actualPercent = randomInRange(1, 3, rng) * (rng() > 0.5 ? 1 : -1)
      const headline = pickOne([
        `Traders say ${stock.name} could be about to "explode"`,
        `Online chatter claims ${stock.name} is "about to go parabolic"`,
        `Viral post insists ${stock.name} is "the next big thing" this week`,
      ], rng)!
      return {
        id: 'hype-headline',
        tone: actualPercent >= 0 ? 'positive' : 'negative',
        misleading: true,
        headline,
        body: `A wave of social posts claims ${stock.name} (${stock.ticker}) is guaranteed to soar. There is no new information from the company itself — the actual move today was far smaller than the headline suggests, and hype like this often fades within days.`,
        impacts: [{ ticker: stock.ticker, percent: actualPercent }],
      }
    },
  },
  {
    id: 'market-wide-rally',
    weight: 1,
    generate: ({ stocks, rng }) => {
      const impacts = stocks.map((s) => ({ ticker: s.ticker, percent: randomInRange(0.15, 0.8, rng) }))
      return {
        id: 'market-wide-rally',
        tone: 'positive',
        misleading: false,
        headline: 'Broad market rally lifts most sectors',
        body: 'Investor confidence improved across the board today, with most industries trading higher than they opened.',
        impacts,
      }
    },
  },
  {
    id: 'market-wide-selloff',
    weight: 1,
    generate: ({ stocks, rng }) => {
      const impacts = stocks.map((s) => ({ ticker: s.ticker, percent: -randomInRange(0.15, 0.8, rng) }))
      return {
        id: 'market-wide-selloff',
        tone: 'negative',
        misleading: false,
        headline: 'Broad market pulls back on economic worries',
        body: 'Most sectors traded lower today as investors turned cautious. Pullbacks like this are a normal, routine part of investing over time — not usually a sign of anything specific to any one company.',
        impacts,
      }
    },
  },
  {
    id: 'ai-breakthrough',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const pool = byIndustry(stocks, 'Artificial Intelligence')
      const stock = pickOne(pool, rng)
      if (!stock) return null
      const percent = randomInRange(4, 11, rng)
      return {
        id: 'ai-breakthrough',
        tone: 'positive',
        misleading: false,
        headline: `${stock.name} unveils a major model improvement`,
        body: `${stock.name} (${stock.ticker}) announced its AI models now perform significantly better on independent benchmarks — a meaningful technical result verified by outside researchers, not just marketing claims.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'data-breach-elsewhere',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const pool = byIndustry(stocks, 'Cybersecurity')
      const stock = pickOne(pool, rng)
      if (!stock) return null
      const percent = randomInRange(2, 6, rng)
      return {
        id: 'data-breach-elsewhere',
        tone: 'positive',
        misleading: false,
        headline: `Major data breach elsewhere boosts demand for ${stock.name}`,
        body: `After a large, unrelated company disclosed a serious data breach, more businesses are signing up for security services like those sold by ${stock.name} (${stock.ticker}). Security spending often rises industry-wide after headline incidents like this.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'insurance-claims-surge',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const pool = byIndustry(stocks, 'Insurance')
      const stock = pickOne(pool, rng)
      if (!stock) return null
      const percent = -randomInRange(2, 6, rng)
      return {
        id: 'insurance-claims-surge',
        tone: 'negative',
        misleading: false,
        headline: `${stock.name} faces a rise in claims after severe weather`,
        body: `${stock.name} (${stock.ticker}) expects to pay out more in claims this quarter after a stretch of severe weather in areas it insures. Insurers plan and set aside reserves for years like this, but reported profits still take a hit.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'hit-game-launch',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const pool = byIndustry(stocks, 'Gaming')
      const stock = pickOne(pool, rng)
      if (!stock) return null
      const percent = randomInRange(5, 12, rng)
      return {
        id: 'hit-game-launch',
        tone: 'positive',
        misleading: false,
        headline: `${stock.name}'s newest release becomes a surprise hit`,
        body: `${stock.name} (${stock.ticker}) says its latest game sold far better than expected in its first week, with strong reviews driving word-of-mouth. One release rarely defines a company long-term, but it is a genuine, verifiable result.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'flight-disruptions',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const pool = byIndustry(stocks, 'Airlines')
      const stock = pickOne(pool, rng)
      if (!stock) return null
      const percent = -randomInRange(2, 6, rng)
      return {
        id: 'flight-disruptions',
        tone: 'negative',
        misleading: false,
        headline: `${stock.name} cancels flights amid staffing shortages`,
        body: `${stock.name} (${stock.ticker}) cancelled a number of flights this week due to crew shortages and weather. Airlines routinely deal with short-term disruptions like this, and schedules typically normalize within a week or two.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'ev-demand-surge',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const pool = byIndustry(stocks, 'Automotive')
      const stock = pickOne(pool, rng)
      if (!stock) return null
      const percent = randomInRange(3, 8, rng)
      return {
        id: 'ev-demand-surge',
        tone: 'positive',
        misleading: false,
        headline: `Strong vehicle demand lifts ${stock.name}`,
        body: `${stock.name} (${stock.ticker}) reported stronger-than-expected orders this quarter as consumer demand for new vehicles picked up, particularly in markets where the company had been building out its dealer network.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'construction-permit-delay',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const pool = byIndustry(stocks, 'Construction')
      const stock = pickOne(pool, rng)
      if (!stock) return null
      const percent = -randomInRange(2, 5, rng)
      return {
        id: 'construction-permit-delay',
        tone: 'negative',
        misleading: false,
        headline: `${stock.name} hits permit delays on a major project`,
        body: `${stock.name} (${stock.ticker}) says local approval delays will push a major project's completion back by several months, delaying when the company gets paid for the work.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'crop-forecast-shift',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const pool = byIndustry(stocks, 'Agriculture')
      const stock = pickOne(pool, rng)
      if (!stock) return null
      const direction = rng() > 0.5 ? 1 : -1
      const percent = randomInRange(2, 6, rng) * direction
      return {
        id: 'crop-forecast-shift',
        tone: direction > 0 ? 'positive' : 'negative',
        misleading: false,
        headline: direction > 0 ? `Strong growing season lifts demand for ${stock.name}` : `Poor weather clouds the outlook for ${stock.name}`,
        body: `Updated weather forecasts for the growing season have shifted expectations for ${stock.name} (${stock.ticker}) and the farmers it supplies equipment and services to.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'automation-upgrade',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const pool = byIndustry(stocks, 'Manufacturing')
      const stock = pickOne(pool, rng)
      if (!stock) return null
      const percent = randomInRange(2, 6, rng)
      return {
        id: 'automation-upgrade',
        tone: 'positive',
        misleading: false,
        headline: `${stock.name} completes a factory automation upgrade`,
        body: `${stock.name} (${stock.ticker}) finished installing new automated equipment across two plants, which management expects will lower production costs meaningfully going forward.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'property-market-shift',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const pool = byIndustry(stocks, 'Real Estate')
      const stock = pickOne(pool, rng)
      if (!stock) return null
      const direction = rng() > 0.5 ? 1 : -1
      const percent = randomInRange(1.5, 4, rng) * direction
      return {
        id: 'property-market-shift',
        tone: direction > 0 ? 'positive' : 'negative',
        misleading: false,
        headline: direction > 0 ? `Property values rise in ${stock.name}'s markets` : `Property values soften in ${stock.name}'s markets`,
        body: `New data on the local property market affects how much ${stock.name} (${stock.ticker})'s buildings are worth on paper and how much rent the company can reasonably charge tenants.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },

  // --- New: generic company flavor news, applies to any company -----------------

  {
    id: 'earnings-beat',
    weight: 4,
    generate: ({ stocks, rng }) => {
      const stock = pickOne(stocks, rng)
      if (!stock) return null
      const percent = randomInRange(2, 6, rng)
      return {
        id: 'earnings-beat',
        tone: 'positive',
        misleading: false,
        headline: `${stock.name} beats quarterly earnings expectations`,
        body: `${stock.name} (${stock.ticker}) reported quarterly profit above what analysts had forecast, driven by stronger margins than expected. Management reaffirmed its outlook for the rest of the year.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'earnings-miss',
    weight: 4,
    generate: ({ stocks, rng }) => {
      const stock = pickOne(stocks, rng)
      if (!stock) return null
      const percent = -randomInRange(2, 6, rng)
      return {
        id: 'earnings-miss',
        tone: 'negative',
        misleading: false,
        headline: `${stock.name} misses quarterly earnings expectations`,
        body: `${stock.name} (${stock.ticker}) reported quarterly profit below what analysts had forecast. Management cited rising costs and said it was reviewing its budget for the next two quarters.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'analyst-upgrade',
    weight: 3,
    generate: ({ stocks, rng }) => {
      const stock = pickOne(stocks, rng)
      if (!stock) return null
      const house = pickOne(ANALYST_HOUSES, rng)
      const percent = randomInRange(1, 3.5, rng)
      return {
        id: 'analyst-upgrade',
        tone: 'positive',
        misleading: false,
        headline: `${house} upgrades ${stock.name} to "buy"`,
        body: `Analysts at ${house} raised their rating on ${stock.name} (${stock.ticker}), citing improving fundamentals and a more attractive valuation than peers in the same industry.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'analyst-downgrade',
    weight: 3,
    generate: ({ stocks, rng }) => {
      const stock = pickOne(stocks, rng)
      if (!stock) return null
      const house = pickOne(ANALYST_HOUSES, rng)
      const percent = -randomInRange(1, 3.5, rng)
      return {
        id: 'analyst-downgrade',
        tone: 'negative',
        misleading: false,
        headline: `${house} downgrades ${stock.name} to "sell"`,
        body: `Analysts at ${house} cut their rating on ${stock.name} (${stock.ticker}), pointing to a weaker competitive position and rising costs that could squeeze margins over the next year.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'new-leadership',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const stock = pickOne(stocks, rng)
      if (!stock) return null
      const title = pickOne(CEO_TITLES, rng)
      const percent = randomInRange(-1.5, 2.5, rng)
      return {
        id: 'new-leadership',
        tone: percent >= 0 ? 'positive' : 'neutral',
        misleading: false,
        headline: `${stock.name} names a new ${title}`,
        body: `${stock.name} (${stock.ticker}) announced a leadership change effective next quarter. Investors are watching for early signals about whether the company's strategy will shift under new management.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'executive-departure',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const stock = pickOne(stocks, rng)
      if (!stock) return null
      const percent = -randomInRange(1, 3, rng)
      return {
        id: 'executive-departure',
        tone: 'negative',
        misleading: false,
        headline: `${stock.name}'s chief financial officer steps down unexpectedly`,
        body: `${stock.name} (${stock.ticker}) said its finance chief is leaving for personal reasons, effective immediately. Sudden departures like this can unsettle investors even when the company insists nothing else has changed.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'share-buyback',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const stock = pickOne(stocks, rng)
      if (!stock) return null
      const percent = randomInRange(1, 3, rng)
      return {
        id: 'share-buyback',
        tone: 'positive',
        misleading: false,
        headline: `${stock.name} announces a share buyback program`,
        body: `${stock.name} (${stock.ticker}) will spend some of its cash reserves buying back its own shares. Buybacks reduce the number of shares in the market, which can support the price — but they use cash that could otherwise fund growth.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'expansion-announcement',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const stock = pickOne(stocks, rng)
      if (!stock) return null
      const percent = randomInRange(1.5, 4, rng)
      return {
        id: 'expansion-announcement',
        tone: 'positive',
        misleading: false,
        headline: `${stock.name} expands into new markets`,
        body: `${stock.name} (${stock.ticker}) confirmed plans to open new locations and hire staff in several new regions over the coming year, betting that demand will justify the upfront cost of expansion.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'product-recall',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const stock = pickOne(stocks, rng)
      if (!stock) return null
      const percent = -randomInRange(1.5, 4.5, rng)
      return {
        id: 'product-recall',
        tone: 'negative',
        misleading: false,
        headline: `${stock.name} recalls a batch of products over a safety concern`,
        body: `${stock.name} (${stock.ticker}) issued a voluntary recall after a small number of quality-control issues were flagged. The company says the direct cost is limited, but recalls can also dent customer trust for a while.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'industry-award',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const stock = pickOne(stocks, rng)
      if (!stock) return null
      const percent = randomInRange(0.3, 1.2, rng)
      return {
        id: 'industry-award',
        tone: 'positive',
        misleading: false,
        headline: `${stock.name} named to an industry "most admired companies" list`,
        body: `${stock.name} (${stock.ticker}) was recognized in an annual industry ranking for reputation and workplace culture. Recognition like this rarely moves a stock much on its own, but it can support the company's long-term brand.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'stock-split',
    weight: 1,
    generate: ({ stocks, rng }) => {
      const pool = stocks.filter((s) => s.startingPrice > 70)
      const stock = pickOne(pool, rng)
      if (!stock) return null
      return {
        id: 'stock-split',
        tone: 'neutral',
        misleading: false,
        headline: `${stock.name} announces a stock split`,
        body: `${stock.name} (${stock.ticker}) will split its shares to make them more accessible to everyday investors. A split does not change what the company is actually worth — it just divides the same value into more, cheaper shares. This news carries no real price impact by itself.`,
        impacts: [],
      }
    },
  },
  {
    id: 'major-shareholder-trims',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const stock = pickOne(stocks, rng)
      if (!stock) return null
      const percent = -randomInRange(1, 2.5, rng)
      return {
        id: 'major-shareholder-trims',
        tone: 'negative',
        misleading: false,
        headline: `A major shareholder trims its stake in ${stock.name}`,
        body: `A large investor filed paperwork showing it sold part of its position in ${stock.name} (${stock.ticker}). Large investors sell for all kinds of reasons that have nothing to do with the company — but it can still unsettle other shareholders in the short term.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'major-shareholder-adds',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const stock = pickOne(stocks, rng)
      if (!stock) return null
      const percent = randomInRange(1, 2.5, rng)
      return {
        id: 'major-shareholder-adds',
        tone: 'positive',
        misleading: false,
        headline: `A major investor increases its stake in ${stock.name}`,
        body: `A large investor filed paperwork showing it bought more shares of ${stock.name} (${stock.ticker}), a signal some traders read as a vote of confidence in the company's direction.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'partnership-announcement',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const stock = pickOne(stocks, rng)
      if (!stock) return null
      const percent = randomInRange(1.5, 4, rng)
      return {
        id: 'partnership-announcement',
        tone: 'positive',
        misleading: false,
        headline: `${stock.name} signs a new distribution partnership`,
        body: `${stock.name} (${stock.ticker}) agreed to a multi-year partnership that management says will open up new customers without needing to build new infrastructure from scratch.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'regulatory-scrutiny',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const stock = pickOne(stocks, rng)
      if (!stock) return null
      const percent = -randomInRange(1.5, 4, rng)
      return {
        id: 'regulatory-scrutiny',
        tone: 'negative',
        misleading: false,
        headline: `${stock.name} faces a regulatory review`,
        body: `Regulators opened a routine review into practices at ${stock.name} (${stock.ticker}). Reviews like this can take months to resolve and do not necessarily mean any wrongdoing was found.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'cost-cutting-plan',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const stock = pickOne(stocks, rng)
      if (!stock) return null
      const percent = randomInRange(1, 3, rng)
      return {
        id: 'cost-cutting-plan',
        tone: 'positive',
        misleading: false,
        headline: `${stock.name} announces a cost-cutting plan`,
        body: `${stock.name} (${stock.ticker}) outlined a plan to reduce operating expenses over the next year. Investors often respond well to discipline on costs — though cuts that go too deep can hurt a company's ability to grow.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'exaggerated-rumor',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const stock = pickOne(stocks, rng)
      if (!stock) return null
      const actualPercent = randomInRange(0.5, 2, rng) * (rng() > 0.5 ? 1 : -1)
      return {
        id: 'exaggerated-rumor',
        tone: actualPercent >= 0 ? 'positive' : 'negative',
        misleading: true,
        headline: `Rumor mill says ${stock.name} is in secret takeover talks`,
        body: `Unverified chatter is circulating that ${stock.name} (${stock.ticker}) is close to a major deal. Neither the company nor any credible source has confirmed this — headlines built on unnamed sources are worth treating with real caution.`,
        impacts: [{ ticker: stock.ticker, percent: actualPercent }],
      }
    },
  },
  {
    id: 'telecom-network-upgrade',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const pool = byIndustry(stocks, 'Telecommunications')
      const stock = pickOne(pool, rng)
      if (!stock) return null
      const percent = randomInRange(2, 5, rng)
      return {
        id: 'telecom-network-upgrade',
        tone: 'positive',
        misleading: false,
        headline: `${stock.name} completes a network coverage expansion`,
        body: `${stock.name} (${stock.ticker}) finished a major network upgrade, extending coverage to several new areas and improving speeds for existing customers — a direct lever for winning new subscribers.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
  {
    id: 'retail-holiday-season',
    weight: 2,
    generate: ({ stocks, rng }) => {
      const stock = pickOne(byIndustry(stocks, 'Retail'), rng)
      if (!stock) return null
      const direction = rng() > 0.4 ? 1 : -1
      const percent = randomInRange(2, 5, rng) * direction
      return {
        id: 'retail-holiday-season',
        tone: direction > 0 ? 'positive' : 'negative',
        misleading: false,
        headline: direction > 0 ? `${stock.name} reports a strong shopping season` : `${stock.name} reports a disappointing shopping season`,
        body: `Foot traffic and online order data for ${stock.name} (${stock.ticker}) came in ${direction > 0 ? 'well above' : 'below'} what retailers typically see this time of year.`,
        impacts: [{ ticker: stock.ticker, percent }],
      }
    },
  },
]

function weightedPick(definitions: EventDefinition[], rng: () => number): EventDefinition | undefined {
  const total = definitions.reduce((sum, def) => sum + def.weight, 0)
  if (total <= 0) return undefined
  let roll = rng() * total
  for (const def of definitions) {
    roll -= def.weight
    if (roll <= 0) return def
  }
  return definitions[definitions.length - 1]
}

/**
 * Generates 0-3 news items for a single 5-minute market tick. Real financial
 * news breaks continuously through a trading day — this aims for roughly
 * one headline every couple of ticks on average, not one big story per
 * "day" the way the old slower simulation worked.
 */
export function generateTickEvents(ctx: EventContext): ResolvedMarketEvent[] {
  const events: ResolvedMarketEvent[] = []
  const roll = ctx.rng()
  const eventCount = roll < 0.12 ? 3 : roll < 0.35 ? 2 : roll < 0.72 ? 1 : 0
  const used = new Set<string>()
  for (let i = 0; i < eventCount; i++) {
    const remaining = EVENT_DEFINITIONS.filter((def) => !used.has(def.id))
    const definition = weightedPick(remaining, ctx.rng)
    if (!definition) break
    const resolved = definition.generate(ctx)
    if (resolved) {
      events.push(resolved)
      used.add(definition.id)
    }
  }
  return events
}
