import type { Lesson } from '@/lib/market-masters/types'

export const LESSONS: Lesson[] = [
  {
    id: 'what-is-a-stock',
    order: 1,
    title: 'What Is a Stock?',
    summary: 'The basic idea behind owning a small piece of a company.',
    content: [
      'A stock (also called a "share") is a tiny slice of ownership in a company. When you buy one share of a company, you own a very small part of that business.',
      'Companies sell shares to raise money to grow — to open new stores, build products, or hire staff — without having to borrow it all from a bank.',
      "As a shareholder, your slice of the company can become more or less valuable depending on how the company performs and how investors feel about its future. That change in value is reflected in the share price.",
      'Owning a stock is different from a savings account: there is no guaranteed interest rate, and the value can go up or down. That is the trade-off for the chance of a higher long-term return.',
    ],
    quiz: [
      {
        id: 'stock-q1',
        prompt: 'What does owning one share of a company actually mean?',
        options: [
          'You own a small piece of that company',
          'You have lent the company money that must be repaid on a fixed date',
          'You work for the company',
          'You are guaranteed a fixed yearly payment',
        ],
        correctIndex: 0,
        explanation: 'A share represents partial ownership of the company, not a loan or a job.',
      },
      {
        id: 'stock-q2',
        prompt: 'Why do companies sell shares in the first place?',
        options: [
          'To avoid paying any taxes',
          'To raise money to grow the business',
          'It is legally required for every company',
          'To reduce the number of customers',
        ],
        correctIndex: 1,
        explanation: 'Selling shares is one way companies raise money without taking on debt.',
      },
      {
        id: 'stock-q3',
        prompt: 'Is a stock\'s return guaranteed, like a savings account\'s interest rate?',
        options: ['Yes, always', 'No — the value can go up or down', 'Only for large companies', 'Only during the first year'],
        correctIndex: 1,
        explanation: 'Share prices move with the company\'s performance and investor sentiment — there is no guaranteed return.',
      },
    ],
    xpReward: 40,
    bonusCash: 150,
  },
  {
    id: 'buying-selling-profit-loss',
    order: 2,
    title: 'Buying, Selling, and Profit & Loss',
    summary: 'How trades work, and what "profit" and "loss" actually mean.',
    content: [
      'Buying a stock means paying its current share price to own a share. Selling means giving that share back to the market in exchange for cash, at whatever the price is at that moment.',
      'Your profit or loss on a position is the difference between what you paid (your "cost basis") and what the shares are worth now. If you bought at $20 and the price is now $25, you have an unrealized gain of $5 per share — "unrealized" because you have not sold yet.',
      'A gain only becomes real money in your account once you sell. Until then, it can still go back down.',
      'The same math works in reverse: if the price drops below what you paid, you have an unrealized loss. Selling at that point "locks in" the loss; holding on gives the price a chance to recover — but no guarantee that it will.',
    ],
    quiz: [
      {
        id: 'trade-q1',
        prompt: 'You bought a share at $40 and it is now worth $50. What is true?',
        options: [
          'You have a realized $10 profit already in your bank account',
          'You have an unrealized $10 gain until you sell',
          'You have lost $10',
          'Nothing has changed until the company announces earnings',
        ],
        correctIndex: 1,
        explanation: 'The gain is "unrealized" — it only becomes real cash once you actually sell the share.',
      },
      {
        id: 'trade-q2',
        prompt: 'What happens the moment you sell a share for less than you paid for it?',
        options: [
          'The loss disappears automatically',
          'The loss becomes realized',
          'You are charged a penalty on top',
          'The company reimburses the difference',
        ],
        correctIndex: 1,
        explanation: 'Selling at a lower price than you paid locks in ("realizes") the loss.',
      },
      {
        id: 'trade-q3',
        prompt: 'What price do you pay when you buy a share?',
        options: ['A fixed price set once a year', 'Whatever the current market price is', 'Always the lowest price of the day', 'A price the company sets for each buyer individually'],
        correctIndex: 1,
        explanation: 'Trades happen at the current market price, which changes continuously as buyers and sellers trade.',
      },
    ],
    xpReward: 40,
    bonusCash: 150,
  },
  {
    id: 'diversification',
    order: 3,
    title: "Diversification: Don't Put All Your Eggs in One Basket",
    summary: 'Why spreading investments across companies and industries reduces risk.',
    content: [
      'Diversification means spreading your money across different companies and industries instead of putting it all into one.',
      'If you invest everything in a single company and something goes wrong there, your whole portfolio takes the hit. If that same money is spread across ten companies in different industries, one bad result affects only a small slice of your total investment.',
      'Diversification does not guarantee a profit or stop losses altogether — the whole market can still fall together. What it does is reduce the damage any single company\'s bad news can do to your overall portfolio.',
      'A simple way to think about it: mixing industries that do not all rise and fall for the same reasons (for example, energy and technology) tends to smooth out the ride compared to holding one industry alone.',
    ],
    quiz: [
      {
        id: 'div-q1',
        prompt: 'What is diversification?',
        options: [
          'Buying only the cheapest stocks',
          'Spreading investments across different companies and industries',
          'Selling everything at the first sign of bad news',
          'Investing only in one industry you understand best',
        ],
        correctIndex: 1,
        explanation: 'Diversification is about spreading risk across multiple companies and industries.',
      },
      {
        id: 'div-q2',
        prompt: 'If you put all your money into one company and it drops 40%, what happens to a diversified portfolio holding the same amount in ten companies (one of which drops 40%)?',
        options: [
          'The whole diversified portfolio also drops 40%',
          'The diversified portfolio takes a much smaller hit',
          'Diversification makes losses impossible',
          'Nothing — diversification only matters for gains',
        ],
        correctIndex: 1,
        explanation: 'A 40% drop in one of ten equal positions affects roughly 4% of the total portfolio, not 40%.',
      },
      {
        id: 'div-q3',
        prompt: 'Does diversification guarantee you will never lose money?',
        options: ['Yes, it eliminates all risk', 'No, it reduces the impact of any single company\'s bad news', 'Only if you diversify across exactly 10 companies', 'Only during a bull market'],
        correctIndex: 1,
        explanation: 'Diversification manages risk — it does not eliminate it. Broad market downturns can still affect a diversified portfolio.',
      },
    ],
    xpReward: 50,
    bonusCash: 200,
  },
]

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === id)
}
