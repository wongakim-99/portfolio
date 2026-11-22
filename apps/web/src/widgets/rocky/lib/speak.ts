// 화음을 짧게 울림. 브라우저는 사람이 누른 뒤에만 소리를 내게 해서 공을 누를 때만 부름
let context: AudioContext | null = null;

export function speak(chords: number[][]): void {
  try {
    context ??= new AudioContext();
    void context.resume();
    const audio = context;
    const start = audio.currentTime + 0.02;
    chords.forEach((chord, index) => {
      const at = start + index * 0.24;
      chord.forEach((frequency, voice) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.value = frequency;
        // 음마다 조금씩 늦게 시작해서 한 번에 치는 소리보다 말하는 소리처럼 들리게 함
        const begin = at + voice * 0.012;
        gain.gain.setValueAtTime(0, begin);
        gain.gain.linearRampToValueAtTime(0.05, begin + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, begin + 0.2);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(begin);
        oscillator.stop(begin + 0.22);
      });
    });
  } catch {
    // 소리를 못 내는 브라우저면 말풍선만 보임
  }
}
