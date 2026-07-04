export interface HelpEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  example?: Record<string, unknown>;
  /** Feature-ready: not yet built, coming in a future phase */
  comingSoon?: boolean;
}

export interface ModuleHelp {
  module: string;           // e.g. "gst"
  title: string;            // e.g. "GST Module"
  description: string;      // plain-language overview
  phase: string;            // "Phase 1", "Phase 2", etc.
  endpoints: HelpEndpoint[];
  guides?: string[];        // links or guide titles (stub for now)
  caNote?: string;          // CA-specific guidance
}
