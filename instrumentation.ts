export async function register() {
  // Only run in Node.js runtime, not Edge
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerCronJobs } = await import("./lib/cron/index")
    registerCronJobs()
  }
}
