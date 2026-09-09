import { NotificationType } from './types';

const audioContext = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

const soundFrequencies: Record<NotificationType, { notes: number[]; durations: number[] }> = {
  task_assigned: {
    notes: [523.25, 659.25],
    durations: [0.1, 0.15]
  },
  task_reassigned: {
    notes: [440, 554.37],
    durations: [0.1, 0.15]
  },
  task_updated: {
    notes: [493.88],
    durations: [0.12]
  },
  task_comment: {
    notes: [587.33, 783.99],
    durations: [0.08, 0.12]
  },
  task_due_soon: {
    notes: [349.23, 392, 440],
    durations: [0.12, 0.12, 0.18]
  },
  task_overdue: {
    notes: [293.66, 277.18, 261.63],
    durations: [0.15, 0.15, 0.2]
  },
  task_completed: {
    notes: [523.25, 659.25, 783.99, 1046.50],
    durations: [0.08, 0.08, 0.08, 0.2]
  },
  task_status_changed: {
    notes: [392, 523.25],
    durations: [0.1, 0.15]
  },
  task_priority_changed: {
    notes: [349.23, 523.25],
    durations: [0.1, 0.15]
  },
  mention: {
    notes: [880, 1046.50],
    durations: [0.08, 0.12]
  }
};

export async function playNotificationSound(notificationType: NotificationType, volume: number = 0.3): Promise<void> {
  if (!audioContext) return;

  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  const soundConfig = soundFrequencies[notificationType];
  if (!soundConfig) return;

  const { notes, durations } = soundConfig;
  let currentTime = audioContext.currentTime;

  notes.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    const duration = durations[index];
    const fadeTime = duration * 0.1;

    gainNode.gain.setValueAtTime(0, currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, currentTime + fadeTime);
    gainNode.gain.setValueAtTime(volume, currentTime + duration - fadeTime);
    gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);

    oscillator.start(currentTime);
    oscillator.stop(currentTime + duration);

    currentTime += duration + 0.02;
  });
}

export function getSoundDescription(notificationType: NotificationType): string {
  const descriptions: Record<NotificationType, string> = {
    task_assigned: 'Bright ascending chime',
    task_reassigned: 'Gentle ascending tone',
    task_updated: 'Single soft ping',
    task_comment: 'Quick double chirp',
    task_due_soon: 'Three warning tones',
    task_overdue: 'Descending alert',
    task_completed: 'Celebratory ascending chime',
    task_status_changed: 'Two-tone notification',
    task_priority_changed: 'Rising alert tone',
    mention: 'High double ping'
  };
  
  return descriptions[notificationType] || 'Standard notification';
}
