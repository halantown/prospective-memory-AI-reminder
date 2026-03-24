/** PM Interaction — scene-embedded target selection and action execution.
 *
 * No modal overlays. No "Act Now" button. PM execution is entirely
 * integrated into the room scene — participant navigates to the target
 * room, finds items in the scene, clicks to select, confirms action.
 */

import { useGameStore } from '../../stores/gameStore'

export default function PMInteraction() {
  // This component is now a no-op shell.
  // All PM interaction is handled by PMTargetItems rendered inside each room.
  // Kept as a mount point for any future global PM overlay needs (e.g., subtle feedback).
  return null
}
