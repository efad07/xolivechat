export let callFrame: any = null;

export function startCall(roomUrl: string) {
  console.log("Video system removed. Placeholder active.");
  // It's requested to alert this to the user to maintain the neutral interface placeholder.
  alert("Video system is currently disabled.");
}

export async function createRoom() {
  console.log("Video system removed. Placeholder active. Generating fake URL.");
  return "placeholder-room-url-" + Date.now();
}
