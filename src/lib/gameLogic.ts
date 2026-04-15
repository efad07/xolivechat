export function getWinLength(size: number) {
  if (size === 3) return 3;
  if (size === 6) return 4;
  return 5;
}

export function checkWin(board: string[], size: number, winLength: number) {
  // Check rows
  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size - winLength; c++) {
      const startIdx = r * size + c;
      const player = board[startIdx];
      if (!player) continue;
      let win = true;
      const cells = [startIdx];
      for (let i = 1; i < winLength; i++) {
        if (board[startIdx + i] !== player) {
          win = false;
          break;
        }
        cells.push(startIdx + i);
      }
      if (win) return { player, cells };
    }
  }

  // Check cols
  for (let c = 0; c < size; c++) {
    for (let r = 0; r <= size - winLength; r++) {
      const startIdx = r * size + c;
      const player = board[startIdx];
      if (!player) continue;
      let win = true;
      const cells = [startIdx];
      for (let i = 1; i < winLength; i++) {
        if (board[startIdx + i * size] !== player) {
          win = false;
          break;
        }
        cells.push(startIdx + i * size);
      }
      if (win) return { player, cells };
    }
  }

  // Check diagonals (top-left to bottom-right)
  for (let r = 0; r <= size - winLength; r++) {
    for (let c = 0; c <= size - winLength; c++) {
      const startIdx = r * size + c;
      const player = board[startIdx];
      if (!player) continue;
      let win = true;
      const cells = [startIdx];
      for (let i = 1; i < winLength; i++) {
        if (board[startIdx + i * size + i] !== player) {
          win = false;
          break;
        }
        cells.push(startIdx + i * size + i);
      }
      if (win) return { player, cells };
    }
  }

  // Check diagonals (top-right to bottom-left)
  for (let r = 0; r <= size - winLength; r++) {
    for (let c = winLength - 1; c < size; c++) {
      const startIdx = r * size + c;
      const player = board[startIdx];
      if (!player) continue;
      let win = true;
      const cells = [startIdx];
      for (let i = 1; i < winLength; i++) {
        if (board[startIdx + i * size - i] !== player) {
          win = false;
          break;
        }
        cells.push(startIdx + i * size - i);
      }
      if (win) return { player, cells };
    }
  }

  if (!board.includes('')) {
    return { player: 'Draw', cells: [] };
  }

  return null;
}

export function findBestMove(board: string[], size: number, winLength: number, aiPlayer: string) {
  const humanPlayer = aiPlayer === 'X' ? 'O' : 'X';

  // 1. Try to win
  for (let i = 0; i < board.length; i++) {
    if (board[i] === '') {
      const newBoard = [...board];
      newBoard[i] = aiPlayer;
      if (checkWin(newBoard, size, winLength)?.player === aiPlayer) {
        return i;
      }
    }
  }

  // 2. Try to block
  for (let i = 0; i < board.length; i++) {
    if (board[i] === '') {
      const newBoard = [...board];
      newBoard[i] = humanPlayer;
      if (checkWin(newBoard, size, winLength)?.player === humanPlayer) {
        return i;
      }
    }
  }

  // 3. Try to build a line (heuristic)
  const emptyCells = board.map((c, i) => c === '' ? i : -1).filter(i => i !== -1);
  if (emptyCells.length === 0) return -1;

  // Prefer center
  const center = Math.floor(size / 2) * size + Math.floor(size / 2);
  if (board[center] === '') return center;

  // Pick random
  return emptyCells[Math.floor(Math.random() * emptyCells.length)];
}
