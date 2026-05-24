# Reward Vault — Pilot Family Test Checklist

One complete live reward cycle. Estimated time: 20–30 minutes with two people.

---

## Section A — Developer pre-flight (run before handing to the family)

These steps are for whoever set up the app. Run them once. The family walkthrough (Section B) does not require these.

- [ ] `npx tsc --noEmit` — clean (no TypeScript errors)
- [ ] `npm run lint` — clean
- [ ] `npm run build` — clean
- [ ] `node scripts/verify-reward-vault-safety.mjs` — 25/25 passed
- [ ] `node scripts/verify-reward-cycle.mjs` — 24/24 passed
- [ ] `node scripts/seed-vault-milestones.mjs` — milestone bands seeded in the database
- [ ] Child account registered, year group selected (Year 3 or Year 7)
- [ ] Parent account registered
- [ ] Parent and child accounts linked (parent enters child's email on the parent dashboard)

**Fast-path milestone grant (if the child hasn't studied enough yet):**

Run this SQL in the Supabase dashboard to give the child a Bronze milestone and one reward for testing:

```sql
-- Replace <child-profile-id> with the child's profile ID from the profiles table
UPDATE child_vault_status
SET credit_balance = 1, current_band = 'bronze'
WHERE profile_id = '<child-profile-id>';

INSERT INTO vault_milestone_events (profile_id, band, credits_awarded)
VALUES ('<child-profile-id>', 'bronze', 1)
ON CONFLICT DO NOTHING;
```

---

## Section B — Family walkthrough (non-technical, ~20 min)

You need: one person on the **child's account** (phone or tablet), one person on the **parent's account** (different device or browser).

### Part 1 — Child view: checking progress

1. On the **child device**, open the app and log in as the child.
2. Tap **Reward Vault** in the bottom menu.
3. **Check:** the page loads and shows the child's milestone band (Bronze, Silver, etc.) or "No milestone yet".
4. If the band shows "No milestone yet", the developer pre-flight fast-path grant above may be needed.
5. **Check:** below the milestone badge, there are three stats — XP, topics done, badges.
6. **Check:** nowhere on the page do the words "wallet", "spend", "price", "cost", or "payment" appear.

### Part 2 — Child sends a reward request

7. If a reward is available, a green **"🎁 Reward earned"** badge and a blue **"Ask for a reward"** button will be visible.
8. Tap **"🎁 Ask for a reward"**.
9. **Check:** a sheet slides up showing "What would you like?" and any family reward ideas set by the parent.
10. Tap one of the suggestion chips, or type a short message (up to 120 characters).
11. Tap **Send Request**.
12. **Check:** a success message appears — "🎉 Request sent! Your parent will be notified."
13. The button disappears and a status card saying **"Waiting for parent"** appears.

**Duplicate-request check:**
14. Try tapping "Ask for a reward" again. It should not be visible — the pending status card replaces it. If it is visible, tapping should show an error, not create a second request.

### Part 3 — Parent responds

15. On the **parent device**, open the app and log in as the parent.
16. Go to **Parent dashboard**.
17. **Check:** a "🎁 Reward Vault" section appears with the child's name and a **"Respond →"** link.
18. Tap **Respond →**.
19. **Check:** the child's Reward Vault page loads, showing a "Reward Request" card with the child's milestone band and their message.
20. **Check:** four buttons are visible: **Approve**, **Save for later**, **Suggest different**, **Decline**.
21. **Check:** the page has a "How rewards work" section explaining the four steps.

**Try: Save for later**
22. Tap **"⏱ Save for later"**.
23. The status badge on the card changes to "deferred".
24. On the **child device**, reload the Reward Vault page. **Check:** status shows "Saved for later" and the description reads "Your parent has seen your request and will get back to you soon."

**Try: Suggest something different (counter-offer)**
25. Back on the **parent device**, the request still shows (deferred is still active). Tap **"💬 Suggest different"**.
26. Type a suggestion, e.g. "Trip to the park". Tap **Send Suggestion**.
27. On the **child device**, reload. **Check:** status shows "Parent has a suggestion" and the suggestion text is displayed.
28. **Check:** two buttons appear — **"Accept ✓"** and **"No thanks"**.

**Dismiss the counter-offer (credit refund check):**
29. Tap **"No thanks"** on the child device.
30. **Check:** the pending card disappears. The **"Ask for a reward"** button reappears — confirming the reward was returned to the child.

### Part 4 — Full approve and mark done

31. Child taps **"Ask for a reward"** and sends a new request (short message or suggestion).
32. On the **parent device**, tap **"✓ Approve"**.
33. Enter a reward label — e.g. "Movie night at home".
34. Optionally add a short note to the child.
35. Tap **Confirm Approve**.
36. **Check:** the page refreshes. In the **History** section, the request appears with the label **"Approved — to give"** and the note "Once you've given this reward, tap the button below."
37. A **"✓ Mark as done"** button is visible below.

**Give the reward in real life.**

38. Come back to the parent vault page. Tap **"✓ Mark as done"**.
39. **Check:** a prompt appears: "Mark as given? Yes, done / Not yet".
40. Tap **"Yes, done"**.
41. **Check:** the history item now shows **"Done ✓"**. The "Mark as done" button is gone.
42. On the **child device**, reload the Reward Vault. **Check:** the pending card is gone. The "Ask for a reward" button is not visible (credit used).

### Part 5 — Decline (credit refund check)

43. Child sends another reward request.
44. Parent taps **"✗ Decline"**.
45. Optionally enter a note (up to 280 characters). Test that typing more than 280 characters is blocked.
46. Tap **Confirm Decline**.
47. On the **child device**, reload. **Check:** the pending card is gone. The **"Ask for a reward"** button reappears — credit returned.
48. History on the parent side shows **"Declined"** for this request.

### Part 6 — Edit family reward ideas

49. On the **parent vault page**, locate **"Family reward ideas"**.
50. Tap **"Edit ideas"**.
51. **Check:** an edit form appears inline. Current ideas are listed with "Remove" links.
52. Remove one idea. Add a new one (e.g. "Ice cream trip"). Tap **Add**, then **Save**.
53. **Check:** the list updates immediately.
54. On the **child device**, open the reward request modal. **Check:** the new idea appears as a suggestion chip.

---

## Pass criteria

All 54 steps complete without errors. Key checks:

| Check | Expected |
|---|---|
| Credit balance goes negative | ✗ Must not happen |
| Two pending requests at once | ✗ Must not happen |
| Declined request — credit restored | ✓ Button reappears |
| Counter-offer dismissed — credit restored | ✓ Button reappears |
| Approved — "Mark as done" visible | ✓ In history |
| Fulfilled — "Done ✓" shown, button gone | ✓ |
| "wallet", "spend", "price", "cost", "payment" in child UI | ✗ Must not appear |
| Note longer than 280 characters | ✗ Input capped |

**GO** — all pass criteria met. Hand to the family.  
**HOLD** — note the step number and what you saw vs. what was expected. Fix before handing over.

---

*Stage 1.2 — Pilot family walkthrough. Not for public distribution.*
