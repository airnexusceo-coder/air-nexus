import type { DecisionChallenge } from '@/lib/market-masters/types'

export const DECISION_CHALLENGES: DecisionChallenge[] = [
  {
    id: 'influencer-hype',
    relatedTicker: 'SLSP',
    context: 'You scroll past a viral post while checking the news feed.',
    prompt: 'A social media influencer says SolarSpark stock will double tomorrow. What should you do?',
    options: [
      { id: 'invest-all', label: 'Invest all available money immediately', quality: 'risky', feedback: 'Putting everything into one tip — with no research of your own — risks a huge loss if the claim is wrong, which most viral predictions are.' },
      { id: 'research', label: 'Research the company and consider the risks', quality: 'strong', feedback: 'This is the strongest move. Checking the company\'s actual news and fundamentals, rather than one person\'s claim, is how informed investors decide.' },
      { id: 'borrow', label: 'Borrow money to purchase more shares', quality: 'risky', feedback: 'Borrowing to invest ("margin") multiplies both gains and losses. If the claim is wrong, you could end up owing more than you started with.' },
      { id: 'assume-correct', label: 'Assume the claim must be correct', quality: 'weak', feedback: 'Nobody can reliably predict a stock will "double tomorrow." Confident-sounding claims are not the same as evidence.' },
    ],
  },
  {
    id: 'scary-headline',
    context: 'A dramatic headline appears in your news feed after a company reports normal quarterly results.',
    prompt: 'A headline reads "MARKET PANIC as company misses target by 1%." What should you do?',
    options: [
      { id: 'sell-everything', label: 'Sell that holding immediately, no matter the price', quality: 'risky', feedback: 'Selling in a rush based on a dramatic headline, rather than the actual size of the news, often locks in a loss you didn\'t need to take.' },
      { id: 'read-past-headline', label: 'Read past the headline to see how big the actual change was', quality: 'strong', feedback: 'Exactly right. A 1% miss is a small, normal event — the word "panic" is doing more work than the facts are.' },
      { id: 'buy-more-fear', label: 'Ignore it completely and never check your portfolio again', quality: 'weak', feedback: 'Staying informed matters — the goal is to read past the drama, not to stop paying attention altogether.' },
      { id: 'copy-others', label: 'Do whatever other investors online seem to be doing', quality: 'weak', feedback: 'Following the crowd without your own reasoning is how panics feed on themselves.' },
    ],
  },
  {
    id: 'past-performance',
    context: 'A stock has risen five simulated weeks in a row.',
    prompt: 'A stock you own has gone up every week for the last five weeks. What is the safest assumption?',
    options: [
      { id: 'guaranteed-up', label: 'It is now guaranteed to keep going up', quality: 'weak', feedback: 'Past performance does not guarantee future results — a five-week streak says nothing certain about week six.' },
      { id: 'stay-informed', label: 'Recent gains do not guarantee future gains, so keep watching the fundamentals', quality: 'strong', feedback: 'Correct. A winning streak can continue, reverse, or plateau — the underlying business is what matters long-term, not the recent chart shape alone.' },
      { id: 'all-in-more', label: 'Sell every other stock you own and put it all here', quality: 'risky', feedback: 'Concentrating everything into one "hot" stock after a run-up is exactly the concentration risk diversification is meant to avoid.' },
      { id: 'ignore', label: 'The streak has no meaning at all and can be ignored', quality: 'weak', feedback: 'It is worth noticing — just not treating as a guarantee. Context (why it rose) matters more than the streak itself.' },
    ],
  },
  {
    id: 'investing-vs-gambling',
    context: 'A friend suggests putting your whole balance on one stock "for the thrill of it."',
    prompt: 'Your friend says investing is basically the same as gambling, so you might as well go all-in on one exciting pick. What is the strongest response?',
    options: [
      { id: 'agree', label: 'Agree — it is random either way, so it does not matter', quality: 'weak', feedback: 'Investing and gambling both involve risk, but investing is based on ownership of real, ongoing businesses with research behind it — not a single random outcome.' },
      { id: 'explain-difference', label: 'Explain that research, time horizon, and diversification separate investing from a single bet', quality: 'strong', feedback: 'Right. Long-term investing spreads risk and is grounded in business performance, not a one-shot wager with no further influence over the outcome.' },
      { id: 'go-all-in', label: 'Take the bet — it sounds fun', quality: 'risky', feedback: 'Treating your whole balance as one exciting bet ignores everything diversification and research are meant to protect you from.' },
      { id: 'quit-investing', label: 'Decide investing is too risky and never invest at all', quality: 'weak', feedback: 'The lesson isn\'t "avoid investing" — it\'s "invest thoughtfully." Sitting out entirely has its own long-term cost.' },
    ],
  },
]

export function getDecisionChallenge(id: string): DecisionChallenge | undefined {
  return DECISION_CHALLENGES.find((challenge) => challenge.id === id)
}
