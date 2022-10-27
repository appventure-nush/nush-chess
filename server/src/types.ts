export type Role = "w" | "b";
export type Group = 1 | 2;
export type GameStatus = "waiting" | "playing";

export interface ServerToClientEvents {
  error: (error: string) => void;
  state: (data: { fen: string, nextVoteTime: number }) => void;
  votes: (votes: [string, number][]) => void;
  winner: (winnerGroup: number) => void;
  votingUpdate: (data: { numVotes: number, players: number }) => void;
  gameInfo: (data: {
    gameStatus: GameStatus, role: Role | false, group: Group, playersPerGroup: number[], winsPerGroup: number[]
  }) => void;
}

export interface ClientToServerEvents {
  vote: (move: string) => void;
  auth: (token: string) => void;
}

export interface InterServerEvents {
}

export interface SocketData {
  email: string,
  username: string,
  group: Group
}