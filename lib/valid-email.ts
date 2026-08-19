/**
 * The one email-address check the public funnels share.
 *
 * Deliberately permissive: reject the obviously-not-an-address and nothing more.
 * A stricter pattern turns away real addresses, and the only thing riding on
 * this is whether we bother trying to send. Delivery is the real validator.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) && email.trim().length <= 254
}
