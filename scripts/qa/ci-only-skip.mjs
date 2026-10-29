/* TESTFIX1 · the ONE way a suite test may skip for a CI-only reason.
   ciOnlySkip(id, absent, why) returns a skip reason ONLY when BOTH hold:
     (a) we are on the GitHub runner (GITHUB_ACTIONS=true), and
     (b) the box-only precondition is really absent on this run (absent === true, computed by the caller).
   Anywhere else (the box, the pinned hooks, Alfred's gate) it returns false, so the test RUNS and a missing
   private file or baseline still FAILS there. Every skip prints its reason (stdout line + the TAP "# SKIP" text);
   nothing here ever turns a failing assertion into a pass. testfix1-guard.test.mjs pins this behaviour. */
export function ciOnlySkip(id, absent, why) {
  if (process.env.GITHUB_ACTIONS !== "true" || absent !== true) return false;
  const reason = "CI-ONLY " + id + ": " + why;
  console.log("TESTFIX1 skip (visible): " + reason);
  return reason;
}
