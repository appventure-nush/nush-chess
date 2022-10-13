import {Server} from "socket.io";
import express, {Application, NextFunction} from 'express';
import bodyParser from "body-parser";
import path from "path";
import http from "http";
import {Chess} from "chess.js";

const app = express();

// Body-parser
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.get('/', (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

const server = http.createServer(app);

const io = new Server(server);

const game = new Chess();

let votes: Map<string, number> | null = null;
let nextVoteTime: number = 0;
let votingRounds = 0;

const votingTimeoutSeconds = 20;

io.on("connection", (socket) => {
  console.log("New connection", socket.id)

  socket.on("vote", (move) => {
    if (!socket.data.role) {
      socket.emit("error", "Select a role first");
      return;
    }
    if (game.turn() != socket.data.role[0]) {
      socket.emit("error", "Not your turn");
      return;
    }
    const result = game.move(move);
    if (result == null) {
      socket.emit("error", "Invalid move");
      return;
    }
    // We don't actually want to make that move yet
    game.undo();
    if (votes == null) {
      return;
    }
    if (votes.has(move)) {
      votes.set(move, votes.get(move)!! + 1)
    } else {
      votes.set(move, 1);
    }
  })

  socket.on("reset", () => {
    reset();
  })

  socket.on("role", (role) => {
    if (!["white", "black"].includes(role)) {
      return socket.emit("error", "invalid role");
    }
    socket.data.role = role;
    console.log(socket.id, role);

    if (votes == null) {
      // new game
      newVote();
    }
    socket.emit("state", {fen: game.fen(), nextVoteTime});
  })
})

function reset(){
  game.reset()
  votes = null;
  io.emit("reset");
  newVote();
  io.emit("state", {fen: game.fen(), nextVoteTime});
}

function tallyVotes() {
  if (votes == null) {
    return;
  }
  console.log(`Voting round: ${votingRounds}`);
  votingRounds++;
  const sorted = Array.from(votes.entries()).sort((a, b) => {
    const aNum = a[1];
    const bNum = b[1];
    return bNum - aNum;
  }).slice(0, 10);

  if (sorted.length == 0) {
    // :skull:
    io.emit("error", "No votes!");
    reset();
    return;
  }

  game.move(sorted[0][0]);
  newVote();
  io.emit("state", {fen: game.fen(), nextVoteTime});
  io.emit("votes", sorted);
}

function newVote(){
  votes = new Map<string, number>();
  setTimeout(tallyVotes, 1000 * votingTimeoutSeconds);
  nextVoteTime = new Date().getTime() + 1000 * votingTimeoutSeconds;
}


server.listen(3000, () => {
  console.log('listening on *:3000');
});