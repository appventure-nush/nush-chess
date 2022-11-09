import connection from './database';

// language=SQL format=false
const createUsersTable = `
CREATE TABLE IF NOT EXISTS users
(   
    email        varchar(255),
    username        varchar(255),
    team        int,
    PRIMARY    KEY (email)
);`


// language=SQL format=false
const createGameTable = `
CREATE TABLE IF NOT EXISTS games
(   
    id           SERIAL,
    white_team   int,
    winner       int,
    timeout      boolean,
    PRIMARY    KEY (id)
);`

// language=SQL format=false
const createVotesTable = `
CREATE TABLE IF NOT EXISTS votes
(
    id             SERIAL,
    game_id        int,
    voting_round   int,
    email          varchar(255),
    vote           varchar(20),
    accepted       boolean,
    PRIMARY KEY(id),
    foreign key(game_id) references games(id),
    foreign key(email) references users(email)
);
`

// language=SQL format=false
const createGameMovesTable = `
CREATE TABLE IF NOT EXISTS game_moves
(
    id             SERIAL,
    game_id        int,
    voting_round   int,
    move           varchar(20),
    votes_for      int,
    total_votes    int,
    PRIMARY KEY(id),
    foreign key(game_id) references games(id),
    unique(game_id, voting_round)
);
`


async function setupDatabase() {
  if (connection == null) {
    console.log("Not connected to database, skipping setup");
    return;
  }
  console.log('start database set up');
  await connection.query(createUsersTable);
  await connection.query(createGameTable);
  await connection.query(createVotesTable);
  await connection.query(createGameMovesTable);
  console.log('end database set up');
}

export = setupDatabase;