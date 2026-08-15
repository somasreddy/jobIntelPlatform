"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { durations, easings } from "@/lib/motion-tokens";

export default function CampaignError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No telemetry service wired up yet — console is the only sink for now.
    console.error("Campaign route error:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: durations.base, ease: easings.outQuint }}
      >
        <Card className="max-w-md w-full p-8 text-center backdrop-blur-xl">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
          >
            <AlertTriangle className="w-6 h-6" style={{ color: "var(--accent-bright)" }} />
          </div>
          <h1 className="text-lg font-bold text-white">Your campaign hit a snag</h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Something interrupted your daily plan and progress tracker. Nothing was lost — your
            streak, pipeline stats, and goals are saved. Try reloading this page, or head back to
            the dashboard.
          </p>
          {error?.digest && (
            <p className="text-[11px] mt-3 font-mono" style={{ color: "var(--text-muted)" }}>
              Error ref: {error.digest}
            </p>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="w-full sm:w-auto">
              <Button type="button" onClick={() => reset()} className="btn-primary h-auto w-full sm:w-auto flex items-center justify-center gap-2 text-sm">
                <RotateCcw className="w-4 h-4" />
                Try again
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="w-full sm:w-auto">
              <Button asChild className="btn-secondary h-auto w-full sm:w-auto flex items-center justify-center gap-2 text-sm">
                <Link href="/">
                  <Home className="w-4 h-4" />
                  Back to home
                </Link>
              </Button>
            </motion.div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
