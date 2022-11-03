import {Group} from "../types";
import connection from "./database";

export async function newGame(whiteTeam: Group){
  const query = `insert into games
                       (white_team, winner)
                   values ($1, $2) RETURNING id`;
  const values = [whiteTeam, -1];
  console.log("Before query", values);
  const result = await connection.query(query, values);
  return result.rows[0].id;
}

export async function completeGame(gameId: number, winner: Group, timeout: boolean){
  const query = `update games
                       set winner = $1,
                           timeout = $2
                       where id = $3`;
  const values = [winner, timeout, gameId];
  await connection.query(query, values);
}

export async function registerVote(gameId: number, playerEmail: string, vote: string){
  const query = `insert into votes
                       (game_id, email, vote)
                   values ($1, $2, $3)`;
  const values = [gameId, playerEmail, vote];
  await connection.query(query, values);
}