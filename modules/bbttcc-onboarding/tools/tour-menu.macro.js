/* Hotbar macro — open the Operator's interface-tour picker.
 * Players see player tours; GMs see everything.
 * (Paste into a script macro named "◇ Interface Tours".)
 */
const tours = game.bbttcc?.onboarding?.tours;
if (!tours) ui.notifications.warn("Tours engine not loaded — is bbttcc-onboarding enabled?");
else tours.menu();
