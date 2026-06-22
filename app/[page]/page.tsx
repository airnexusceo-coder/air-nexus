import { notFound } from 'next/navigation'
import { NexusPointSite, type MarketingPage } from '@/components/nexus-point-site'

const pages: MarketingPage[] = ['products', 'pricing', 'resources', 'company', 'login', 'signup', 'airgpt']

export default async function MarketingRoute({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params
  if (!pages.includes(page as MarketingPage)) notFound()
  return <NexusPointSite page={page as MarketingPage} />
}
