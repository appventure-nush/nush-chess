import connection from './database';

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
    id        SERIAL,
    game_id   int,
    email     varchar(255),
    vote      varchar(20),
    PRIMARY KEY(id),
    foreign key(game_id) references games(id)
);
`

async function setupDatabase() {
  console.log('start database set up');
  await connection.query(createGameTable);
  await connection.query(createVotesTable);
  console.log('end database set up');
}

export = setupDatabase;