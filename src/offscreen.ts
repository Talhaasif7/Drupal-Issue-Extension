chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(message: any) {
  if (message.target !== 'offscreen') return;

  if (message.type === 'play_audio') {
    playNotificationSound();
  }
}

function playNotificationSound() {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;
  
  const ctx = new AudioContext();
  
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gainNode = ctx.createGain();

  // Create a pleasant, high-tech 'chime' chord
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5

  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1318.51, ctx.currentTime); // E6
  
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);

  osc1.connect(gainNode);
  osc2.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc1.start(ctx.currentTime);
  osc2.start(ctx.currentTime);
  
  osc1.stop(ctx.currentTime + 1.0);
  osc2.stop(ctx.currentTime + 1.0);
}
