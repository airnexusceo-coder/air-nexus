import type { Lesson } from '@/lib/business-empire/types'

export const LESSONS: Lesson[] = [
  {
    id: 'revenue-expenses-profit',
    order: 1,
    title: 'Revenue, Expenses, and Profit',
    summary: 'The three numbers every business decision eventually comes back to.',
    content: [
      'Revenue is all the money a business brings in from selling its products — before anything is subtracted. If you sell 200 units at $10 each, your revenue is $2,000, no matter what it cost you to make them.',
      'Expenses are everything the business has to pay for: production, research, advertising, wages, rent, and tax. None of these are optional if you want the business to keep running.',
      'Profit is what is left after expenses are subtracted from revenue. If expenses are higher than revenue, the business has made a loss instead — and a business can sell a lot of products and still lose money if its expenses are too high.',
    ],
    quiz: [
      { id: 'rep-q1', prompt: 'A company earns $5,000 in revenue and pays $6,200 in total expenses. What happened?', options: ['A profit of $1,200', 'A loss of $1,200', 'Break-even', 'Not enough information'], correctIndex: 1, explanation: 'Expenses were higher than revenue, so the company made a loss of $1,200.' },
      { id: 'rep-q2', prompt: 'Is it possible to sell a lot of units and still lose money?', options: ['No, more sales always means more profit', 'Yes, if expenses are higher than the revenue those sales bring in', 'Only in Technology', 'Only if the price is $0'], correctIndex: 1, explanation: 'High sales volume does not guarantee profit if the cost of producing and selling those units is too high.' },
      { id: 'rep-q3', prompt: 'Which of these counts as revenue?', options: ['Money paid for advertising', 'Money paid to staff', 'Money customers pay for your product', 'Money paid in rent'], correctIndex: 2, explanation: 'Revenue is money coming IN from sales — the others are all expenses (money going out).' },
    ],
  },
  {
    id: 'pricing-break-even',
    order: 2,
    title: 'Pricing and the Break-Even Point',
    summary: 'Why the "best" price is rarely the highest one, and what break-even actually means.',
    content: [
      'Price affects demand. A higher price usually means fewer people buy, but each sale brings in more money. A lower price usually means more people buy, but each sale brings in less. Finding a price that balances the two is the core challenge of pricing.',
      'Break-even is the point where total revenue exactly equals total costs — no profit, no loss. Selling below your break-even volume means a loss; selling above it means a profit.',
      'A price that is too high compared to a product\'s quality and reputation can suppress demand badly, even if the profit margin per unit looks great on paper. A price that is too low can sell out fast but leave almost nothing to show for it.',
    ],
    quiz: [
      { id: 'peb-q1', prompt: 'What does "break-even" mean?', options: ['The point where revenue equals total costs', 'The point where a product sells out', 'The highest possible price', 'The point where a business goes bankrupt'], correctIndex: 0, explanation: 'Break-even is exactly where revenue and costs are equal — zero profit, zero loss.' },
      { id: 'peb-q2', prompt: 'A high price with very low demand compared to a lower price with strong demand — which one is automatically more profitable?', options: ['The high price, always', 'The low price, always', 'It depends on the actual numbers — neither is automatic', 'Neither one matters'], correctIndex: 2, explanation: 'Total profit depends on price multiplied by volume, minus costs — you have to actually run the numbers, not assume.' },
      { id: 'peb-q3', prompt: 'What is a realistic risk of pricing far above what quality and reputation can support?', options: ['Demand can drop sharply', 'Production costs automatically rise', 'Competitors are forced to raise their prices too', 'Nothing — price never affects demand'], correctIndex: 0, explanation: 'Customers compare price to what they are actually getting — a mismatch can suppress demand badly.' },
    ],
  },
  {
    id: 'supply-and-demand',
    order: 3,
    title: 'Supply and Demand',
    summary: 'What actually drives how many people want to buy from you.',
    content: [
      'Demand is how many customers want to buy your product at a given price. It is shaped by price, quality, advertising, your reputation, and what competitors are offering — not just one factor alone.',
      'Even the best product will not sell itself if nobody knows about it, and even heavy advertising cannot save a product that is badly overpriced for what it offers.',
      'Demand also has some genuine unpredictability built in — research and good decisions narrow the uncertainty, but no business can ever know its exact sales in advance.',
    ],
    quiz: [
      { id: 'sd-q1', prompt: 'Which of these affects demand?', options: ['Price only', 'Advertising only', 'Price, quality, advertising, reputation, and competition together', 'Nothing — demand is random'], correctIndex: 2, explanation: 'Demand is driven by several factors working together, not any single one in isolation.' },
      { id: 'sd-q2', prompt: 'Can a great product fail commercially?', options: ['No, quality always guarantees sales', 'Yes, if customers never find out about it or the price does not fit', 'Only in Restaurants', 'Only if it has zero features'], correctIndex: 1, explanation: 'Awareness and pricing both matter — quality alone is not enough.' },
      { id: 'sd-q3', prompt: 'Why does demand include some randomness in this game?', options: ['To make the game unfair', 'Because real-world demand can never be predicted with total certainty, even with good research', 'Because prices are random', 'It does not — demand is fully predictable'], correctIndex: 1, explanation: 'Good research and decisions reduce uncertainty, but they cannot eliminate it — that reflects how real markets actually behave.' },
    ],
  },
  {
    id: 'market-research',
    order: 4,
    title: 'Market Research',
    summary: 'Paying to reduce uncertainty before you commit real money to a product.',
    content: [
      'Market research gives you an early estimate of demand, pricing, customer preferences, and competitors — before you spend money manufacturing anything.',
      'Better research costs more but gives more accurate numbers. Basic research is cheap but rough; premium research is expensive but reliable.',
      'Research reduces risk, but it never removes it completely — even the most detailed report is still an estimate, not a guarantee.',
    ],
    quiz: [
      { id: 'mr-q1', prompt: 'What does market research mainly help you do?', options: ['Guarantee a profit', 'Reduce uncertainty before committing money', 'Automatically set the best price', 'Eliminate all competitors'], correctIndex: 1, explanation: 'Research narrows uncertainty and informs your decisions — it does not guarantee an outcome.' },
      { id: 'mr-q2', prompt: 'What is the trade-off between research levels?', options: ['Cheaper research is always more accurate', 'More expensive research is generally more accurate', 'All research levels cost the same', 'Research level has no effect on accuracy'], correctIndex: 1, explanation: 'Higher-cost research tends to produce tighter, more reliable estimates.' },
      { id: 'mr-q3', prompt: 'Should you fully trust a premium research report\'s exact numbers?', options: ['Yes, it will be exactly correct', 'No, it is still an estimate, just a more accurate one', 'Research reports are never useful', 'Only for Renewable Energy'], correctIndex: 1, explanation: 'Even premium research is an estimate with some uncertainty built in — treat it as strong guidance, not a guarantee.' },
    ],
  },
  {
    id: 'advertising-awareness',
    order: 5,
    title: 'Advertising and Awareness',
    summary: 'Different channels reach different audiences — spend does not equal effectiveness by itself.',
    content: [
      'Advertising raises awareness of your product, which increases demand — but the same channel is not equally effective in every industry or for every audience.',
      'Social media and influencer campaigns often work well for trend-driven, younger audiences; television and billboards reach a broader, more general audience at a higher cost.',
      'Advertising increases the chance of a sale — it does not guarantee one. A well-advertised but overpriced or low-quality product can still under-perform.',
    ],
    quiz: [
      { id: 'aa-q1', prompt: 'Is the most expensive advertising channel always the most effective choice?', options: ['Yes, always', 'No — effectiveness depends on the audience and industry, not just cost', 'Only for Cars', 'Cost and effectiveness are unrelated'], correctIndex: 1, explanation: 'The right channel depends on who you are trying to reach, not just how much you spend.' },
      { id: 'aa-q2', prompt: 'What does advertising actually increase?', options: ['Guaranteed sales', 'Awareness, which increases the chance of a sale', 'Production cost per unit', 'Customer satisfaction directly'], correctIndex: 1, explanation: 'Advertising raises awareness and the probability of purchase — it does not force a sale.' },
      { id: 'aa-q3', prompt: 'Could a heavily advertised, overpriced product still sell poorly?', options: ['No, advertising fixes any price problem', 'Yes — advertising cannot fully offset a bad price-to-quality fit', 'Only if there is no advertising at all', 'Advertising and price are unrelated'], correctIndex: 1, explanation: 'Awareness alone cannot overcome a poor value proposition.' },
    ],
  },
  {
    id: 'production-costs-quality',
    order: 6,
    title: 'Production Costs and Quality',
    summary: 'Higher quality usually costs more to make — the question is whether customers will pay for it.',
    content: [
      'Every product has a cost per unit to manufacture, shaped by its quality tier, production method, and packaging. Luxury-quality items cost far more to produce than budget ones.',
      'A cheaper production method (like outsourcing) lowers cost per unit but can hurt consistency and perceived quality. A more careful method (like manual production) raises cost but can improve it.',
      'Higher quality is not automatically the right choice — it only pays off if customers are willing to pay a price that covers the extra cost.',
    ],
    quiz: [
      { id: 'pcq-q1', prompt: 'What generally happens to cost per unit as product quality increases?', options: ['It decreases', 'It increases', 'It stays exactly the same', 'Quality has no effect on cost'], correctIndex: 1, explanation: 'Higher quality tiers use better materials and more careful production, which raises the cost per unit.' },
      { id: 'pcq-q2', prompt: 'Is outsourcing production always the best choice because it is cheaper?', options: ['Yes, cheaper is always better', 'Not necessarily — it can also make quality less consistent', 'Outsourcing has no effect on quality', 'Outsourcing always improves quality'], correctIndex: 1, explanation: 'Lower production cost can come with a quality or consistency trade-off.' },
      { id: 'pcq-q3', prompt: 'When does higher production quality actually pay off?', options: ['Always, no matter the price', 'Only when customers are willing to pay a price that covers the extra cost', 'Never — quality is not worth the expense', 'Only in Furniture'], correctIndex: 1, explanation: 'Quality has to be matched with a price customers accept for the extra cost to make business sense.' },
    ],
  },
  {
    id: 'profit-margins',
    order: 7,
    title: 'Profit Margins Explained',
    summary: 'The difference between "made a lot of money" and "made money efficiently."',
    content: [
      'A profit margin is how much of each sale is actually profit, once cost is subtracted from price. A $50 product that costs $40 to make has a much thinner margin than one that costs $10 to make.',
      'A high-margin product can be more valuable than a high-volume, low-margin one — even if the low-margin product sells more units.',
      'Margins can shrink even if you have not changed anything — rising costs, discounting, or a weakening price relative to competitors can all erode margin quietly.',
    ],
    quiz: [
      { id: 'pm-q1', prompt: 'What is a profit margin?', options: ['Total revenue for the year', 'How much of each sale is profit after cost is subtracted', 'The number of units sold', 'The price of the product'], correctIndex: 1, explanation: 'Margin is about the profit per sale relative to price, not the total revenue.' },
      { id: 'pm-q2', prompt: 'Can a product with fewer sales still make more total profit than one with more sales?', options: ['No, more sales always wins', 'Yes, if its margin per unit is high enough', 'Only if it is free', 'Margin and total profit are unrelated'], correctIndex: 1, explanation: 'A smaller number of high-margin sales can outperform a larger number of thin-margin ones.' },
      { id: 'pm-q3', prompt: 'What can quietly shrink a profit margin over time?', options: ['Nothing, margins are fixed once set', 'Rising costs or discounting without adjusting price', 'Only advertising spend', 'Only research spend'], correctIndex: 1, explanation: 'If costs rise or prices are cut without a matching adjustment, margin narrows even if nothing else visibly changed.' },
    ],
  },
  {
    id: 'managing-inventory',
    order: 8,
    title: 'Managing Inventory',
    summary: 'Unsold stock is not free to hold onto — and in some industries, it does not last.',
    content: [
      'Inventory is stock you have produced but not yet sold. It represents real cash you already spent, sitting unsold until a customer buys it.',
      'Carrying inventory has costs and risks: storage, tied-up cash, and in perishable industries like food, the stock can expire before it ever sells.',
      'When a product does not sell as expected, you have choices: keep the stock for next year, discount it to clear it out quickly, dispose of it, or relaunch the product with a refreshed approach.',
    ],
    quiz: [
      { id: 'mi-q1', prompt: 'What is inventory?', options: ['Money in the bank', 'Stock that has been produced but not yet sold', 'A type of advertising', 'A customer group'], correctIndex: 1, explanation: 'Inventory is unsold stock — cash already spent, waiting to become revenue.' },
      { id: 'mi-q2', prompt: 'What can happen to unsold inventory in a perishable industry like food?', options: ['Nothing, it keeps forever', 'It can expire before it ever sells', 'It automatically converts to cash', 'It becomes more valuable over time'], correctIndex: 1, explanation: 'Perishable goods can spoil, which is a real risk of overproducing in those industries.' },
      { id: 'mi-q3', prompt: 'Which of these is NOT one of your options for unsold inventory?', options: ['Keep it for next year', 'Discount it to sell it off', 'Dispose of it', 'Convert it directly into advertising budget'], correctIndex: 3, explanation: 'You can keep, discount, dispose of, or relaunch a product — you cannot directly convert unsold stock into ad spend.' },
    ],
  },
  {
    id: 'customer-satisfaction-reputation',
    order: 9,
    title: 'Customer Satisfaction and Reputation',
    summary: 'Two numbers that quietly shape every future year\'s demand.',
    content: [
      'Customer satisfaction reflects how happy buyers are with what they got for the price they paid. It is driven by quality, price fairness, and whether the product was actually in stock.',
      'Brand reputation builds up over time from consistent satisfaction, and from how well your business responds to events like good or bad reviews.',
      'Both satisfaction and reputation carry forward into future years — a strong reputation makes future demand more forgiving, while a damaged one makes it harder to sell even a good product.',
    ],
    quiz: [
      { id: 'csr-q1', prompt: 'What mainly drives customer satisfaction?', options: ['Advertising spend alone', 'Quality, price fairness, and product availability', 'The company\'s cash balance', 'The number of competitors'], correctIndex: 1, explanation: 'Satisfaction comes from what customers actually experience — value for price, and being able to get the product.' },
      { id: 'csr-q2', prompt: 'Does brand reputation affect future years, or just the current one?', options: ['Only the current year', 'It carries forward and affects future demand too', 'It has no real effect', 'Only advertising cost'], correctIndex: 1, explanation: 'Reputation persists across years and shapes how forgiving future demand is.' },
      { id: 'csr-q3', prompt: 'What is a realistic effect of a damaged reputation?', options: ['It makes future sales easier', 'It can make it harder to sell even a genuinely good product', 'It has no effect on demand', 'It automatically lowers production costs'], correctIndex: 1, explanation: 'A weak reputation is a real headwind against demand, regardless of product quality.' },
    ],
  },
  {
    id: 'competition-market-share',
    order: 10,
    title: 'Competition and Market Share',
    summary: 'You are never the only company customers are choosing between.',
    content: [
      'Competitors set their own prices, adjust their quality, and react to how the overall market is moving — they are not standing still while you make decisions.',
      'Market share is the percentage of total industry customers your business actually captures. A high market share in a small industry can be worth less than a smaller share of a huge one.',
      'Watching competitor prices and reputations helps you judge whether your own pricing and quality choices are actually competitive, not just reasonable in isolation.',
    ],
    quiz: [
      { id: 'cms-q1', prompt: 'Do competitors change over time in this game?', options: ['No, they stay fixed forever', 'Yes — their prices, quality, and reputation can shift each year', 'Only if you discontinue a product', 'Only in Video Games'], correctIndex: 1, explanation: 'Competitors behave dynamically, adjusting over time just like a real market.' },
      { id: 'cms-q2', prompt: 'What does market share measure?', options: ['Your total revenue', 'Your percentage of the total customers in the industry', 'Your cash balance', 'Your number of products'], correctIndex: 1, explanation: 'Market share is about your slice of the whole industry\'s customer base, not a raw dollar figure.' },
      { id: 'cms-q3', prompt: 'Why check competitor prices and reputation regularly?', options: ['It has no strategic value', 'To judge whether your own pricing and quality are actually competitive', 'Only to copy their exact price', 'Competitors cannot be observed'], correctIndex: 1, explanation: 'Your decisions are only "good" relative to what else customers can choose — competitor data gives you that context.' },
    ],
  },
  {
    id: 'cash-flow-vs-profit',
    order: 11,
    title: 'Cash Flow vs. Profit',
    summary: 'A profitable year on paper can still leave you short on actual cash.',
    content: [
      'Profit and cash are not the same thing. Net profit compares revenue to expenses for the year — but the cash you actually spent producing unsold inventory is real cash out the door, even though those unsold units are not yet counted as a cost of the goods you sold.',
      'This is why a business can look profitable but still feel "cash poor": money tied up in unsold stock is not available to spend on anything else until it sells.',
      'Watching your actual cash balance — not just the profit figure — is essential for knowing whether you can afford your next decision.',
    ],
    quiz: [
      { id: 'cfp-q1', prompt: 'Can a business be profitable on paper but still low on cash?', options: ['No, profit and cash are always identical', 'Yes — cash spent on unsold inventory is real, even if it is not yet "cost of goods sold"', 'Only if it has no employees', 'Only in Cars'], correctIndex: 1, explanation: 'Profit and cash flow measure different things — inventory spending shows up in cash flow before it shows up as cost of goods sold.' },
      { id: 'cfp-q2', prompt: 'What should you check before making a big spending decision?', options: ['Only last year\'s profit', 'Your actual current cash balance', 'Your competitor\'s prices only', 'Nothing — profit alone is enough'], correctIndex: 1, explanation: 'Available cash — not last year\'s profit figure — determines what you can actually afford right now.' },
      { id: 'cfp-q3', prompt: 'Why can overproducing unsold inventory hurt a business even if it does not show up as a cost of goods sold?', options: ['It does not hurt the business at all', 'It still uses up real cash that is now unavailable for other decisions', 'It automatically increases revenue', 'It has no relationship to cash at all'], correctIndex: 1, explanation: 'The cash spent producing those units is gone from your balance regardless of whether they have sold yet.' },
    ],
  },
  {
    id: 'understanding-business-risk',
    order: 12,
    title: 'Understanding Business Risk',
    summary: 'Every decision trades off potential reward against potential downside.',
    content: [
      'Every business decision carries some risk: a new product might flop, an advertising campaign might underperform, or an economic downturn might hit demand industry-wide.',
      'Higher-risk choices — like luxury quality with a big production run, or an expensive, untested advertising channel — can pay off big, but can also lose big.',
      'Spreading risk across multiple products, keeping some cash in reserve, and using research before committing money are all ways to manage risk without avoiding it completely.',
    ],
    quiz: [
      { id: 'ubr-q1', prompt: 'Can risk ever be fully eliminated in business?', options: ['Yes, with enough research', 'No — it can be reduced and managed, but never fully removed', 'Only in Education', 'Risk does not apply to real businesses'], correctIndex: 1, explanation: 'Good decisions and research reduce risk, but real uncertainty always remains.' },
      { id: 'ubr-q2', prompt: 'What is one practical way to manage risk?', options: ['Spend all your cash on one product', 'Spread investment across multiple products and keep some cash in reserve', 'Ignore market research', 'Always choose the cheapest option regardless of fit'], correctIndex: 1, explanation: 'Diversifying and keeping a cash buffer are standard ways to manage risk without avoiding decisions altogether.' },
      { id: 'ubr-q3', prompt: 'Do higher-risk decisions always fail?', options: ['Yes, always', 'No — they carry a wider range of possible outcomes, good and bad', 'They always succeed', 'Risk has no connection to outcomes'], correctIndex: 1, explanation: 'Higher risk means a wider spread of possible outcomes, not a guaranteed bad result.' },
    ],
  },
]

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === id)
}
