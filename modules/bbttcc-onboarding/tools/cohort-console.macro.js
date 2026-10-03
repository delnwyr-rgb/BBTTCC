/* Hotbar macro — open the GM Cohort Console (group induction, Phase 1).
 * Roster + Start / Pause / Release barrier / Skip / Kick / Abort for a class
 * running the tutorial together. Also under Configure Settings → Module
 * Settings → "Open Cohort Console". (Paste into a script macro named "⚑ Cohort Console".)
 */
const cohort = game.bbttcc?.onboarding?.cohort;
if (!cohort) ui.notifications.warn("Group induction not loaded — is bbttcc-onboarding enabled (and the world restarted since the update)?");
else if (!game.user.isGM) ui.notifications.warn("The Cohort Console is GM-only.");
else cohort.console();
