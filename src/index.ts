import {Server} from "socket.io";
import express, {Application, NextFunction} from 'express';
import bodyParser from "body-parser";
import path from "path";
import http from "http";
import {Chess} from "chess.js";
import verifyToken from "./tokens";

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
let votingTimeout: NodeJS.Timeout | null = null;
let nextVoteTime: number = 0;
let votingRounds = 0;

const votingTimeoutSeconds = 60;

let blacks = 0;
let whites = 0;

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

    const numVotes = sum(Array.from(votes.values()));
    const players = game.turn() === 'w' ? whites : blacks;

    io.emit("voting_update", {numVotes, players})

    if (numVotes == players) {
      tallyVotes();
    }
  })

  socket.on("reset", () => {
    reset();
  })


  socket.on("auth", async (token) => {
    try {
      const decodedToken = (await verifyToken(token)) as {
        // eslint-disable-next-line camelcase
        unique_name: string
        name: string
      } | null;
      if (decodedToken == null) {
        socket.emit("error", "Invalid token");
        return;
      }

      const sockets = await io.fetchSockets();
      if (sockets.some(s => s.data.email == decodedToken.unique_name)) {
        return socket.emit("error", "You have already joined");
      }

      socket.data.email = decodedToken.unique_name;
      socket.data.username = decodedToken.name;

      // TODO: switch roles after each game
      if (socket.data.username.toLowerCase().charCodeAt(0) <= "n".charCodeAt(0)) {
        socket.data.role = "black";
        blacks += 1;
      } else {
        socket.data.role = "white";
        whites += 1;
      }
      if (votes == null) {
        // new game
        newVote();
      }
      socket.emit("join_info", {role: socket.data.role, blacks, whites});
      if (blacks > 0 && whites > 0) {
        socket.emit("state", {fen: game.fen(), nextVoteTime});
        const players = game.turn() === 'w' ? whites : blacks;
        io.emit("voting_update", {numVotes: 0, players});
      }
    } catch (e: any) {
      socket.emit("error", e);
    }
  })

  socket.on("disconnect", () => {
    if (socket.data.role === "white") {
      whites -= 1;
    } else if (socket.data.role === "black") {
      blacks -= 1;
    }
  })
})

function sum(arr: number[]) {
  let res = 0;
  for (const elem of arr) {
    res += elem;
  }
  return res;
}

function reset() {
  votingRounds = 0;
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
  console.log(votes);
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
  if (game.isCheckmate()) {
    // TODO: Start new game
    if (votingTimeout != null) {
      clearTimeout(votingTimeout);
    }
    return;
  }
  const players = game.turn() === 'w' ? whites : blacks;

  io.emit("voting_update", {numVotes: 0, players})
}

function newVote() {
  votes = new Map<string, number>();
  if (votingTimeout != null) {
    clearTimeout(votingTimeout);
  }
  votingTimeout = setTimeout(tallyVotes, 1000 * votingTimeoutSeconds);
  nextVoteTime = new Date().getTime() + 1000 * votingTimeoutSeconds;
}


server.listen(3000, () => {
  console.log('listening on *:3000');
});