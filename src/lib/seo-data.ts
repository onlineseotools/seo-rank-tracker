export type NavItem = {
  href: string;
  label: string;
  icon: string;
};

export type ProjectVariant = {
  name: string;
  location: string;
  keywordCount: number;
  avgPosition: number;
  lastCheck: string;
  status: "Active" | "Needs attention";
};

export type ProjectGroup = {
  domain: string;
  owner: string;
  health: string;
  variants: ProjectVariant[];
};

export type KeywordRow = {
  keyword: string;
  project: string;
  intent: string;
  currentRank: number | null;
  previousRank: number | null;
  bestRank: number;
  url: string;
  freshness: string;
};

export type GscOpportunity = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: string;
  position: number;
  action: string;
};

export type CannibalizationCase = {
  query: string;
  project: string;
  pages: string[];
  primaryPage: string;
  severity: "High" | "Medium" | "Resolved";
};

export const navItems: NavItem[] = [
  { href: "/tool-details", label: "Tool Details", icon: "i" },
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/projects", label: "Projects", icon: "📁" },
  { href: "/settings", label: "Settings", icon: "⚙" },
  { href: "/users", label: "Users", icon: "👥" },
];

export const workspaceStats = [
  { label: "Tracked Projects", value: "35", detail: "across 6 parent websites", tone: "var(--green)" },
  { label: "Tracked Keywords", value: "86", detail: "live SEO portfolio", tone: "var(--cyan)" },
  { label: "GSC Query Rows", value: "17,037", detail: "ready for analysis", tone: "var(--violet)" },
  { label: "Rank Check Velocity", value: "92%", detail: "latest cycle completed", tone: "var(--amber)" },
];

export const apiProviders = [
  { name: "Serper.dev", status: "Connected", cost: "$0.001 / query", note: "Fastest for daily checks" },
  { name: "DataForSEO", status: "Standby", cost: "$0.0025 / query", note: "Use for deep SERP detail" },
  { name: "ScrapingRobot", status: "Connected", cost: "$0.0018 / query", note: "Fallback when parsers drift" },
];

export const projectGroups: ProjectGroup[] = [
  {
    domain: "veedalifesciences.com",
    owner: "Veeda Lifesciences",
    health: "16 market variants active",
    variants: [
      { name: "Veeda Lifesciences", location: "India", keywordCount: 11, avgPosition: 8.2, lastCheck: "Today, 09:42", status: "Active" },
      { name: "Veeda Lifesciences - USA", location: "Global / US", keywordCount: 9, avgPosition: 12.4, lastCheck: "Today, 09:46", status: "Active" },
      { name: "Veeda Lifesciences - Germany", location: "Germany", keywordCount: 6, avgPosition: 15.7, lastCheck: "Yesterday", status: "Needs attention" },
    ],
  },
  {
    domain: "jeksonvision.com",
    owner: "Jekson Vision",
    health: "11 variants, strong keyword breadth",
    variants: [
      { name: "Jekson Vision", location: "Global / US", keywordCount: 13, avgPosition: 7.4, lastCheck: "Today, 10:06", status: "Active" },
      { name: "Jekson - Argentina", location: "Argentina", keywordCount: 4, avgPosition: 18.1, lastCheck: "Yesterday", status: "Needs attention" },
      { name: "Jekson Vision - India", location: "India", keywordCount: 8, avgPosition: 10.3, lastCheck: "Today, 10:09", status: "Active" },
    ],
  },
  {
    domain: "organicabiotech.com",
    owner: "Organica Biotech",
    health: "opportunity-heavy GSC profile",
    variants: [
      { name: "Organica - India", location: "India", keywordCount: 12, avgPosition: 13.6, lastCheck: "Today, 10:14", status: "Active" },
      { name: "Organica - New Keywords", location: "India", keywordCount: 7, avgPosition: 19.4, lastCheck: "2 days ago", status: "Needs attention" },
    ],
  },
];

export const keywordRows: KeywordRow[] = [
  {
    keyword: "bioavailability study services",
    project: "Veeda Lifesciences - USA",
    intent: "Commercial",
    currentRank: 4,
    previousRank: 6,
    bestRank: 3,
    url: "/bioavailability-bioequivalence-studies",
    freshness: "checked today",
  },
  {
    keyword: "vision inspection machine",
    project: "Jekson Vision",
    intent: "Commercial",
    currentRank: 7,
    previousRank: 8,
    bestRank: 5,
    url: "/inspection/vision-inspection-machine",
    freshness: "checked today",
  },
  {
    keyword: "wastewater treatment company india",
    project: "Organica Biotech - Wastewater Treatment",
    intent: "Commercial",
    currentRank: 12,
    previousRank: 10,
    bestRank: 9,
    url: "/wastewater-treatment",
    freshness: "checked yesterday",
  },
  {
    keyword: "pharmaceutical cro india",
    project: "Veeda Lifesciences",
    intent: "Commercial",
    currentRank: 3,
    previousRank: 4,
    bestRank: 2,
    url: "/cro-services",
    freshness: "checked today",
  },
  {
    keyword: "tablet inspection machine",
    project: "Jekson Vision - India",
    intent: "Commercial",
    currentRank: null,
    previousRank: 17,
    bestRank: 12,
    url: "/tablet-inspection-machine",
    freshness: "failed latest run",
  },
];

export const opportunities: GscOpportunity[] = [
  {
    query: "bioequivalence studies in india",
    clicks: 51,
    impressions: 3150,
    ctr: "1.62%",
    position: 13.2,
    action: "Refresh CRO landing copy and add schema",
  },
  {
    query: "vision inspection systems pharma",
    clicks: 18,
    impressions: 1440,
    ctr: "1.25%",
    position: 11.4,
    action: "Push to product page cluster and internal links",
  },
  {
    query: "industrial wastewater treatment company",
    clicks: 22,
    impressions: 980,
    ctr: "2.24%",
    position: 9.8,
    action: "Tune title/meta for better SERP capture",
  },
];

export const cannibalizationCases: CannibalizationCase[] = [
  {
    query: "bioavailability study services",
    project: "Veeda Lifesciences - USA",
    pages: ["/bioavailability-bioequivalence-studies", "/clinical-research-services", "/cro-services"],
    primaryPage: "/bioavailability-bioequivalence-studies",
    severity: "High",
  },
  {
    query: "wastewater treatment company india",
    project: "Organica Biotech",
    pages: ["/wastewater-treatment", "/wastewater-treatment-services"],
    primaryPage: "/wastewater-treatment",
    severity: "Medium",
  },
  {
    query: "tablet inspection machine",
    project: "Jekson Vision - India",
    pages: ["/tablet-inspection-machine", "/inspection/tablet-inspection-machine"],
    primaryPage: "/inspection/tablet-inspection-machine",
    severity: "Resolved",
  },
];

export const activityFeed = [
  "09:46 • Veeda USA rank check finished with 9/9 successful keywords.",
  "09:18 • Search Console pull added 1,244 new query-page pairs for Organica.",
  "Yesterday • Jekson Argentina flagged 2 failed keywords for rerun.",
  "Yesterday • Google Sheets sync updated Cannibalization Summary tabs.",
];

export const teamMembers = [
  { name: "admin", role: "Admin", scope: "All projects", auth: "Local", state: "Active" },
  { name: "ops@veeda.com", role: "Editor", scope: "Veeda only", auth: "Google", state: "Pending invite" },
  { name: "seo@organica.com", role: "Viewer", scope: "Organica only", auth: "Google", state: "Active" },
];

export const dashboardDistribution = [
  { label: "Top 3", value: 18, color: "var(--green)" },
  { label: "4 to 10", value: 21, color: "var(--cyan)" },
  { label: "11 to 20", value: 19, color: "var(--amber)" },
  { label: "21+", value: 28, color: "var(--rose)" },
];

export const trendMoments = [
  { day: "Mon", rank: 14.2 },
  { day: "Tue", rank: 13.1 },
  { day: "Wed", rank: 12.5 },
  { day: "Thu", rank: 11.9 },
  { day: "Fri", rank: 10.8 },
];
