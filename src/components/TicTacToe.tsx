import { useState } from "react";

type Player = "X" | "O" | null;

export default function TicTacToe() {
  const [size, setSize] = useState<3 | 4 | 5>(3);
  const [board, setBoard] = useState<Player[]>(Array(9).fill(null));
  const [isX, setIsX] = useState(true);
  const [vsAI, setVsAI] = useState(false);

  const winPatterns = (n: number) => {
    const patterns = [];

    // rows
    for (let r = 0; r < n; r++) {
      const row = [];
      for (let c = 0; c < n; c++) {
        row.push(r * n + c);
      }
      patterns.push(row);
    }

    // cols
    for (let c = 0; c < n; c++) {
      const col = [];
      for (let r = 0; r < n; r++) {
        col.push(r * n + c);
      }
      patterns.push(col);
    }

    return patterns;
  };

  const checkWinner = (b: Player[]) => {
    const patterns = winPatterns(size);

    for (let p of patterns) {
      const [a] = p;
      if (p.every(i => b[i] && b[i] === b[a])) {
        return b[a];
      }
    }
    return null;
  };

  const handleClick = (i: number) => {
    if (board[i]) return;

    const newBoard = [...board];
    newBoard[i] = isX ? "X" : "O";
    setBoard(newBoard);
    setIsX(!isX);

    if (vsAI && !checkWinner(newBoard)) {
      setTimeout(() => aiMove(newBoard), 300);
    }
  };

  const aiMove = (b: Player[]) => {
    const empty = b
      .map((v, i) => (v === null ? i : null))
      .filter(v => v !== null) as number[];

    if (empty.length === 0) return;

    const move = empty[Math.floor(Math.random() * empty.length)];
    b[move] = "O";
    setBoard([...b]);
    setIsX(true);
  };

  const reset = () => {
    setBoard(Array(size * size).fill(null));
    setIsX(true);
  };

  const winner = checkWinner(board);

  return (
    <div className="text-white flex flex-col items-center gap-3">
      {/* MODE SELECT */}
      <div className="flex gap-2">
        <button onClick={() => setSize(3)}>3x3</button>
        <button onClick={() => setSize(4)}>4x4</button>
        <button onClick={() => setSize(5)}>5x5</button>
      </div>

      {/* AI MODE */}
      <button
        onClick={() => setVsAI(!vsAI)}
        className="bg-purple-600 px-3 py-1 rounded"
      >
        {vsAI ? "Play vs Friend" : "Play vs AI"}
      </button>

      {/* BOARD */}
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${size}, 60px)`
        }}
      >
        {board.map((cell, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            className="w-14 h-14 bg-gray-800 text-xl font-bold rounded"
          >
            {cell}
          </button>
        ))}
      </div>

      {/* STATUS */}
      <div>
        {winner ? (
          <p className="text-green-400">Winner: {winner}</p>
        ) : (
          <p>Turn: {isX ? "X" : "O"}</p>
        )}
      </div>

      <button onClick={reset} className="bg-red-600 px-3 py-1 rounded">
        Reset
      </button>
    </div>
  );
}
