import {Server, Socket} from "socket.io";
import express from 'express';
import bodyParser from "body-parser";
import http from "http";
import {Chess} from "chess.js";
import verifyToken from "./tokens";
import * as fs from "fs";
import {
  ClientToServerEvents,
  GameStatus,
  Group,
  InterServerEvents,
  Role,
  ServerToClientEvents,
  SocketData
} from "./types";

const app = express();

// Body-parser
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

const server = http.createServer(app);

const game = new Chess();

let votes: Map<string, number> | null = null;
let votingTimeout: NodeJS.Timeout | null = null;
let nextVoteTime: number = 0;
let votingRounds = 0;

const {
  votingTimeoutSeconds,
  numRequiredPlayers,
  votingThreshold,
  intergameDelaySeconds,
  allowRoleOverride
} = JSON.parse(fs.readFileSync("./config.json", "ascii"))

// Groups start from 1
const playersPerGroup = [1, 0, 0];
const winsPerGroup = [1, 0, 0];

let currentGroupOne: Role = "w";
let gameStatus: GameStatus = "waiting";

function getRoleFromGroup(group: Group): Role | false {
  if (group == 1) {
    return currentGroupOne;
  } else if (group == 2) {
    if (currentGroupOne == "w") {
      return "b";
    } else {
      return "w";
    }
  }
  return false;
}

function getGroupFromRole(role: Role): Group {
  if (role == currentGroupOne) {
    return 1;
  }
  return 2;
}


const io = new Server<ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData>(server, {
  cors: {
    origin: "http://localhost:5137",
    methods: ["GET", "POST"]
  },
  transports: ["websocket"]
});

io.on("connection", (socket) => {
  socket.on("vote", async (move) => {
    if (gameStatus != "playing") {
      socket.emit("error", "The game is not in play");
      return;
    }
    if (!socket.data.group) {
      socket.emit("error", "You are not authenticated");
      return;
    }
    if (game.turn() != getRoleFromGroup(socket.data.group)) {
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
    const players = playersPerGroup[getGroupFromRole(game.turn())];

    sendVotingUpdate();

    // Number of votes have passed threshold
    if (players > 0 && numVotes / players >= votingThreshold) {
      await tallyVotes();
    }
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
      // if (sockets.some(s => s.data.email == decodedToken.unique_name)) {
      //   return socket.emit("error", "You have already joined");
      // }

      socket.data.email = decodedToken.unique_name;
      socket.data.username = decodedToken.name;


      // if (socket.data.username.toLowerCase().charCodeAt(0) <= "l".charCodeAt(0)) {
      //   socket.data.group = 1;
      // } else {
      //   socket.data.group = 2;
      // }

      socket.data.group = Math.random() > 0.5 ? 2 : 1;

      playersPerGroup[socket.data.group] += 1;

      console.log(Math.min(playersPerGroup[1], playersPerGroup[2]), gameStatus);
      if (gameStatus == 'waiting') {
        // Game is not in play and minimum players are satisfied
        if (Math.min(playersPerGroup[1], playersPerGroup[2]) >= numRequiredPlayers) {
          await reset(false);
        }
      } else {
        sendVotingUpdate();
      }
      socket.emit("gameInfo", {
        gameStatus,
        role: getRoleFromGroup(socket.data.group),
        group: socket.data.group,
        playersPerGroup, winsPerGroup
      });
      if (gameStatus == "playing") {
        socket.emit("state", {fen: game.fen(), nextVoteTime});
      }
    } catch (e: any) {
      socket.emit("error", e);
    }
  })

  socket.on("disconnect", () => {
    if (!socket.data.group) {
      return
    }
    playersPerGroup[socket.data.group] -= 1;
  })
})

function sum(arr: number[]) {
  let res = 0;
  for (const elem of arr) {
    res += elem;
  }
  return res;
}

async function reset(switchTeams=true) {
  gameStatus = "playing";
  if (votingTimeout != null) {
    clearTimeout(votingTimeout);
  }
  if(switchTeams){
    if (currentGroupOne == "w") {
      currentGroupOne = "b";
    } else {
      currentGroupOne = "w";
    }
  }
  votingRounds = 0;
  game.reset()
  newVote();
  await sendGameInfoToAll();
  io.emit("state", {fen: game.fen(), nextVoteTime});

}

async function tallyVotes() {
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
    if (Math.min(...playersPerGroup) == 0) {
      gameStatus = "waiting";
    } else {
      resetAfterDelay();
    }
    await sendGameInfoToAll();
    return;
  }

  const currentGroup = getGroupFromRole(game.turn());
  game.move(sorted[0][0]);
  newVote();
  io.emit("state", {fen: game.fen(), nextVoteTime});
  io.emit("votes", sorted);
  if (game.isCheckmate()) {
    io.emit("winner", currentGroup);
    winsPerGroup[currentGroup] += 1;
    resetAfterDelay();
    await sendGameInfoToAll();
    return;
  }
  sendVotingUpdate();
}

function resetAfterDelay(){
  gameStatus = "waiting";
  setTimeout(reset, intergameDelaySeconds*1000);
}

function sendVotingUpdate() {
  if (votes == null) {
    return
  }
  const numVotes = sum(Array.from(votes.values()));
  const players = playersPerGroup[getGroupFromRole(game.turn())];

  io.emit("votingUpdate", {numVotes, players})
}

async function sendGameInfoToAll() {
  const sockets = await io.sockets.fetchSockets();
  for (const socket of sockets) {
    if (socket.data.group) {
      socket.emit("gameInfo", {
        gameStatus,
        role: getRoleFromGroup(socket.data.group),
        group: socket.data.group,
        playersPerGroup, winsPerGroup
      });
    }
  }
}

function newVote() {
  votes = new Map<string, number>();
  if (votingTimeout != null) {
    clearTimeout(votingTimeout);
  }
  votingTimeout = setTimeout(tallyVotes, 1000 * votingTimeoutSeconds);
  nextVoteTime = new Date().getTime() + 1000 * votingTimeoutSeconds;
}

app.use(express.static('../frontend/dist'))

server.listen(3001, () => {
  console.log('listening on *:3001');
});