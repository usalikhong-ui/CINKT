export function outcomeFromTicket(ticket) {
  if (!Number.isInteger(ticket) || ticket < 0 || ticket >= 2000) throw new RangeError('Invalid ticket');
  return ticket < 2 ? 'later' : ticket < 1001 ? 'yes' : 'no';
}
export function drawOutcome(randomSource = globalThis.crypto) {
  const value = new Uint32Array(1);
  // Reject the incomplete final bucket to keep all 2,000 tickets equally likely.
  const limit = Math.floor(2 ** 32 / 2000) * 2000;
  do { randomSource.getRandomValues(value); } while (value[0] >= limit);
  return outcomeFromTicket(value[0] % 2000);
}
