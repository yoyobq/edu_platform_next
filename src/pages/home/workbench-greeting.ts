export type WorkbenchTimeGreeting = {
  formalMessage: string | null;
  label: '凌晨' | '早上' | '中午' | '下午' | '晚上';
};

function getDayMinutes(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function resolveWorkbenchTimeGreeting(date = new Date()): WorkbenchTimeGreeting {
  const minutes = getDayMinutes(date);

  if (minutes >= 23 * 60 || minutes < 6 * 60) {
    return {
      formalMessage: '夜深了，请休息吧',
      label: '凌晨',
    };
  }

  if (minutes < 11 * 60) {
    return {
      formalMessage: null,
      label: '早上',
    };
  }

  if (minutes < 13 * 60 + 30) {
    return {
      formalMessage: null,
      label: '中午',
    };
  }

  if (minutes < 17 * 60 + 30) {
    return {
      formalMessage: null,
      label: '下午',
    };
  }

  return {
    formalMessage: null,
    label: '晚上',
  };
}

export function resolveNicknameWorkbenchGreeting(date = new Date()) {
  const minutes = getDayMinutes(date);

  if (minutes >= 23 * 60 || minutes < 7 * 60) {
    return '这就对了嘛，起来 High';
  }

  if (minutes < 11 * 60) {
    return '怎么才来，快开工';
  }

  if (minutes < 13 * 60 + 30) {
    return '别睡了，查漏补缺';
  }

  if (minutes >= 17 * 60) {
    return '白天又偷懒，来不及了吧';
  }

  return '怎么没精打采的，干活了';
}
