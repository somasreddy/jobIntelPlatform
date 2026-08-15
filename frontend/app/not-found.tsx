import Link from "next/link";
import { Compass, Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-lg w-full">
        <p
          className="text-xs font-semibold uppercase tracking-wide text-center mb-3"
          style={{ color: "var(--accent-bright)" }}
        >
          404
        </p>
        <EmptyState
          icon={Compass}
          title="Page not found"
          description="The page you're looking for doesn't exist or may have moved. Head back to the dashboard or search for jobs instead."
          size="lg"
        >
          <Button asChild className="btn-primary h-auto w-full sm:w-auto flex items-center justify-center gap-2 text-sm">
            <Link href="/">
              <Home className="w-4 h-4" />
              Back to home
            </Link>
          </Button>
          <Button asChild className="btn-secondary h-auto w-full sm:w-auto flex items-center justify-center gap-2 text-sm">
            <Link href="/jobs">
              <Search className="w-4 h-4" />
              Browse jobs
            </Link>
          </Button>
        </EmptyState>
      </div>
    </div>
  );
}
