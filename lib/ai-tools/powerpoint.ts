import JSZip from 'jszip'

export const POWERPOINT_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

type PresentationSlide = {
  title: string
  bullets: string[]
  notes?: string
}

export type DeckTheme = {
  id: string
  label: string
  background: string
  accentPrimary: string
  accentSecondary: string
  titleColor: string
  bodyColor: string
  mutedColor: string
  fontFamily: string
}

/** Prebuilt subject designs — same dark-canvas/light-text language for guaranteed contrast, distinct accent palette and font per subject so a deck visually matches its topic. */
export const DECK_THEMES: readonly DeckTheme[] = [
  { id: 'general', label: 'Air Nexus', background: '0B1020', accentPrimary: '7C3AED', accentSecondary: '06B6D4', titleColor: 'FFFFFF', bodyColor: 'D9E4F5', mutedColor: '8FA3BF', fontFamily: 'Arial' },
  { id: 'science', label: 'Science & Technology', background: '07211F', accentPrimary: '14B8A6', accentSecondary: '38BDF8', titleColor: 'FFFFFF', bodyColor: 'D7F4EF', mutedColor: '7FB8AE', fontFamily: 'Arial' },
  { id: 'business', label: 'Business & Economics', background: '14181F', accentPrimary: 'C9A227', accentSecondary: '64748B', titleColor: 'FFFFFF', bodyColor: 'E8E2CF', mutedColor: 'A69B7A', fontFamily: 'Calibri' },
  { id: 'history', label: 'History & Humanities', background: '241705', accentPrimary: 'B45309', accentSecondary: 'D97706', titleColor: 'FFF7ED', bodyColor: 'F3E0C5', mutedColor: 'C9A57A', fontFamily: 'Georgia' },
  { id: 'arts', label: 'Arts & Literature', background: '1B0F24', accentPrimary: 'A21CAF', accentSecondary: 'EC4899', titleColor: 'FFF5FB', bodyColor: 'F0D9F0', mutedColor: 'C79AD1', fontFamily: 'Trebuchet MS' },
  { id: 'math', label: 'Mathematics', background: '0E1029', accentPrimary: '4338CA', accentSecondary: '64748B', titleColor: 'FFFFFF', bodyColor: 'DCE1F5', mutedColor: '8891B8', fontFamily: 'Cambria' },
]

const THEME_KEYWORDS: Record<string, string[]> = {
  science: ['science', 'scientific', 'biology', 'chemistry', 'physics', 'cell', 'atom', 'molecule', 'ecosystem', 'evolution', 'experiment', 'energy', 'technology', 'engineering', 'computer', 'programming', 'algorithm', 'space', 'astronomy', 'genetics', 'crispr', 'climate', 'geology'],
  business: ['business', 'economics', 'economy', 'finance', 'financial', 'marketing', 'market', 'company', 'entrepreneur', 'management', 'strategy', 'profit', 'investment', 'trade', 'startup', 'sales', 'stock', 'revenue', 'budget'],
  history: ['history', 'historical', 'war', 'revolution', 'ancient', 'medieval', 'empire', 'century', 'civilisation', 'civilization', 'colonial', 'dynasty', 'independence', 'monarchy', 'treaty'],
  arts: ['art', 'literature', 'literary', 'poem', 'poetry', 'novel', 'painting', 'music', 'film', 'drama', 'theatre', 'theater', 'creative writing', 'design', 'aesthetic', 'sculpture', 'author', 'artist'],
  math: ['math', 'maths', 'mathematics', 'algebra', 'geometry', 'calculus', 'equation', 'theorem', 'statistics', 'probability', 'trigonometry', 'formula'],
}

/** Scores subject keyword hits across the brief and generated content, picks the highest-scoring prebuilt design, and falls back to the general Air Nexus theme when nothing matches clearly. */
export function detectDeckTheme(text: string): DeckTheme {
  const lower = text.toLowerCase()
  let bestId = 'general'
  let bestScore = 0
  for (const [id, keywords] of Object.entries(THEME_KEYWORDS)) {
    const score = keywords.reduce((count, word) => count + (lower.includes(word) ? 1 : 0), 0)
    if (score > bestScore) {
      bestScore = score
      bestId = id
    }
  }
  return DECK_THEMES.find((theme) => theme.id === bestId) ?? DECK_THEMES[0]
}

const SLIDE_WIDTH = 12192000
const SLIDE_HEIGHT = 6858000

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function cleanText(value: string, maxLength = 180) {
  return value
    .replace(/\*\*/g, '')
    .replace(/^[\s#>*-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function pptDate() {
  return new Date().toISOString()
}

function safeTitle(value: string) {
  return cleanText(value, 88) || 'Air Nexus presentation'
}

function paragraph(text: string, options: { size: number; color: string; bold?: boolean; bullet?: boolean; align?: 'l' | 'ctr' | 'r' }) {
  const alignAttr = options.align ? ` algn="${options.align}"` : ''
  const bulletPr = options.bullet
    ? `<a:pPr marL="342900" indent="-171450"${alignAttr}><a:buFont typeface="Arial"/><a:buChar char="&#8226;"/></a:pPr>`
    : `<a:pPr${alignAttr}/>`
  const bold = options.bold ? ' b="1"' : ''
  return `<a:p>${bulletPr}<a:r><a:rPr lang="en-US" sz="${options.size * 100}"${bold} dirty="0"><a:solidFill><a:srgbClr val="${options.color}"/></a:solidFill></a:rPr><a:t>${escapeXml(text)}</a:t></a:r><a:endParaRPr lang="en-US" sz="${options.size * 100}"/></a:p>`
}

function textShape(id: number, name: string, x: number, y: number, cx: number, cy: number, body: string, anchor?: 'ctr') {
  const bodyPr = anchor ? `<a:bodyPr wrap="square" anchor="${anchor}" rtlCol="0"/>` : '<a:bodyPr wrap="square" rtlCol="0"/>'
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody>${bodyPr}<a:lstStyle/>${body}</p:txBody></p:sp>`
}

function rectShape(id: number, x: number, y: number, cx: number, cy: number, color: string, transparency = 0) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Accent ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${color}"><a:alpha val="${100000 - transparency}"/></a:srgbClr></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`
}

function slideShell(body: string, background: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="${background}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_WIDTH}" cy="${SLIDE_HEIGHT}"/><a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_WIDTH}" cy="${SLIDE_HEIGHT}"/></a:xfrm></p:grpSpPr>
      ${body}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`
}

/** Slide 1 renders as a distinct cover: centered title + subtitle, matching how real template decks open. */
function coverSlideXml(slide: PresentationSlide, theme: DeckTheme) {
  const title = paragraph(safeTitle(slide.title), { size: 40, color: theme.titleColor, bold: true, align: 'ctr' })
  const subtitleText = cleanText(slide.bullets[0] ?? 'An Air Nexus presentation', 130)
  const subtitle = paragraph(subtitleText, { size: 16, color: theme.mutedColor, align: 'ctr' })
  const body = [
    rectShape(2, 4876800, 3886200, 2438400, 25400, theme.accentPrimary),
    textShape(3, 'Title', 838200, 2514600, 10515600, 1219200, title, 'ctr'),
    textShape(4, 'Subtitle', 838200, 4038600, 10515600, 685800, subtitle, 'ctr'),
  ].join('')
  return slideShell(body, theme.background)
}

function contentSlideXml(slide: PresentationSlide, index: number, theme: DeckTheme, totalSlides: number) {
  const title = paragraph(safeTitle(slide.title), { size: 31, color: theme.titleColor, bold: true })
  const bullets = (slide.bullets.length ? slide.bullets : ['Add your key point here.'])
    .slice(0, 6)
    .map((item) => paragraph(cleanText(item, 150), { size: 18, color: theme.bodyColor, bullet: true }))
    .join('')
  const footer = paragraph(`Air Nexus · Slide ${index + 1} of ${totalSlides}`, { size: 9, color: theme.mutedColor })
  const accent = index % 2 === 0 ? theme.accentPrimary : theme.accentSecondary
  const accentAlt = index % 2 === 0 ? theme.accentSecondary : theme.accentPrimary
  const body = [
    rectShape(2, 0, 0, SLIDE_WIDTH, 190500, accent),
    rectShape(3, 9144000, 457200, 1828800, 1828800, accentAlt, 45000),
    textShape(4, 'Title', 685800, 647700, 8534400, 1409700, title),
    textShape(5, 'Bullets', 914400, 2352675, 9144000, 3009900, bullets),
    textShape(6, 'Footer', 914400, 6259350, 9144000, 304800, footer),
  ].join('')
  return slideShell(body, theme.background)
}

function contentTypes(slideCount: number) {
  const slides = Array.from({ length: slideCount }, (_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${slides}
</Types>`
}

function packageRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
}

function presentationXml(slideCount: number) {
  const slideIds = Array.from({ length: slideCount }, (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>${slideIds}</p:sldIdLst>
  <p:sldSz cx="${SLIDE_WIDTH}" cy="${SLIDE_HEIGHT}" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:defaultTextStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:defaultTextStyle>
</p:presentation>`
}

function presentationRels(slideCount: number) {
  const slideRels = Array.from({ length: slideCount }, (_, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${slideRels}
</Relationships>`
}

function slideMasterXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_WIDTH}" cy="${SLIDE_HEIGHT}"/><a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_WIDTH}" cy="${SLIDE_HEIGHT}"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>
</p:sldMaster>`
}

function slideMasterRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`
}

function slideLayoutXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_WIDTH}" cy="${SLIDE_HEIGHT}"/><a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_WIDTH}" cy="${SLIDE_HEIGHT}"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`
}

function slideLayoutRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`
}

function slideRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`
}

function themeXml(theme: DeckTheme) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${escapeXml(theme.label)}">
  <a:themeElements>
    <a:clrScheme name="${escapeXml(theme.label)}"><a:dk1><a:srgbClr val="${theme.background}"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="111827"/></a:dk2><a:lt2><a:srgbClr val="E5E7EB"/></a:lt2><a:accent1><a:srgbClr val="${theme.accentPrimary}"/></a:accent1><a:accent2><a:srgbClr val="${theme.accentSecondary}"/></a:accent2><a:accent3><a:srgbClr val="10B981"/></a:accent3><a:accent4><a:srgbClr val="F59E0B"/></a:accent4><a:accent5><a:srgbClr val="F472B6"/></a:accent5><a:accent6><a:srgbClr val="94A3B8"/></a:accent6><a:hlink><a:srgbClr val="38BDF8"/></a:hlink><a:folHlink><a:srgbClr val="A78BFA"/></a:folHlink></a:clrScheme>
    <a:fontScheme name="${escapeXml(theme.label)}"><a:majorFont><a:latin typeface="${escapeXml(theme.fontFamily)}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="${escapeXml(theme.fontFamily)}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>
    <a:fmtScheme name="${escapeXml(theme.label)}">
      <a:fillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:fillStyleLst>
      <a:lnStyleLst>
        <a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
        <a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
        <a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
      </a:lnStyleLst>
      <a:effectStyleLst>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
      </a:effectStyleLst>
      <a:bgFillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
  <a:objectDefaults>
    <a:spDef><a:spPr/><a:bodyPr/><a:lstStyle/><a:style><a:lnRef idx="1"><a:schemeClr val="accent1"/></a:lnRef><a:fillRef idx="3"><a:schemeClr val="accent1"/></a:fillRef><a:effectRef idx="2"><a:schemeClr val="accent1"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef></a:style></a:spDef>
    <a:lnDef><a:spPr/><a:bodyPr/><a:lstStyle/><a:style><a:lnRef idx="2"><a:schemeClr val="accent1"/></a:lnRef><a:fillRef idx="0"><a:schemeClr val="accent1"/></a:fillRef><a:effectRef idx="1"><a:schemeClr val="accent1"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="tx1"/></a:fontRef></a:style></a:lnDef>
  </a:objectDefaults>
  <a:extraClrSchemeLst/>
</a:theme>`
}

function appProps(slideCount: number) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Air Nexus</Application><PresentationFormat>Widescreen</PresentationFormat><Slides>${slideCount}</Slides><Company>Air Nexus</Company></Properties>`
}

function coreProps(title: string) {
  const now = pptDate()
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(title)}</dc:title><dc:creator>Air Nexus</dc:creator><cp:lastModifiedBy>Air Nexus</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`
}

export function parsePresentationSlides(outline: string, fallbackTitle: string): PresentationSlide[] {
  const sections = outline.split(/(?=^##\s+Slide\s+\d+)/gim).map((section) => section.trim()).filter(Boolean)
  const slides = sections.flatMap((section): PresentationSlide[] => {
    const lines = section.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    const heading = lines.find((line) => /^##\s+Slide\s+\d+/i.test(line))
    if (!heading) return []
    const title = cleanText(heading.replace(/^##\s+Slide\s+\d+[:\s-]*/i, ''), 90)
    const bullets = lines
      .filter((line) => !/^##\s+Slide\s+\d+/i.test(line))
      .filter((line) => !/^(On-slide|Visual|Speaker notes)\b/i.test(line.replace(/\*\*/g, '')))
      .map((line) => cleanText(line.replace(/^[-*+]\s*/, ''), 150))
      .filter(Boolean)
      .slice(0, 6)
    return [{ title: title || fallbackTitle, bullets }]
  })

  if (slides.length > 0) return slides.slice(0, 12)

  const fallbackBullets = outline
    .split(/\r?\n|\.\s+/)
    .map((line) => cleanText(line, 150))
    .filter(Boolean)
    .slice(0, 5)
  return [{ title: fallbackTitle || 'Air Nexus presentation', bullets: fallbackBullets.length ? fallbackBullets : ['Add your main idea.', 'Add supporting evidence.', 'Add a closing takeaway.'] }]
}

export function presentationFilename(slides: PresentationSlide[]) {
  const title = (slides[0]?.title ?? 'air-nexus-presentation')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'air-nexus-presentation'
  const date = new Date().toISOString().slice(0, 10)
  return `${title}-${date}.pptx`
}

export async function buildPowerPoint(slides: PresentationSlide[], theme: DeckTheme = DECK_THEMES[0]) {
  const deckSlides = slides.slice(0, 12)
  const zip = new JSZip()
  zip.file('[Content_Types].xml', contentTypes(deckSlides.length))
  zip.file('_rels/.rels', packageRels())
  zip.file('docProps/app.xml', appProps(deckSlides.length))
  zip.file('docProps/core.xml', coreProps(deckSlides[0]?.title ?? 'Air Nexus presentation'))
  zip.file('ppt/presentation.xml', presentationXml(deckSlides.length))
  zip.file('ppt/_rels/presentation.xml.rels', presentationRels(deckSlides.length))
  zip.file('ppt/slideMasters/slideMaster1.xml', slideMasterXml())
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', slideMasterRels())
  zip.file('ppt/slideLayouts/slideLayout1.xml', slideLayoutXml())
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', slideLayoutRels())
  zip.file('ppt/theme/theme1.xml', themeXml(theme))
  deckSlides.forEach((slide, index) => {
    const xml = index === 0 ? coverSlideXml(slide, theme) : contentSlideXml(slide, index, theme, deckSlides.length)
    zip.file(`ppt/slides/slide${index + 1}.xml`, xml)
    zip.file(`ppt/slides/_rels/slide${index + 1}.xml.rels`, slideRels())
  })
  return zip.generateAsync({ type: 'base64', compression: 'DEFLATE' })
}
