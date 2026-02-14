export type SurpriseMode = 'ROMANTIC' | 'ADMIRER' | 'FRIENDLY' | 'CLASSIC';

export interface ThemeConfig {
  colors: string[];
  particleColor: string;
  icon: string;
  font: string;
}

export const THEMES: Record<SurpriseMode, ThemeConfig> = {
  ROMANTIC: {
    colors: ['#1a012a', '#4a044e', '#831843', '#7c2d12'],
    particleColor: 'rgba(255, 182, 193, 0.5)',
    icon: '??',
    font: 'font-romantic',
  },
  ADMIRER: {
    colors: ['#0f172a', '#1e1b4b', '#312e81', '#1e1b4b'],
    particleColor: 'rgba(129, 140, 248, 0.4)',
    icon: '?',
    font: 'font-romantic',
  },
  FRIENDLY: {
    colors: ['#451a03', '#78350f', '#92400e', '#451a03'],
    particleColor: 'rgba(253, 224, 71, 0.4)',
    icon: '??',
    font: 'font-sans',
  },
  CLASSIC: {
    colors: ['#042f2e', '#134e4a', '#0f766e', '#042f2e'],
    particleColor: 'rgba(153, 246, 228, 0.3)',
    icon: '??',
    font: 'font-sans',
  },
};

export const MUSIC_TRACKS = [
  { id: 'none', name: 'No Music', url: '' },
  { id: 'snooze', name: 'SZA - Snooze', url: 'https://www.youtube.com/watch?v=wb5UN2gkMzg' },
  { id: 'romantic', name: 'Soft Piano', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 'ambient', name: 'Dreamy Space', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
];

export interface ModeTextDefaults {
  label: string;
  mode: SurpriseMode;
  introTitle: string;
  musicTrack: string;
  typewriterMessages: Array<{ text: string; pause: number; isSpecial?: boolean }>;
  finalQuestion: string;
  successMessage: string;
  hiddenMessage: string;
  admirerPhone?: string;
  admirerAcceptTemplate?: string;
  admirerRejectMessage?: string;
}

export const MODE_TEXT_DEFAULTS: Record<SurpriseMode, ModeTextDefaults> = {
  ADMIRER: {
    label: 'Secret Admirer',
    mode: 'ADMIRER',
    introTitle: 'There is someone who admires you deeply...',
    musicTrack: 'ambient',
    typewriterMessages: [
      { text: 'You may not know who I am yet...', pause: 1200 },
      { text: 'But your smile has been my quiet favorite moment.', pause: 1400 },
      { text: 'So I left these little clues for you to uncover.', pause: 1400 },
      { text: 'From your secret admirer, ', isSpecial: true, pause: 1800 },
    ],
    finalQuestion: 'Would you like to know me better?',
    successMessage: 'Your answer just made my day brighter ?',
    hiddenMessage: 'Psst... this was sent with a little courage.',
    admirerPhone: '',
    admirerAcceptTemplate: 'Hi... I got your surprise link. I would like to know you better.',
    admirerRejectMessage: 'It hurts, but thank you for being honest. ??',
  },
  FRIENDLY: {
    label: 'Birthday / Family',
    mode: 'FRIENDLY',
    introTitle: 'A birthday surprise made just for you!',
    musicTrack: 'romantic',
    typewriterMessages: [
      { text: 'Today is all about you...', pause: 1000 },
      { text: 'Your laughter, your kindness, your beautiful energy.', pause: 1400 },
      { text: 'I collected these moments to celebrate your day.', pause: 1400 },
      { text: 'Happy Birthday, ', isSpecial: true, pause: 1800 },
    ],
    finalQuestion: 'Ready for an unforgettable year ahead?',
    successMessage: 'Wishing you joy, love, and endless blessings ??',
    hiddenMessage: 'You deserve every beautiful thing coming your way.',
  },
  ROMANTIC: {
    label: 'Casual Valentine',
    mode: 'ROMANTIC',
    introTitle: 'A simple little surprise for someone special...',
    musicTrack: 'snooze',
    typewriterMessages: [
      { text: 'No big speech, just honest feelings...', pause: 1100 },
      { text: 'You have a way of making ordinary days feel special.', pause: 1400 },
      { text: 'So I made this to bring you a smile.', pause: 1400 },
      { text: 'Happy Valentine\'s, ', isSpecial: true, pause: 1800 },
    ],
    finalQuestion: 'Will you be my Valentine this year?',
    successMessage: 'That smile from you is everything ??',
    hiddenMessage: 'I hoped this would make your day a little sweeter.',
  },
  CLASSIC: {
    label: 'Friendly Note',
    mode: 'CLASSIC',
    introTitle: 'A heartfelt note just for you...',
    musicTrack: 'ambient',
    typewriterMessages: [
      { text: 'Some people make life easier just by being in it.', pause: 1200 },
      { text: 'You are one of those people for me.', pause: 1400 },
      { text: 'These moments are a thank-you in visual form.', pause: 1400 },
      { text: 'With appreciation, ', isSpecial: true, pause: 1700 },
    ],
    finalQuestion: 'Should we make more good memories together?',
    successMessage: 'Grateful for you, always.',
    hiddenMessage: 'Real friendship is rare. You are one of the rare ones.',
  },
};

export const DEFAULT_PERSONALIZATION = {
  LOVED_ONE_NAME: 'Valentine',
  MODE: 'ROMANTIC' as SurpriseMode,
  INTRO_TITLE: 'This page was made for someone special...',
  MUSIC_TRACK: 'snooze',
  TYPEWRITER_MESSAGES: [
    { text: 'From the moment I met you...', pause: 1000 },
    { text: 'You changed something in me, something I never knew existed.', pause: 1500 },
    { text: 'Every second with you feels like a beautiful dream.', pause: 1500 },
    { text: "Happy Valentine's Day, ", isSpecial: true, pause: 2000 },
  ],
  MEMORIES: [],
  UPLOADED_IMAGES: [] as string[],
  FINAL_QUESTION: 'Will you be my Valentine?',
  SUCCESS_MESSAGE: 'You just made me the happiest person alive ??',
  HIDDEN_MESSAGE: 'You found the hidden message. I love you even more.',
  ADMIRER_PHONE: '',
  ADMIRER_ACCEPT_TEMPLATE: 'Hi... I got your surprise link. I would like to know you better.',
  ADMIRER_REJECT_MESSAGE: 'It hurts, but thank you for being honest. ??',
};
