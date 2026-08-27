"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

/**
 * Initialize PostHog with privacy-safe defaults for healthcare app.
 * 
 * PRIVACY REQUIREMENTS:
 * - NO session recording
 * - NO identify() calls
 * - NO PHI/PII capture
 * - Pageviews and safe navigation events only
 */
export function initPostHog() {
  if (typeof window === "undefined") return;
  if (!POSTHOG_KEY) return;

  // Skip if already initialized
  if (posthog.__loaded) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST || "https://us.i.posthog.com",
    
    // Privacy: identified_only means no anonymous person profiles
    person_profiles: "identified_only",
    
    // CRITICAL: Disable session recording for PHI compliance
    disable_session_recording: true,
    
    // Auto-capture pageviews (safe - no PHI)
    capture_pageview: false, // We handle this manually for SPA navigation
    capture_pageleave: true,
    
    // Disable features that could capture PHI
    autocapture: false, // Disable autocapture to prevent form data capture
    
    // Privacy: Don't persist user data across sessions
    persistence: "localStorage",
    
    // Load after window is ready
    loaded: (posthogInstance) => {
      // Register super property to identify this app
      posthogInstance.register({ app: "daycare" });
      
      // Development: enable debug mode
      if (process.env.NODE_ENV === "development") {
        posthogInstance.debug();
      }
    },
  });
}

/**
 * Track pageviews on route changes (SPA-safe).
 * Only captures URL path, no query params or PHI.
 */
function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthogClient = usePostHog();

  useEffect(() => {
    if (pathname && posthogClient) {
      // Capture pageview with clean URL only (no query params that might contain PHI)
      const url = window.origin + pathname;
      
      // Only include search params if they don't contain potential PHI
      // Skip all query params for safety in healthcare context
      posthogClient.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams, posthogClient]);

  return null;
}

/**
 * Wrapper component to handle Suspense for useSearchParams
 */
function SuspendedPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageView />
    </Suspense>
  );
}

interface PostHogProviderProps {
  children: React.ReactNode;
}

/**
 * PostHog provider wrapper for Next.js App Router.
 * Initializes PostHog on mount and tracks pageviews.
 */
export function PostHogProvider({ children }: PostHogProviderProps) {
  useEffect(() => {
    initPostHog();
  }, []);

  if (!POSTHOG_KEY) {
    // PostHog not configured - render children without tracking
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <SuspendedPageView />
      {children}
    </PHProvider>
  );
}

/**
 * Safe event tracking utilities.
 * ONLY use these for non-PHI events like navigation clicks.
 */

/**
 * Track login page view (safe - no credentials captured).
 */
export function trackLoginPageViewed() {
  if (typeof window === "undefined" || !posthog.__loaded) return;
  posthog.capture("login_page_viewed");
}

/**
 * Track staff navigation click (safe - route name only, no PHI).
 * @param routeName - The name/label of the navigation item (NOT user data)
 */
export function trackStaffNavClicked(routeName: string) {
  if (typeof window === "undefined" || !posthog.__loaded) return;
  // Only capture the route name, never patient data or PHI
  posthog.capture("staff_nav_clicked", { route: routeName });
}
