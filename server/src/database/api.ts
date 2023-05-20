import {Group, LeaderboardEntry} from "../types";
import connection from "./database";

let leaderboardMaybeUpdated = true;
let _leaderboard: LeaderboardEntry[] | null = null;

export async function registerUser(email: string, name: string, group: Group) {
  if (connection == null) {
    return -1;
  }
  const query = `insert into users
                     (email, username, team)
                 values ($1, $2, $3)
                 on conflict do nothing;`
  const values = [email, name, group];
  await connection.query(query, values);
  return;
}

export async function getUserTeam(email: string): Promise<null | number> {
  if (connection == null) {
    return null;
  }
  const query = `select team from users where email=$1`
  const values = [email];
  const res = await connection.query(query, values);
  if (res.rows.length == 0) {
    return null;
  } else {
    return res.rows[0].team;
  }
}

export async function newGame(whiteTeam: Group) {
  if (connection == null) {
    return -1;
  }
  const query = `insert into games
                     (white_team, winner, timeout)
                 values ($1, -1, false)
                 RETURNING id`;
  const values = [whiteTeam];
  const result = await connection.query(query, values);
  return result.rows[0].id;
}

export async function completeGame(gameId: number, winner: Group, timeout: boolean) {
  if (connection == null) {
    return;
  }
  const query = `update games
                 set winner  = $1,
                     timeout = $2
                 where id = $3`;
  const values = [winner, timeout, gameId];
  await connection.query(query, values);
  leaderboardMaybeUpdated = true;
}

export async function registerVote(gameId: number, votingRound: number, playerEmail: string, vote: string): Promise<boolean> {
  if (connection == null) {
    return true;
  }
  const query = `insert into votes
                     (game_id, voting_round, email, vote, accepted)
                 values ($1, $2, $3, $4, false)`;
  const values = [gameId, votingRound, playerEmail, vote];
  try{
    await connection.query(query, values);
    return true;
  }catch (e) {
    return false;
  }
}

export async function registerVotingResults(gameId: number,
                                            votingRound: number,
                                            move: string,
                                            votesFor: number,
                                            totalVotes: number) {
  if (connection == null) {
    return;
  }
  const query = `insert into game_moves
                     (game_id, voting_round, move, votes_for, total_votes)
                 values ($1, $2, $3, $4, $5)`;
  const values = [gameId, votingRound, move, votesFor, totalVotes];
  await connection.query(query, values);


  const query2 = `update votes
                  set accepted = true
                  where game_id = $1
                    and voting_round = $2
                    and vote = $3`;
  const values2 = [gameId, votingRound, move];
  await connection.query(query2, values2);
}

export async function winStats() {
  if (connection == null) {
    return [0, 0, 0];
  }
  const query = `select count(winner), winner
                 from games
                 where winner != -1
                 group by winner;`
  const result = (await connection.query(query)).rows;
  const out = [0, 0, 0];
  for (const row of result) {
    out[row.winner] = parseInt(row.count);
  }
  return out;
}

export async function leaderboard() {
  if(connection == null){
    return null;
  }
  if (!leaderboardMaybeUpdated && leaderboard != null) {
    return _leaderboard;
  }
  const query = `select count(vote)::int as winning_votes, users.username
                 from votes,
                      users,
                      games
                 where votes.game_id = games.id
                   and users.email = votes.email
                   and votes.accepted = true
                   and users.team = games.winner
                 group by users.username
                 order by winning_votes`
  return (await connection.query(query)).rows;
}
