export function isHarnessAccessBlocked(output) {
  return (
    /does not have access to Claude|login again|contact your administrator|auth/i.test(output) ||
    /out of extra usage|usage limit|quota|credit balance/i.test(output)
  );
}
