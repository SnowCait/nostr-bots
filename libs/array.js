export function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1)); // 0 から i のランダムなインデックス
    [array[i], array[j]] = [array[j], array[i]]; // 要素を入れ替えます
  }
}
