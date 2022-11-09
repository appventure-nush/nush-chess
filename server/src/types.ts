export type Role = "w" | "b";
export type Group = 1 | 2;
export type GameStatus = "waiting" | "playing";
export type WaitingReason = "" | "noPlayers" | "noVotes" | "gameCompleted";

export interface LeaderboardEntry {
  winning_votes: number;
  username: string;
}

export interface ServerToClientEvents {
  error: (error: string) => void;
  state: (data: { fen: string, nextVoteTime: number }) => void;
  votes: (votes: [string, number][]) => void;
  winner: (data: { winnerGroup: number, timeout: boolean }) => void;
  votingUpdate: (data: { numVotes: number, players: number }) => void;
  gameInfo: (data: {
    gameStatus: GameStatus,
    waitingReason: WaitingReason,
    role: Role | false,
    group: Group,
    playersPerGroup: number[],
    winsPerGroup: number[],
    nextGameTime: number,
  }) => void;
}

export interface ClientToServerEvents {
  vote: (move: string) => void;
  auth: (token: string) => void;
  leaderboard: (callback: (data: LeaderboardEntry[]) => void) => void;
}

export interface InterServerEvents {
}

export interface SocketData {
  email: string,
  username: string,
  group: Group,
  hasVoted: boolean,
  numSkippedVotes: number,
}