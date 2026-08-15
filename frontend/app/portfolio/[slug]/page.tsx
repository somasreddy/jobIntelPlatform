import type { Metadata } from "next";
import PortfolioPublicView from "./PortfolioPublicView";
import type { PublicPortfolio } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Fetches the public portfolio for `slug` server-side.
 *
 * Both `generateMetadata` and the page component below call this with the
 * exact same URL/options. Next.js automatically de-duplicates identical
 * `fetch` calls made during the same render pass (React's request
 * memoization, extended by Next to the `fetch` API), so this only results
 * in ONE real network request per page view — important here because the
 * backend increments `Portfolio.view_count` as a side effect of this GET
 * (see backend/api/portfolio.py::get_public_portfolio). Calling it twice
 * per render would double-count every view.
 */
async function getPortfolio(slug: string): Promise<PublicPortfolio | null> {
  try {
    const res = await fetch(`${API}/api/portfolio/public/${slug}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as PublicPortfolio;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const portfolio = await getPortfolio(slug);

  if (!portfolio) {
    return {
      title: "Portfolio not found – JobIntel AI",
      description: "This career portfolio doesn't exist or is no longer public.",
      robots: { index: false, follow: false },
    };
  }

  const name = portfolio.headline || slug;
  const rawDescription =
    portfolio.ai_bio || portfolio.bio || `${name}'s career portfolio, built with JobIntel AI.`;
  const description = rawDescription.length > 200 ? `${rawDescription.slice(0, 197)}...` : rawDescription;
  const title = `${name} – Portfolio | JobIntel AI`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      url: `/portfolio/${portfolio.slug}`,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function PublicPortfolioPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const portfolio = await getPortfolio(slug);
  return <PortfolioPublicView slug={slug} portfolio={portfolio} />;
}
