import { NexusPointSite } from '@/components/nexus-point-site'

export default async function ToolRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <NexusPointSite page="tool" toolSlug={slug} />
}
