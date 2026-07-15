export type GlossaryEntry = { term: string; definition: string }

export const GLOSSARY_TERMS: GlossaryEntry[] = [
  { term: 'Revenue', definition: 'All the money a business brings in from sales, before any costs are subtracted.' },
  { term: 'Gross profit', definition: 'Revenue minus the cost of goods actually sold (unsold inventory is not included).' },
  { term: 'Net profit', definition: 'Revenue minus every business expense for the year: production, research, advertising, wages, rent, tax, and refunds.' },
  { term: 'Cost of goods sold', definition: 'The production cost of only the units that were actually sold this year.' },
  { term: 'Production cost', definition: 'The total cash spent manufacturing units this year, whether or not they end up selling.' },
  { term: 'Cost per unit', definition: 'How much it costs, on average, to manufacture a single unit of a product.' },
  { term: 'Profit margin', definition: 'How much of each sale is profit, once the cost per unit is subtracted from the price.' },
  { term: 'Break-even point', definition: 'The number of units (or amount of revenue) needed for total revenue to exactly equal total costs.' },
  { term: 'Market research', definition: 'Paid information about customer demand, pricing, and competitors — more expensive research is more accurate, never certain.' },
  { term: 'Market size', definition: 'The total number of customers an industry could realistically reach in a year.' },
  { term: 'Market share', definition: 'The percentage of an industry\'s total customers that your business actually captures.' },
  { term: 'Demand', definition: 'How many customers want to buy your product at its current price, quality, and awareness level.' },
  { term: 'Inventory', definition: 'Units you have manufactured but not yet sold — already-spent cash sitting unsold.' },
  { term: 'Cash flow', definition: 'The actual movement of cash in and out of the business — different from profit, since spending on unsold inventory is real cash out even before it counts as a cost of goods sold.' },
  { term: 'Company value', definition: 'An overall estimate of what the business is worth: cash, unsold inventory, market share, and reputation combined.' },
  { term: 'Brand reputation', definition: 'How well-regarded your company is overall — built up over time by consistent customer satisfaction.' },
  { term: 'Customer satisfaction', definition: 'How happy customers are with what they got for the price they paid, averaged across your active products.' },
  { term: 'Research & development (R&D)', definition: 'Money spent improving a product\'s quality and features before it is manufactured.' },
  { term: 'Advertising reach', definition: 'An estimate of how many potential customers an advertising campaign is likely to reach.' },
  { term: 'Economic conditions', definition: 'The broader state of the economy this year — can temporarily boost or dampen demand across the whole industry.' },
]

export function findGlossaryEntry(term: string): GlossaryEntry | undefined {
  return GLOSSARY_TERMS.find((entry) => entry.term.toLowerCase() === term.toLowerCase())
}
