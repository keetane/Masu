export type Language = "ja" | "en";
export const languageKey = "masu:v1:language";
export const isLanguage = (value: unknown): value is Language =>
  value === "ja" || value === "en";
export function readLanguage(): Language {
  try {
    const value = localStorage.getItem(languageKey);
    return isLanguage(value) ? value : "ja";
  } catch {
    return "ja";
  }
}
const english: Record<string, string> = {
  言語: "Language",
  ホーム: "Home",
  履歴: "History",
  設定: "Settings",
  足し算: "Addition",
  引き算: "Subtraction",
  かけ算: "Multiplication",
  わり算: "Division",
  やさしい: "Easy",
  ふつう: "Standard",
  むずかしい: "Hard",
  筆算の練習帳: "Written arithmetic practice",
  練習帳: "Practice",
  今日の筆算: "One digit at a time",
  "。": ".",
  "マスをたどって、一桁ずつ解いてみよう。":
    "Follow each step and solve one digit at a time.",
  練習する計算: "Choose an operation",
  難しさ: "Difficulty",
  問題数: "Questions",
  くわしく設定: "More options",
  "1つ目の数の整数桁": "First number: integer digits",
  "2つ目の数の整数桁": "Second number: integer digits",
  "1つ目の数の小数桁": "First number: decimal places",
  "2つ目の数の小数桁": "Second number: decimal places",
  足す数の個数: "Number of addends",
  余り: "Remainder",
  混在: "Mixed",
  あり: "With remainder",
  なし: "No remainder",
  練習をはじめる: "Start practice",
  "途中の練習を新しい問題に替えますか？":
    "Replace your unfinished practice with new questions?",
  新しく始める: "Start new practice",
  キャンセル: "Cancel",
  "小数点を移動すると、筆算へ進みます":
    "Move the decimal points to begin the calculation",
  前のマス: "Previous",
  次のマス: "Next",
  ヒント: "Hint",
  答えを見る: "Show answer",
  消す: "Erase",
  確認: "Check",
  結果を見る: "See results",
  次の問題へ: "Next question",
  このマスに数字を入れよう: "Enter a digit here",
  "正解です！": "Correct!",
  印のついたマスを見直そう: "Check the highlighted digits",
  練習の履歴: "Practice history",
  "練習を最後まで解くと、ここに結果が残ります。":
    "Finish a practice session to see your results here.",
  "進行中の練習があります。ホームから再開できます。":
    "You have unfinished practice. Resume it from Home.",
  "入力後、次のマスへ移動する":
    "Move to the next position after entering a digit",
  画面の動きを減らす: "Reduce motion",
  保存したデータ: "Saved data",
  "このブラウザの設定、途中の練習、履歴を削除できます。":
    "Delete the settings, unfinished practice and history saved in this browser.",
  データを削除: "Delete data",
  "削除すると元に戻せません。": "This cannot be undone.",
  すべて削除する: "Delete all data",
  削除しました: "Data deleted",
  "使い方・運営": "Help & support",
  プライバシー: "Privacy",
  利用規約: "Terms",
  ライセンス: "Licenses",
  練習の結果: "Practice results",
  もう一度: "Try again",
  まちがいを練習: "Retry mistakes",
  答え合わせ: "Review answers",
  問題: "Question",
  補助あり: "Answer revealed",
  自分の筆算: "Your work",
  正しい筆算: "Correct work",
  "この環境では保存できません。この画面で練習を続けられます。":
    "Saving is unavailable. You can keep practicing on this page.",
  "途中の記録を読み込めませんでした。新しい練習を始められます。":
    "Your unfinished practice could not be loaded. You can start a new session.",
  "保存領域を読み込めません。練習はこの画面で続けられます。":
    "Saved data is unavailable. You can keep practicing on this page.",
  "桁数を見直してください。各数は合計5桁までです。":
    "Check the digit settings. Each number can have up to five digits in total.",
  "この桁数と条件では出題できません。桁数か余りの設定を変えてください。":
    "No questions fit these settings. Change the digits or remainder option.",
  問題の数値が範囲外です: "The numbers are outside the supported range.",
  出題できない式です: "This expression is not supported.",
  有限小数で表せる範囲を超えました:
    "The quotient exceeds the supported terminating-decimal range.",
  小数点: "Decimal point",
  問題の数字: "Given digit",
  次の位への繰り上がり: "Carry to the next place",
  借りた1: "Borrowed 1",
  左の位から10を借りよう: "Borrow ten from the place to the left.",
  借り元の数字: "Digit after borrowing",
  貸した位を1減らそう: "Decrease the digit you borrowed from by one.",
  部分積: "Partial product",
  "0をかけるといくつになるかな": "What happens when you multiply by zero?",
  積の左端: "Leftmost product digit",
  積の繰り上がり: "Multiplication carry",
  積の数字: "Product digit",
  演算記号: "Operation sign",
  部分積を足す: "Add the partial products",
  小数の位取り: "Leading decimal zero",
  小数点に必要な0を書こう: "Enter the zero needed before the decimal digits.",
  積の小数点: "Product decimal point",
  かける数とかけられる数の小数の桁数を合わせよう:
    "Count the decimal places in both factors together.",
  整数にした割る数: "Divisor as a whole number",
  同じ倍率にした割られる数: "Dividend scaled by the same factor",
  割る数と同じだけ小数点を動かそう:
    "Move this decimal point as many places as the divisor's.",
  割られる数: "Dividend",
  割り算の括弧: "Long division bracket",
  補った0: "Added zero",
  補った小数点: "Added decimal point",
  商の小数点: "Quotient decimal point",
  割られる数の小数点にそろえよう: "Align it with the dividend's decimal point.",
  次の数字を下ろす: "Bring down the next digit",
  割られる数の次の桁を見よう: "Look at the next digit of the dividend.",
  商を立てる: "Enter a quotient digit",
  途中の引き算: "Subtract the product",
  最後の余り: "Final remainder",
  最後の差を書こう: "Enter the final difference.",
  未入力: "Empty",
  見直し: "Check this digit",
  除数: "Divisor",
  被除数: "Dividend",
  除数の小数点: "Divisor decimal point",
  被除数の小数点: "Dividend decimal point",
  小数点の移動: "Move decimal points",
  右へ1桁動かす: "Move right one place",
  "移動をキャンセルしました。": "Move cancelled.",
  小数点の移動をやり直す: "Reset decimal points",
};
const places: Record<string, string> = {
  一: "ones",
  十: "tens",
  百: "hundreds",
  千: "thousands",
  一万: "ten-thousands",
  十万: "hundred-thousands",
  百万: "millions",
  千万: "ten-millions",
  "100000000": "hundred-millions",
  "1000000000": "billions",
};
export function translate(text: string, language: Language): string {
  if (language === "ja" || !text) return text;
  if (english[text]) return english[text];
  if (text.startsWith("最後の足し算・"))
    return (
      "Final addition · " +
      translate(text.slice("最後の足し算・".length), language)
    );
  let m: RegExpMatchArray | null;
  if ((m = text.match(/^(.+)の位の(答え|差)$/)))
    return (
      (m[2] === "差" ? "Difference" : "Answer") +
      " in the " +
      (places[m[1]] ?? m[1]) +
      " place"
    );
  if ((m = text.match(/^(.+) を計算しよう$/))) return "Calculate " + m[1] + ".";
  if ((m = text.match(/^(\d+) から (\d+) を引こう$/)))
    return "Subtract " + m[2] + " from " + m[1] + ".";
  if ((m = text.match(/^小数点を右に(\d+)桁移そう$/)))
    return "Move the decimal point " + m[1] + " places to the right.";
  if ((m = text.match(/^(\d+) に (\d+) がいくつ入るかな$/)))
    return "How many times does " + m[2] + " fit into " + m[1] + "?";
  if ((m = text.match(/^(\d+)問$/)))
    return m[1] + (m[1] === "1" ? " question" : " questions");
  if ((m = text.match(/^前回の続きから　(.+) 問$/))) return "Resume · " + m[1];
  if ((m = text.match(/^(.+) 問$/)))
    return m[1] + (/\/\s*1$/.test(m[1]) ? " question" : " questions");
  if ((m = text.match(/^(.+) マス$/)))
    return m[1] + (/\/\s*1$/.test(m[1]) ? " step" : " steps");
  if ((m = text.match(/^(.+) 操作$/))) return m[1] + " moves";
  if ((m = text.match(/^ナビ (ON|OFF)$/))) return "Auto " + m[1];
  if ((m = text.match(/^初回正解 (\d+)問　→$/)))
    return m[1] + " correct first try →";
  if ((m = text.match(/^初回正答率 (\d+)%　ヒント (\d+)回$/)))
    return "First-try accuracy " + m[1] + "% · Hints " + m[2];
  if ((m = text.match(/^(.+)の(練習|記録)$/)))
    return (
      translate(m[1], language) + (m[2] === "練習" ? " practice" : " results")
    );
  if ((m = text.match(/^筆算の例 (.+)$/)))
    return "Written calculation example " + m[1];
  if ((m = text.match(/^　このマスは「(.+)」です。$/)))
    return " This position is “" + m[1] + "”.";
  if ((m = text.match(/^ 余り (\d+)$/))) return " remainder " + m[1];
  if ((m = text.match(/^右へ(\d+)桁、同じ数だけ動かそう。$/)))
    return "Move exactly " + m[1] + " places to the right.";
  if ((m = text.match(/^右へ(\d+)桁$/))) return m[1] + " places to the right";
  if (
    (m = text.match(
      /^(まず、割る数|次に、割られる数)の小数点を右へ(\d+)桁ドラッグ$/,
    ))
  )
    return (
      (m[1] === "まず、割る数"
        ? "First, drag the divisor's"
        : "Next, drag the dividend's") +
      " decimal point " +
      m[2] +
      " places to the right"
    );
  if ((m = text.match(/^両方の小数点を右へ(\d+)桁動かす$/)))
    return "Both decimal points moved " + m[1] + " places to the right";
  if ((m = text.match(/^(.+) にして計算$/))) return "Now calculate " + m[1];
  return text;
}
