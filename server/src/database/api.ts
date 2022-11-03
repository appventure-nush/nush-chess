import {Group} from "../types";
import connection from "./database";

export async function newGame(whiteTeam: Group) {
  const query = `insert into games
                     (white_team, winner, timeout)
                 values ($1, -1, false)
                 RETURNING id`;
  const values = [whiteTeam];
  const result = await connection.query(query, values);
  return result.rows[0].id;
}

export async function completeGame(gameId: number, winner: Group, timeout: boolean) {
  const query = `update games
                 set winner  = $1,
                     timeout = $2
                 where id = $3`;
  const values = [winner, timeout, gameId];
  await connection.query(query, values);
}

export async function registerVote(gameId: number, votingRound: number, playerEmail: string, vote: string) {
  const query = `insert into votes
                     (game_id, voting_round, email, vote)
                 values ($1, $2, $3, $4)`;
  const values = [gameId, votingRound, playerEmail, vote];
  await connection.query(query, values);
}

export async function registerVotingResults(gameId: number,
                                            votingRound: number,
                                            move: string,
                                            votesFor: number,
                                            totalVotes: number) {
  const query = `insert into game_moves
                     (game_id, voting_round, move, votes_for, total_votes)
                 values ($1, $2, $3, $4, $5)`;
  const values = [gameId, votingRound, move, votesFor, totalVotes];
  await connection.query(query, values);
}

export async function winStats() {
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

export async function playerStats(email: string, group: Group) {
  const query = `with data as (select votes.id, votes.vote, gm.move, g.winner
                               from votes
                                        inner join game_moves gm
                                                   on votes.game_id = gm.game_id and votes.voting_round = gm.voting_round
                                        inner join games g on g.id = gm.game_id
                               where email = $1
                                 and winner != -1)
                 select count(id)::int                                                      as votes,
                        (select count(id)::int from data where move = vote)                 as accepted_moves,
                        (select count(id)::int from data where move = vote and winner = $2) as winning_moves
                 from data;`
  const result = (await connection.query(query, [email, group])).rows[0];
  return {
    numVotes: parseInt(result.votes),
    numAccepted: parseInt(result.accepted_moves),
    numWinning: parseInt(result.winning_moves),
  }
}