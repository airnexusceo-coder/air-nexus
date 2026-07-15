import type { AdvertisingChannelProfile } from '@/lib/business-empire/types'

/**
 * Ten advertising choices, including doing nothing. Effectiveness is not a
 * single global number — it is looked up per industry from
 * `IndustryProfile.advertisingEffectiveness`, so the same channel is a smart
 * pick in one industry and a waste of budget in another.
 */
export const ADVERTISING_CHANNELS: AdvertisingChannelProfile[] = [
  {
    id: 'social-media',
    label: 'Social Media',
    description: 'Organic and paid posts across social platforms.',
    targetAudience: 'Younger, digitally active customers',
    minBudget: 200,
    reachPerDollar: 18,
    effectivenessLabel: 'high',
    risk: 'Can be ignored quickly if the content does not stand out.',
  },
  {
    id: 'video-ads',
    label: 'Online Video Ads',
    description: 'Short video advertisements shown before or during online content.',
    targetAudience: 'Broad online audience, strong with younger viewers',
    minBudget: 500,
    reachPerDollar: 14,
    effectivenessLabel: 'high',
    risk: 'Production cost is not included — a poorly made ad can under-perform.',
  },
  {
    id: 'search-ads',
    label: 'Search Advertisements',
    description: 'Ads shown to people actively searching for related products.',
    targetAudience: 'Customers already close to a purchase decision',
    minBudget: 300,
    reachPerDollar: 10,
    effectivenessLabel: 'medium',
    risk: 'Only reaches people already looking — does not build broad awareness.',
  },
  {
    id: 'television',
    label: 'Television',
    description: 'Traditional TV commercial spots.',
    targetAudience: 'Very broad, older-skewing audience',
    minBudget: 3_000,
    reachPerDollar: 6,
    effectivenessLabel: 'medium',
    risk: 'Expensive — a small budget barely makes a dent.',
  },
  {
    id: 'radio',
    label: 'Radio',
    description: 'Audio advertisements on radio stations.',
    targetAudience: 'Commuters and local audiences',
    minBudget: 800,
    reachPerDollar: 9,
    effectivenessLabel: 'low',
    risk: 'Lower attention than visual formats, easy to tune out.',
  },
  {
    id: 'billboards',
    label: 'Billboards',
    description: 'Physical outdoor advertising in high-traffic areas.',
    targetAudience: 'Local commuters and residents',
    minBudget: 1_500,
    reachPerDollar: 7,
    effectivenessLabel: 'medium',
    risk: 'Only reaches people who physically pass by.',
  },
  {
    id: 'influencer',
    label: 'Influencer Campaigns',
    description: 'Paying online creators to feature your product.',
    targetAudience: 'The influencer’s specific, engaged following',
    minBudget: 400,
    reachPerDollar: 16,
    effectivenessLabel: 'high',
    risk: 'A mismatched influencer, or one who has a scandal, can hurt your brand.',
  },
  {
    id: 'sponsorship',
    label: 'Sponsorships',
    description: 'Sponsoring an event, team, or creator over a longer period.',
    targetAudience: 'Fans and audiences of the sponsored event or team',
    minBudget: 2_000,
    reachPerDollar: 8,
    effectivenessLabel: 'medium',
    risk: 'A long commitment — you are tied to the reputation of whoever you sponsor.',
  },
  {
    id: 'discount-promo',
    label: 'Discounts & Promotions',
    description: 'Temporary price cuts or bundled offers to drive short-term sales.',
    targetAudience: 'Price-sensitive and bargain-hunting customers',
    minBudget: 100,
    reachPerDollar: 12,
    effectivenessLabel: 'medium',
    risk: 'Can train customers to wait for the next discount instead of buying at full price.',
  },
  {
    id: 'none',
    label: 'No Advertising',
    description: 'Rely on word of mouth and existing reputation alone.',
    targetAudience: 'None targeted directly',
    minBudget: 0,
    reachPerDollar: 0,
    effectivenessLabel: 'low',
    risk: 'Awareness will only grow slowly, through reputation and past customers.',
  },
]

export function getAdvertisingChannel(id: string): AdvertisingChannelProfile | undefined {
  return ADVERTISING_CHANNELS.find((channel) => channel.id === id)
}
