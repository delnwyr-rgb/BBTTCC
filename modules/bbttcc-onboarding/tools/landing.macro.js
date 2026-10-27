/* Hotbar macro — open the player landing page on this seat (GM preview / any seat).
 * (Paste into a script macro named "◇ Landing Page".)
 *   game.bbttcc.onboarding.landing.open()            the landing page
 *   game.bbttcc.onboarding.landing.film()            studio ident → opening film → landing
 *   game.bbttcc.onboarding.landing.training()        straight to the Solo / Cohort pick
 *   game.bbttcc.onboarding.landing.forgetOpening(u)  that user sees the film again next login
 */
const landing = game.bbttcc?.onboarding?.landing;
if (!landing) ui.notifications.warn("Landing page not loaded — is bbttcc-onboarding enabled?");
else landing.open();
