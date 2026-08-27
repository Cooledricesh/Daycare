"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

/**
 * Patient detail route patterns that contain IDs which must be sanitized.
 * These routes expose patient IDs in the URL path:
 * - /dashboard/nurse/patient/{id}
 * - /dashboard/staff/patient/{id}
 * - /dashboard/doctor/history/{id}
 */
const PATIENT_ID_PATTERNS = [
  /^(\/dashboard\/nurse\/patient)\/[^/]+(.*)$/,
  /^(\/dashboard\/staff\/patient)\/[^/]+(.*)$/,
  /^(\/dashboard\/doctor\/history)\/[^/]+(.*)$/,
];

/**
 * Sanitize URL paths to remove patient IDs.
 * Replaces patient ID segments with ':id' placeholder to prevent PHI leakage.
 * 
 * @example
 * sanitizeUrlPath('/dashboard/nurse/patient/12345') // '/dashboard/nurse/patient/:id'
 * sanitizeUrlPath('/dashboard/staff/patient/abc-123/notes') // '/dashboard/staff/patient/:id/notes'
 */
export function sanitizeUrlPath(path: string): string {
  for (const pattern of PATIENT_ID_PATTERNS) {
    if (pattern.test(path)) {
      return path.replace(pattern, '$1/:id$2');
    }
  }
  return path;
}

/**
 * Sanitize a full URL (with origin) to remove patient IDs from the path.
 */
function sanitizeFullUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.pathname = sanitizeUrlPath(parsed.pathname);
    parsed.search = ''; // Strip query params for PHI safety
    return parsed.toString();
  } catch {
    // If URL parsing fails, attempt path-only sanitization
    return sanitizeUrlPath(url);
  }
}

/**
 * Properties that may contain URLs with patient IDs.
 * These are sanitized via sanitize_properties in PostHog config.
 */
const URL_PROPERTIES = [
  '$current_url',
  '$pathname',
  '$referrer',
  '$initial_referrer',
  '$initial_current_url',
  '$initial_pathname',
];

/**
 * Initialize PostHog with privacy-safe defaults for healthcare app.
 * 
 * PRIVACY REQUIREMENTS:
 * - NO session recording
 * - NO identify() calls
 * - NO PHI/PII capture
 * - URL paths sanitized to remove patient IDs
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
    
    // CRITICAL: Sanitize all URL properties to remove patient IDs
    sanitize_properties: (properties, event) => {
      if (!properties) return properties;
      
      const sanitized = { ...properties };
      
      for (const prop of URL_PROPERTIES) {
        if (typeof sanitized[prop] === 'string') {
          if (prop === '$pathname' || prop === '$initial_pathname') {
            sanitized[prop] = sanitizeUrlPath(sanitized[prop]);
          } else {
            sanitized[prop] = sanitizeFullUrl(sanitized[prop]);
          }
        }
      }
      
      return sanitized;
    },
    
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
 * Only captures sanitized URL path (patient IDs replaced with :id).
 * No query params captured for PHI safety.
 */
function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthogClient = usePostHog();

  useEffect(() => {
    if (pathname && posthogClient) {
      // Sanitize pathname to remove patient IDs before capturing
      const sanitizedPath = sanitizeUrlPath(pathname);
      const url = window.origin + sanitizedPath;
      
      // Capture pageview with sanitized URL (no patient IDs, no query params)
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
