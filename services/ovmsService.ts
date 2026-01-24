// This service is deprecated.
// Direct browser-to-OVMS TCP connections are not possible.
// Please use the 'backend/ovms-logger.js' Node.js service to ingest data into Supabase.
// The frontend will then read from Supabase.

export const fetchFromOvmsApi = async () => {
  console.warn("Frontend OVMS API fetch is deprecated. Use backend logger.");
  return null;
};
