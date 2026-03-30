export const Translations = {
  en: {
    'Enter names below': 'Enter names below',
    Shuffle: 'Shuffle',
    Start: 'Start',
    Map: 'Map',
    Recording: 'Recording',
    'The winner is': 'The winner is',
    'Using skills': 'Using skills',
    'Buy me a coffee': 'Buy me a coffee',
    First: 'First',
    Last: 'Last',
    'Wheel of fortune': 'Wheel of fortune',
    BubblePop: 'BubblePop',
    'Pot of greed': 'Pot of greed',
    'Yoru ni Kakeru': 'Into The Night (by item4)',
    'Shake!': 'Shake!',
    'Input names separated by commas or line feed here': 'Input names separated by commas or line feed here',
    'This program is freeware and may be used freely anywhere, including in broadcasts and videos.':
      'This program is freeware and may be used freely anywhere, including in broadcasts and videos.',
    Close: 'Close',
    'The result has been copied': 'The result has been copied',
    '2025 Recap': '2025 Recap',
    'PRANK MODE': 'PRANK MODE',
    'This site is manipulated on purpose.': 'This site is manipulated on purpose.',
    'The first entrant can never win and will be drained mid-run.':
      'The first entrant can never win and will be drained mid-run.',
    'First entrant excluded:': 'First entrant excluded:',
  },
  ko: {
    'Enter names below': '이름들을 입력하세요',
    Shuffle: '섞기',
    Start: '시작',
    Map: '맵',
    Recording: '녹화',
    'The winner is': '당첨 순위',
    'Using skills': '스킬 활성화',
    'Buy me a coffee': '개발자에게 커피 사주기',
    First: '첫번째',
    Last: '마지막',
    'Wheel of fortune': '운명의 수레바퀴',
    BubblePop: '버블팝',
    'Pot of greed': '욕망의 항아리',
    'Yoru ni Kakeru': '밤을 달리다 (by item4)',
    'Shake!': '흔들기!',
    'Input names separated by commas or line feed here': '이름들을 쉼표나 엔터로 구분해서 넣어주세요',
    'This program is freeware and may be used freely anywhere, including in broadcasts and videos.':
      '이 프로그램은 프리웨어이며 방송이나 영상 등을 포함한 어떤 용도로든 자유롭게 사용하는 것이 허용되어있습니다.',
    Close: '닫기',
    'The result has been copied': '결과가 복사되었습니다',
    '2025 Recap': '2025 결산',
    'PRANK MODE': '조작 모드',
    'This site is manipulated on purpose.': '이 사이트는 장난용으로 의도적으로 조작됩니다.',
    'The first entrant can never win and will be drained mid-run.':
      '첫 번째 입력 참가자는 절대 우승할 수 없고, 게임 도중 자연스럽게 배출됩니다.',
    'First entrant excluded:': '우승 제외 대상:',
  },
} as const;

export type TranslatedLanguages = keyof typeof Translations;

export type TranslationKeys = keyof (typeof Translations)[TranslatedLanguages];
