export default function SetupNotice({ error }: { error: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
      <h1 className="mb-2 text-base font-semibold">Database not connected</h1>
      <p className="mb-3">
        This app couldn&apos;t reach Postgres. If you&apos;re setting this up for the first time,
        provision a Postgres database in the Vercel dashboard (Storage tab) and link it to this
        project, then redeploy — the required tables are created automatically on first request.
      </p>
      <p className="mb-1 font-medium">Details:</p>
      <pre className="overflow-x-auto rounded bg-amber-100 p-2 text-xs">{error}</pre>
    </div>
  );
}
